// MediaSpine Verified Result Score Card & Share Modal
const CARD_W = 1080;
const CARD_H = 1350;
const CARD_PAD = 72;
const CARD_SANS = 'Inter, "Segoe UI", sans-serif';
const CARD_MONO = '"IBM Plex Mono", ui-monospace, monospace';
const CARD_FINAL = { ring: 1, text: 1, rows: 1 };
const cardClamp = (x) => Math.max(0, Math.min(1, x));

export function loadCardFonts() {
  if (!document.fonts) return Promise.resolve();
  return Promise.all([
    `700 36px ${CARD_SANS}`,
    `600 26px ${CARD_SANS}`,
    `500 28px ${CARD_SANS}`,
    `400 22px ${CARD_SANS}`,
    `600 124px ${CARD_MONO}`,
    `500 22px ${CARD_MONO}`
  ].map((f) => document.fonts.load(f))).catch(() => {});
}

export function cardMetrics(m = {}) {
  const pick = (...vals) => {
    for (const v of vals) if (v != null && Number.isFinite(Number(v))) return Number(v);
    return null;
  };
  return {
    neck_deviation: pick(m.neck_deviation, m.neckDeviation, m.neckDeviationAngle),
    shoulder_tilt: pick(m.shoulder_tilt, m.shoulderTilt),
    head_tilt: pick(m.head_tilt, m.headTilt),
    shoulder_stability: pick(m.shoulder_stability, m.shoulderStability),
    head_stability: pick(m.head_stability, m.headStability),
    scanned_at: m.scanned_at || m.scannedAt || null
  };
}

function fitFont(ctx, text, weight, family, maxW, max, min) {
  let px = max;
  for (; px > min; px -= 2) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return px;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

function wrapLines(ctx, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  for (const word of String(text).split(/\s+/)) {
    const next = cur ? cur + ' ' + word : word;
    if (!cur || ctx.measureText(next).width <= maxW) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last.replace(/[ ,.;:]+$/, '') + '…';
  }
  return lines;
}

function ringImage(progress, color) {
  try {
    const size = 460;
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const inner = 0.74 * cx, outer = 0.88 * cx;
    const mid = (inner + outer) / 2;
    const lw = outer - inner;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, mid, 0, Math.PI * 2);
    ctx.stroke();
    if (progress > 0.002) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, mid, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }
    return out;
  } catch (e) {
    return null;
  }
}

