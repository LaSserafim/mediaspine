// MediaSpine Patient Record, Progress Chart & Data Export
import { supabase } from './auth.js';
import { openShareCardModal } from './card.js';

export function computePostureScore(m = {}) {
  const neck = m.neckDeviation ?? m.neck_deviation ?? m.neckDeviationAngle ?? 0;
  const shoulder = m.shoulderTilt ?? m.shoulder_tilt ?? 0;
  const head = m.headTilt ?? m.head_tilt ?? 0;
  const sStab = m.shoulderStability ?? m.shoulder_stability ?? 0;
  const hStab = m.headStability ?? m.head_stability ?? 0;

  let neckPenalty = 0;
  if (neck <= 5) neckPenalty = neck * 1.0;
  else if (neck <= 10) neckPenalty = 5 + (neck - 5) * 1.6;
  else if (neck <= 15) neckPenalty = 13 + (neck - 10) * 2.2;
  else if (neck <= 20) neckPenalty = 24 + (neck - 15) * 1.8;
  else neckPenalty = Math.min(40, 33 + (neck - 20) * 1.2);

  let shoulderPenalty = 0;
  if (shoulder <= 2.5) shoulderPenalty = shoulder * 1.5;
  else if (shoulder <= 4.5) shoulderPenalty = 3.75 + (shoulder - 2.5) * 2.5;
  else if (shoulder <= 7.0) shoulderPenalty = 8.75 + (shoulder - 4.5) * 2.0;
  else shoulderPenalty = Math.min(20, 13.75 + (shoulder - 7.0) * 1.2);

  let headPenalty = 0;
  if (head <= 2.5) headPenalty = head * 1.5;
  else if (head <= 4.5) headPenalty = 3.75 + (head - 2.5) * 2.5;
  else if (head <= 7.0) headPenalty = 8.75 + (head - 4.5) * 2.0;
  else headPenalty = Math.min(20, 13.75 + (head - 7.0) * 1.2);

  const calcStab = (stab) => {
    if (stab <= 0.03) return stab * (2 / 0.03);
    if (stab <= 0.06) return 2 + (stab - 0.03) * (2.2 / 0.03);
    if (stab <= 0.10) return 4.2 + (stab - 0.06) * (2.0 / 0.04);
    return Math.min(7.5, 6.2 + (stab - 0.10) * 8);
  };

  const sStabPenalty = calcStab(sStab);
  const hStabPenalty = calcStab(hStab);

  const total = neckPenalty + shoulderPenalty + headPenalty + sStabPenalty + hStabPenalty;
  return Math.max(0, Math.min(100, Math.round(100 - total)));
}

export function getScoreSeverity(score) {
  if (score >= 88) return { label: 'Normal', color: '#0D9488' };
  if (score >= 75) return { label: 'Very Mild', color: '#0D9488' };
  if (score >= 58) return { label: 'Mild', color: '#D97706' };
  if (score >= 38) return { label: 'Moderate', color: '#D97706' };
  return { label: 'Severe', color: '#DC2626' };
}

export function severityFor(score) {
  return getScoreSeverity(score).label;
}

const LEVEL_COLORS = ['#0D9488', '#D97706', '#DC2626'];
const LEVEL_TEXT = ['#0F766E', '#B45309', '#B91C1C'];

function limitMetric(key, label, hint, view, limits, dec, unit) {
  return {
    key, label, hint, view, dec, unit,
    max: limits[1] * 2,
    get: (s) => s[key],
    level: (v) => (v <= limits[0] ? 0 : v <= limits[1] ? 1 : 2),
    bands: [[0, limits[0], 0], [limits[0], limits[1], 1], [limits[1], Infinity, 2]]
  };
}

const PROGRESS_METRICS = [
  {
    key: 'score', label: 'Overall score', unit: '', dec: 0, max: 100, view: 'any scan',
    hint: 'Higher is better. 100 is optimal posture.',
    get: (s) => computePostureScore(s),
    level: (v) => (v >= 75 ? 0 : v >= 58 ? 1 : 2),
    bands: [[75, 100, 0], [58, 75, 1], [0, 58, 2]]
  },
  limitMetric('neck_deviation', 'Neck', 'Lower is better. 0° means ear sits vertically above shoulder.', 'a side view', [5, 10], 1, '°'),
  limitMetric('shoulder_tilt', 'Shoulder tilt', 'Lower is better. 0° means level shoulders.', 'a front view', [2.5, 4.5], 1, '°'),
  limitMetric('head_tilt', 'Head tilt', 'Lower is better. 0° means level head position.', 'a front view', [2.5, 4.5], 1, '°'),
  limitMetric('shoulder_stability', 'Shoulder steadiness', 'Lower is better. Hold window variance.', 'any scan', [0.03, 0.06], 3, ''),
  limitMetric('head_stability', 'Head steadiness', 'Lower is better. Hold window variance.', 'any scan', [0.03, 0.06], 3, '')
];