export function renderResultCard(canvas, data, a = CARD_FINAL) {
  if (!canvas) return;
  if (canvas.width !== CARD_W || canvas.height !== CARD_H) {
    canvas.width = CARD_W;
    canvas.height = CARD_H;
  }
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Border frame
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, CARD_W - 72, CARD_H - 72);

  // Top branding
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 32px ${CARD_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('MediaSpine', CARD_PAD, 104);

  ctx.fillStyle = '#64748B';
  ctx.font = `500 16px ${CARD_MONO}`;
  ctx.fillText('CLINICAL POSTURE ASSESSMENT', CARD_PAD, 134);

  const scannedAt = data.scanned_at ? new Date(data.scanned_at) : new Date();
  const dateStr = scannedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = scannedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = `500 15px ${CARD_MONO}`;
  ctx.fillText(`${dateStr} · ${timeStr}`, CARD_W - CARD_PAD, 104);

  // Score & Ring
  const score = Math.max(0, Math.min(100, Math.round(data.score ?? 0)));
  const sev = data.severity || 'Normal';
  const color = sev === 'Normal' || sev === 'Very Mild' ? '#0D9488' : (sev === 'Mild' || sev === 'Moderate' ? '#D97706' : '#DC2626');

  const ringSize = 360;
  const ringX = (CARD_W - ringSize) / 2;
  const ringY = 180;
  const ringCanvas = ringImage(cardClamp(a.ring) * (score / 100), color);
  if (ringCanvas) {
    ctx.drawImage(ringCanvas, ringX, ringY, ringSize, ringSize);
  }

  // Score numbers inside ring
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 96px ${CARD_MONO}`;
  ctx.fillText(String(Math.round(score * cardClamp(a.text))), CARD_W / 2, ringY + ringSize / 2 + 30);

  ctx.fillStyle = '#64748B';
  ctx.font = `600 14px ${CARD_MONO}`;
  ctx.fillText('POSTURE SCORE', CARD_W / 2, ringY + ringSize / 2 + 64);

  // Severity Tag
  const sevY = ringY + ringSize + 48;
  const tagW = 160;
  const tagH = 34;
  ctx.fillStyle = color === '#0D9488' ? '#F0FDFA' : (color === '#D97706' ? '#FFFBEB' : '#FEF2F2');
  ctx.beginPath();
  ctx.roundRect((CARD_W - tagW) / 2, sevY - 24, tagW, tagH, 6);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `700 14px ${CARD_MONO}`;
  ctx.fillText(sev.toUpperCase(), CARD_W / 2, sevY);

  // Metric Rows Box
  const gridY = sevY + 44;
  const metrics = cardMetrics(data);
  const rows = [
    { label: 'Cervical Flexion (Neck CVA)', val: metrics.neck_deviation != null ? `${metrics.neck_deviation.toFixed(1)}°` : '-' },
    { label: 'Coronal Shoulder Tilt', val: metrics.shoulder_tilt != null ? `${metrics.shoulder_tilt.toFixed(1)}°` : '-' },
    { label: 'Coronal Head Tilt', val: metrics.head_tilt != null ? `${metrics.head_tilt.toFixed(1)}°` : '-' },
    { label: 'Shoulder Sway (Variance)', val: metrics.shoulder_stability != null ? metrics.shoulder_stability.toFixed(3) : '-' },
    { label: 'Head Sway (Variance)', val: metrics.head_stability != null ? metrics.head_stability.toFixed(3) : '-' }
  ];

  const rowBoxW = CARD_W - CARD_PAD * 2;
  const rowH = 46;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(CARD_PAD, gridY, rowBoxW, rows.length * rowH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(CARD_PAD, gridY, rowBoxW, rows.length * rowH);

  rows.forEach((r, idx) => {
    const y = gridY + idx * rowH;
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(CARD_PAD, y);
      ctx.lineTo(CARD_PAD + rowBoxW, y);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `500 15px ${CARD_SANS}`;
    ctx.fillText(r.label, CARD_PAD + 20, y + 28);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 15px ${CARD_MONO}`;
    ctx.fillText(r.val, CARD_PAD + rowBoxW - 20, y + 28);
  });

  // Clinical Summary Text Box
  const summaryY = gridY + rows.length * rowH + 28;
  const summaryBoxH = 150;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(CARD_PAD, summaryY, rowBoxW, summaryBoxH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(CARD_PAD, summaryY, rowBoxW, summaryBoxH);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F766E';
  ctx.font = `600 12px ${CARD_MONO}`;
  ctx.fillText('CLINICAL ASSESSMENT SUMMARY', CARD_PAD + 20, summaryY + 28);

  ctx.fillStyle = '#334155';
  ctx.font = `400 16px ${CARD_SANS}`;
  const summaryText = data.summary || 'On-device posture screening completed. Measurements reflect sagittal cervical alignment and coronal symmetry.';
  const wrapped = wrapLines(ctx, summaryText, rowBoxW - 40, 4);
  wrapped.forEach((line, i) => {
    ctx.fillText(line, CARD_PAD + 20, summaryY + 60 + i * 24);
  });

  // Footer & Disclaimer
  const footY = CARD_H - 72;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = `400 12.5px ${CARD_SANS}`;
  ctx.fillText('Indicative screening only. Not a medical device. Measured on-device via MediaPipe Pose.', CARD_PAD, footY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0D9488';
  ctx.font = `600 13px ${CARD_MONO}`;
  ctx.fillText('mediaspine.vercel.app', CARD_W - CARD_PAD, footY);

  ctx.restore();
}

export function openShareCardModal(data) {
  const modal = document.getElementById('shareCardOverlay');
  const canvas = document.getElementById('shareCardCanvas');
  if (!modal || !canvas) return;

  modal.classList.remove('hidden');
  loadCardFonts().then(() => {
    renderResultCard(canvas, data);
  });

  const closeBtn = document.getElementById('shareCardCloseBtn');
  const backdrop = document.getElementById('shareCardBackdrop');
  const downloadBtn = document.getElementById('shareCardDownloadBtn');
  const shareBtn = document.getElementById('shareCardShareBtn');
  const copyBtn = document.getElementById('shareCardCopyBtn');

  const close = () => {
    modal.classList.add('hidden');
  };

  if (closeBtn) closeBtn.onclick = close;
  if (backdrop) backdrop.onclick = close;

  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const link = document.createElement('a');
      link.download = `mediaspine-result-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  }

  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = window.location.origin + (data.id ? `/#/r/${data.id}` : '/#scan');
      navigator.clipboard.writeText(url).then(() => {
        window.showAuthToast?.('Link copied to clipboard');
      }).catch(() => {});
    };
  }

  if (shareBtn) {
    shareBtn.onclick = () => {
      if (navigator.share) {
        navigator.share({
          title: 'MediaSpine Posture Score Card',
          text: `My posture score is ${Math.round(data.score || 0)}/100 (${data.severity || 'Normal'}). Screen your posture at MediaSpine:`,
          url: window.location.origin + (data.id ? `/#/r/${data.id}` : '/#scan')
        }).catch(() => {});
      } else if (copyBtn) {
        copyBtn.click();
      }
    };
  }
}