let progressScans = [];
let progressMetric = 'score';
let progressPoints = [];

const fmtDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtMetric = (m, v) => v.toFixed(m.dec) + m.unit;

function scanView(s) {
  const isId = typeof window.currentLang !== 'undefined' && window.currentLang === 'id';
  if (s.neck_deviation != null) return isId ? 'Tampak samping' : 'Side view';
  if (s.shoulder_tilt != null || s.head_tilt != null) return isId ? 'Tampak depan' : 'Front view';
  return isId ? 'Tampilan tidak diketahui' : 'View unknown';
}

function scanSeverity(s) {
  return s.severity || severityFor(computePostureScore(s));
}

function scanStreak(scans) {
  const days = new Set(scans.map((s) => new Date(s.created_at).toDateString()));
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function drawProgressChart() {
  const wrap = document.getElementById('progressChartWrap');
  const canvas = document.getElementById('progressCanvas');
  const emptyEl = document.getElementById('progressMetricEmpty');
  if (!wrap || !canvas) return;

  const m = PROGRESS_METRICS.find((x) => x.key === progressMetric) || PROGRESS_METRICS[0];
  const validScans = progressScans
    .filter((s) => m.get(s) != null && Number.isFinite(Number(m.get(s))))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!validScans.length) {
    canvas.style.display = 'none';
    if (emptyEl) {
      emptyEl.style.display = 'block';
      const isId = typeof window.currentLang !== 'undefined' && window.currentLang === 'id';
      emptyEl.textContent = isId
        ? `Tidak ada data untuk ${m.label}. Ambil pemindaian ${m.view} untuk melihat progres di sini.`
        : `No readings recorded for ${m.label} yet. Take ${m.view} scan to see progress here.`;
    }
    progressPoints = [];
    return;
  }

  canvas.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const rect = wrap.getBoundingClientRect();
  const W = Math.round(rect.width || 600);
  const H = Math.round(rect.height || 260);

  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const padLeft = 44;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 32;
  const gW = W - padLeft - padRight;
  const gH = H - padTop - padBottom;

  const vals = validScans.map((s) => Number(m.get(s)));
  const minVal = m.key === 'score' ? 0 : 0;
  const maxVal = m.key === 'score' ? 100 : Math.max(m.max, Math.max(...vals) * 1.15);

  const yFor = (v) => padTop + gH - ((v - minVal) / (maxVal - minVal)) * gH;
  const xFor = (i, total) => (total <= 1 ? padLeft + gW / 2 : padLeft + (i / (total - 1)) * gW);

  // Horizontal Grid Lines
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748B';
  ctx.font = '500 10.5px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';

  const gridSteps = 4;
  for (let s = 0; s <= gridSteps; s++) {
    const val = minVal + (s / gridSteps) * (maxVal - minVal);
    const y = yFor(val);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + gW, y);
    ctx.stroke();
    ctx.fillText(fmtMetric(m, val), padLeft - 6, y + 3.5);
  }

  // Plot line
  progressPoints = [];
  ctx.beginPath();
  validScans.forEach((s, i) => {
    const v = Number(m.get(s));
    const x = xFor(i, validScans.length);
    const y = yFor(v);
    progressPoints.push({ x, y, scan: s, val: v });
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#0D9488';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots
  progressPoints.forEach((p) => {
    const lvl = m.level(p.val);
    const dotColor = LEVEL_COLORS[lvl] || '#0D9488';

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function renderProgress() {
  const statsRow = document.getElementById('progressStats');
  const emptyEl = document.getElementById('progressEmpty');
  const bodyEl = document.getElementById('progressBody');
  const totalScansEl = document.getElementById('progTotalScans');
  const latestEl = document.getElementById('progLatest');
  const bestScoreEl = document.getElementById('progBestScore');
  const streakEl = document.getElementById('progStreak');
  const listEl = document.getElementById('progressList');
  const chipsEl = document.getElementById('progressChips');
  const chartHint = document.getElementById('progressChartHint');

  if (!progressScans || !progressScans.length) {
    if (statsRow) statsRow.style.display = 'none';
    if (bodyEl) bodyEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (statsRow) statsRow.style.display = 'grid';
  if (bodyEl) bodyEl.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  // Stats Counters
  if (totalScansEl) totalScansEl.textContent = progressScans.length;
  const sortedDesc = [...progressScans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const latest = sortedDesc[0];
  if (latestEl) {
    latestEl.textContent = scanSeverity(latest);
    const lvl = getScoreSeverity(computePostureScore(latest));
    latestEl.style.color = lvl.color;
  }
  if (bestScoreEl) {
    const best = Math.max(...progressScans.map((s) => computePostureScore(s)));
    bestScoreEl.textContent = `${best}/100`;
  }
  if (streakEl) {
    const streak = scanStreak(progressScans);
    const isId = typeof window.currentLang !== 'undefined' && window.currentLang === 'id';
    streakEl.textContent = isId ? `${streak} hari` : `${streak} ${streak === 1 ? 'day' : 'days'}`;
  }

  // Chips
  if (chipsEl) {
    chipsEl.innerHTML = '';
    PROGRESS_METRICS.forEach((pm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (pm.key === progressMetric ? ' active' : '');
      btn.textContent = pm.label;
      btn.onclick = () => {
        progressMetric = pm.key;
        renderProgress();
      };
      chipsEl.appendChild(btn);
    });
  }

  const curM = PROGRESS_METRICS.find((x) => x.key === progressMetric) || PROGRESS_METRICS[0];
  if (chartHint) chartHint.textContent = curM.hint;

  // Chart Canvas
  drawProgressChart();

  // Scan Table List
  if (listEl) {
    listEl.innerHTML = '';
    sortedDesc.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'scan-row';

      const d = new Date(s.created_at);
      const whenDiv = document.createElement('div');
      whenDiv.className = 'scan-when';
      whenDiv.innerHTML = `<strong>${fmtDate(d)}</strong><span>${fmtTime(d)} · ${scanView(s)}</span>`;
      row.appendChild(whenDiv);

      const sev = scanSeverity(s);
      const sevBadge = document.createElement('div');
      sevBadge.className = 'sev-badge';
      const sevLvl = getScoreSeverity(computePostureScore(s));
      sevBadge.style.color = sevLvl.color;
      sevBadge.style.borderColor = sevLvl.color;
      sevBadge.textContent = `${computePostureScore(s)} · ${sev}`;
      row.appendChild(sevBadge);

      const metricsDiv = document.createElement('div');
      metricsDiv.className = 'scan-metrics';
      metricsDiv.innerHTML = `
        <div class="sm"><span>Neck</span><b>${s.neck_deviation != null ? `${s.neck_deviation.toFixed(1)}°` : '-'}</b></div>
        <div class="sm"><span>Shoulder</span><b>${s.shoulder_tilt != null ? `${s.shoulder_tilt.toFixed(1)}°` : '-'}</b></div>
        <div class="sm"><span>Head</span><b>${s.head_tilt != null ? `${s.head_tilt.toFixed(1)}°` : '-'}</b></div>
        <div class="sm"><span>Shoulder Sway</span><b>${s.shoulder_stability != null ? s.shoulder_stability.toFixed(3) : '-'}</b></div>
        <div class="sm"><span>Head Sway</span><b>${s.head_stability != null ? s.head_stability.toFixed(3) : '-'}</b></div>
      `;
      row.appendChild(metricsDiv);

      const shareBtn = document.createElement('button');
      shareBtn.className = 'btn btn-ghost scan-share';
      shareBtn.textContent = 'Share';
      shareBtn.onclick = () => {
        openShareCardModal({
          id: s.id,
          score: computePostureScore(s),
          severity: sev,
          neck_deviation: s.neck_deviation,
          shoulder_tilt: s.shoulder_tilt,
          head_tilt: s.head_tilt,
          shoulder_stability: s.shoulder_stability,
          head_stability: s.head_stability,
          summary: s.ai_result?.summary || '',
          scanned_at: s.created_at
        });
      };
      row.appendChild(shareBtn);

      listEl.appendChild(row);
    });
  }
}

export async function loadProgressData() {
  const localKey = 'mediaspine_scans_history';
  let localScans = [];
  try {
    localScans = JSON.parse(localStorage.getItem(localKey) || '[]');
  } catch (e) {
    localScans = [];
  }

  let dbScans = [];
  if (window.currentUser && supabase) {
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false });
      if (!error && data) dbScans = data;
    } catch (err) {}
  }

  const mergedMap = new Map();
  [...localScans, ...dbScans].forEach((s) => {
    const key = s.id || `${s.created_at}-${s.neck_deviation}`;
    mergedMap.set(key, s);
  });

  progressScans = Array.from(mergedMap.values());
  renderProgress();
}
window.loadProgressData = loadProgressData;

export function downloadCSV() {
  if (!progressScans.length) {
    window.showAuthToast?.('No scan history available to download.');
    return;
  }
  const headers = ['Timestamp', 'Posture Score', 'Severity', 'Neck Deviation (°)', 'Shoulder Tilt (°)', 'Head Tilt (°)', 'Shoulder Stability', 'Head Stability', 'Summary'];
  const rows = progressScans.map((s) => [
    s.created_at,
    computePostureScore(s),
    scanSeverity(s),
    s.neck_deviation != null ? s.neck_deviation.toFixed(2) : '',
    s.shoulder_tilt != null ? s.shoulder_tilt.toFixed(2) : '',
    s.head_tilt != null ? s.head_tilt.toFixed(2) : '',
    s.shoulder_stability != null ? s.shoulder_stability.toFixed(3) : '',
    s.head_stability != null ? s.head_stability.toFixed(3) : '',
    `"${(s.ai_result?.summary || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `mediaspine-history-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.downloadCSV = downloadCSV;
