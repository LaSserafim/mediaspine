// MediaSpine Real-Time Computer Vision Posture Screener Engine
import { computePostureScore, severityFor, getScoreSeverity, loadProgressData } from './progress.js';
import { openShareCardModal } from './card.js';
import { supabase } from './auth.js';

const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10]
];

export function calculateAngle(ear, shoulder) {
  return Math.atan(Math.abs(ear.x - shoulder.x) / Math.abs(ear.y - shoulder.y)) * (180 / Math.PI);
}

export function analyzeFrontalPosture(lm) {
  const leftEye = lm[1], rightEye = lm[4];
  const leftShoulder = lm[11], rightShoulder = lm[12];
  const dxS = Math.max(Math.abs(leftShoulder.x - rightShoulder.x), 0.001);
  const dyS = Math.abs(leftShoulder.y - rightShoulder.y);
  const dxE = Math.max(Math.abs(leftEye.x - rightEye.x), 0.001);
  const dyE = Math.abs(leftEye.y - rightEye.y);
  return {
    shoulderTilt: Math.atan(dyS / dxS) * (180 / Math.PI),
    headTilt: Math.atan(dyE / dxE) * (180 / Math.PI)
  };
}

export function extractPoseMetrics(lm, viewModeBadge) {
  const metrics = { poseDetected: true, poseLandmarks: lm };
  const leftShoulder = lm[11], rightShoulder = lm[12];
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

  if (shoulderWidth < 0.15) {
    const leftVis = (lm[7]?.visibility || 0) + (lm[11]?.visibility || 0);
    const rightVis = (lm[8]?.visibility || 0) + (lm[12]?.visibility || 0);
    const isLeft = leftVis > rightVis;
    const ear = isLeft ? lm[7] : lm[8];
    const shoulder = isLeft ? lm[11] : lm[12];
    const angle = ear && shoulder ? calculateAngle(ear, shoulder) : null;
    metrics.neckDeviationAngle = isNaN(angle) ? null : angle;
    metrics.shoulderTilt = null;
    metrics.headTilt = null;
    if (viewModeBadge) viewModeBadge.textContent = 'Profile View (Sagittal CVA)';
  } else {
    const frontal = analyzeFrontalPosture(lm);
    metrics.shoulderTilt = frontal.shoulderTilt;
    metrics.headTilt = frontal.headTilt;
    metrics.neckDeviationAngle = null;
    if (viewModeBadge) viewModeBadge.textContent = 'Frontal View (Coronal Symmetry)';
  }

  return metrics;
}

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

let isProcessing = false;
let cameraStream = null;
let animFrameId = null;
let currentLandmarks = null;
let isRecording = false;
let snapshotTimer = null;
let evaluating = false;
let lastAIData = null;

let shoulderYData = [];
let noseXData = [];
let noseYData = [];
let neckData = [];
let shoulderTiltData = [];
let headTiltData = [];

const rollingShoulderY = [];
const rollingNoseX = [];
const rollingNoseY = [];
const ROLLING_WINDOW = 30;
const MIN_STABILITY_SAMPLES = 20;
const DAILY_EVAL_LIMIT = 10;

function getEvalQuota() {
  try {
    const today = new Date().toDateString();
    const stored = JSON.parse(localStorage.getItem('mediaspine_eval_quota') || '{}');
    if (stored.date !== today) return { date: today, used: 0 };
    return stored;
  } catch (e) {
    return { date: new Date().toDateString(), used: 0 };
  }
}

function updateQuotaUI() {
  const quotaCountEl = document.getElementById('quotaCount');
  const limitNotice = document.getElementById('limitNotice');
  const snapshotBtn = document.getElementById('snapshotBtn');
  const q = getEvalQuota();
  const remaining = Math.max(0, DAILY_EVAL_LIMIT - q.used);

  if (quotaCountEl) {
    quotaCountEl.textContent = `${remaining}/${DAILY_EVAL_LIMIT} remaining today`;
  }
  if (remaining <= 0) {
    if (limitNotice) limitNotice.classList.add('show');
    if (snapshotBtn) snapshotBtn.disabled = true;
  } else {
    if (limitNotice) limitNotice.classList.remove('show');
    if (snapshotBtn && currentLandmarks && !isRecording && !evaluating) {
      snapshotBtn.disabled = false;
    }
  }
}

function consumeEvalQuota() {
  const q = getEvalQuota();
  q.used++;
  try {
    localStorage.setItem('mediaspine_eval_quota', JSON.stringify(q));
  } catch (e) {}
  updateQuotaUI();
}

export function initScanner() {
  const cam = document.getElementById('cam');
  const overlay = document.getElementById('overlay');
  const overlayCtx = overlay?.getContext('2d');
  const startBtn = document.getElementById('startBtn');
  const snapshotBtn = document.getElementById('snapshotBtn');
  const camStatus = document.getElementById('camStatus');
  const viewModeBadge = document.getElementById('viewModeBadge');
  const camPlaceholder = document.getElementById('camPlaceholder');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNum = document.getElementById('countdownNum');
  const countdownLabel = document.getElementById('countdownLabel');

  const mNeck = document.getElementById('mNeck');
  const mShoulder = document.getElementById('mShoulder');
  const mHead = document.getElementById('mHead');
  const mShoulderStab = document.getElementById('mShoulderStab');
  const mHeadStab = document.getElementById('mHeadStab');

  const report = document.getElementById('report');
  const aiLoading = document.getElementById('aiLoading');
  const aiResults = document.getElementById('aiResults');
  const aiSummary = document.getElementById('aiSummary');
  const aiSeverity = document.getElementById('aiSeverity');
  const aiCauses = document.getElementById('aiCauses');
  const aiRisks = document.getElementById('aiRisks');
  const aiRecs = document.getElementById('aiRecs');
  const reportActions = document.getElementById('reportActions');
  const shareResultBtn = document.getElementById('shareResultBtn');
  const resetBtn = document.getElementById('resetBtn');

  updateQuotaUI();

  let pose = null;
  if (typeof window.Pose !== 'undefined') {
    pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
    });
    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false
    });
    pose.onResults(onPoseResults);
  }

  function setMetricVal(el, text, statusClass = '') {
    if (!el) return;
    el.textContent = text;
    el.className = 'val ' + statusClass;
  }

  function onPoseResults(results) {
    isProcessing = false;
    if (!overlay || !overlayCtx || !cam) return;

    if (overlay.width !== cam.videoWidth || overlay.height !== cam.videoHeight) {
      overlay.width = cam.videoWidth || 640;
      overlay.height = cam.videoHeight || 480;
    }

    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    if (!results.poseLandmarks) {
      currentLandmarks = null;
      if (snapshotBtn && !isRecording) snapshotBtn.disabled = true;
      setMetricVal(mNeck, '-');
      setMetricVal(mShoulder, '-');
      setMetricVal(mHead, '-');
      return;
    }

    currentLandmarks = results.poseLandmarks;
    if (snapshotBtn && !isRecording && !evaluating) {
      const q = getEvalQuota();
      if (q.used < DAILY_EVAL_LIMIT) snapshotBtn.disabled = false;
    }

    // Draw skeletal lines
    overlayCtx.strokeStyle = 'rgba(45, 212, 191, 0.8)';
    overlayCtx.lineWidth = 3;
    overlayCtx.lineCap = 'round';
    CONNECTIONS.forEach(([i, j]) => {
      const p1 = currentLandmarks[i];
      const p2 = currentLandmarks[j];
      if (p1 && p2 && (p1.visibility || 0) > 0.4 && (p2.visibility || 0) > 0.4) {
        overlayCtx.beginPath();
        overlayCtx.moveTo(p1.x * overlay.width, p1.y * overlay.height);
        overlayCtx.lineTo(p2.x * overlay.width, p2.y * overlay.height);
        overlayCtx.stroke();
      }
    });

    // Draw joint dots
    currentLandmarks.forEach((lm, idx) => {
      if ([0, 7, 8, 11, 12, 13, 14, 23, 24].includes(idx) && (lm.visibility || 0) > 0.4) {
        overlayCtx.fillStyle = '#0D9488';
        overlayCtx.beginPath();
        overlayCtx.arc(lm.x * overlay.width, lm.y * overlay.height, 5, 0, Math.PI * 2);
        overlayCtx.fill();
        overlayCtx.fillStyle = '#FFFFFF';
        overlayCtx.beginPath();
        overlayCtx.arc(lm.x * overlay.width, lm.y * overlay.height, 2.5, 0, Math.PI * 2);
        overlayCtx.fill();
      }
    });

    const m = extractPoseMetrics(currentLandmarks, viewModeBadge);

    // Live display values
    if (m.neckDeviationAngle != null) {
      const deg = m.neckDeviationAngle;
      const cls = deg <= 10 ? 'good' : (deg <= 20 ? 'caution' : 'bad');
      setMetricVal(mNeck, `${deg.toFixed(1)}°`, cls);
      setMetricVal(mShoulder, '-');
      setMetricVal(mHead, '-');
      if (isRecording) neckData.push(deg);
    } else {
      setMetricVal(mNeck, '-');
      if (m.shoulderTilt != null) {
        const clsS = m.shoulderTilt <= 2.5 ? 'good' : (m.shoulderTilt <= 5 ? 'caution' : 'bad');
        setMetricVal(mShoulder, `${m.shoulderTilt.toFixed(1)}°`, clsS);
        if (isRecording) shoulderTiltData.push(m.shoulderTilt);
      }
      if (m.headTilt != null) {
        const clsH = m.headTilt <= 2.5 ? 'good' : (m.headTilt <= 5 ? 'caution' : 'bad');
        setMetricVal(mHead, `${m.headTilt.toFixed(1)}°`, clsH);
        if (isRecording) headTiltData.push(m.headTilt);
      }
    }

    // Stability calculations
    const shoulderMidY = ((currentLandmarks[11]?.y || 0) + (currentLandmarks[12]?.y || 0)) / 2;
    const nose = currentLandmarks[0];

    if (!isRecording) {
      rollingShoulderY.push(shoulderMidY);
      if (rollingShoulderY.length > ROLLING_WINDOW) rollingShoulderY.shift();
      const sVariance = Math.max(...rollingShoulderY) - Math.min(...rollingShoulderY);
      const sCls = sVariance <= 0.03 ? 'good' : (sVariance <= 0.06 ? 'caution' : 'bad');
      setMetricVal(mShoulderStab, sVariance.toFixed(3), sCls);

      if (nose) {
        rollingNoseX.push(nose.x);
        rollingNoseY.push(nose.y);
        if (rollingNoseX.length > ROLLING_WINDOW) rollingNoseX.shift();
        if (rollingNoseY.length > ROLLING_WINDOW) rollingNoseY.shift();
        const hVar = Math.max(
          Math.max(...rollingNoseX) - Math.min(...rollingNoseX),
          Math.max(...rollingNoseY) - Math.min(...rollingNoseY)
        );
        const hCls = hVar <= 0.03 ? 'good' : (hVar <= 0.06 ? 'caution' : 'bad');
        setMetricVal(mHeadStab, hVar.toFixed(3), hCls);
      }
    } else {
      shoulderYData.push(shoulderMidY);
      if (nose) {
        noseXData.push(nose.x);
        noseYData.push(nose.y);
      }
    }
  }

  async function processVideoFrame() {
    if (!cameraStream || !cam || cam.paused || cam.ended) return;
    if (pose && !isProcessing && cam.readyState >= 2) {
      isProcessing = true;
      try {
        await pose.send({ image: cam });
      } catch (e) {
        isProcessing = false;
      }
    }
    animFrameId = requestAnimationFrame(processVideoFrame);
  }

  async function startCamera() {
    try {
      if (startBtn) startBtn.disabled = true;
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      cam.srcObject = cameraStream;
      await cam.play();
      document.body.classList.add('cam-active');
      if (camPlaceholder) camPlaceholder.style.display = 'none';
      if (camStatus) camStatus.textContent = 'CAMERA LIVE';
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'Stop camera';
        startBtn.onclick = stopCamera;
      }
      processVideoFrame();
    } catch (err) {
      if (startBtn) startBtn.disabled = false;
      window.showAuthToast?.('Camera access denied or unavailable.');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    document.body.classList.remove('cam-active');
    if (camPlaceholder) camPlaceholder.style.display = 'flex';
    if (camStatus) camStatus.textContent = 'CAMERA OFF';
    if (startBtn) {
      startBtn.textContent = 'Start camera';
      startBtn.onclick = startCamera;
    }
    if (snapshotBtn) snapshotBtn.disabled = true;
    currentLandmarks = null;
  }

  if (startBtn) startBtn.onclick = startCamera;

  // 3-Second Hold Snapshot & Evaluation
  function startStabilitySnapshot() {
    if (!currentLandmarks || isRecording || evaluating) return;
    const q = getEvalQuota();
    if (q.used >= DAILY_EVAL_LIMIT) return;

    isRecording = true;
    shoulderYData = [];
    noseXData = [];
    noseYData = [];
    neckData = [];
    shoulderTiltData = [];
    headTiltData = [];

    if (snapshotBtn) snapshotBtn.disabled = true;
    if (countdownOverlay) countdownOverlay.classList.add('active');

    let count = 3;
    if (countdownNum) countdownNum.textContent = count;
    if (countdownLabel) countdownLabel.textContent = 'Hold steady';

    snapshotTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (countdownNum) countdownNum.textContent = count;
      } else {
        clearInterval(snapshotTimer);
        isRecording = false;
        if (countdownOverlay) countdownOverlay.classList.remove('active');
        completeSnapshotEvaluation();
      }
    }, 1000);
  }

  if (snapshotBtn) snapshotBtn.onclick = startStabilitySnapshot;

  async function completeSnapshotEvaluation() {
    if (shoulderYData.length < MIN_STABILITY_SAMPLES) {
      window.showAuthToast?.('Hold interrupted or face not tracked continuously. Please try again.');
      if (snapshotBtn) snapshotBtn.disabled = false;
      return;
    }

    const sRange = Math.max(...shoulderYData) - Math.min(...shoulderYData);
    const nRange = noseXData.length ? Math.max(
      Math.max(...noseXData) - Math.min(...noseXData),
      Math.max(...noseYData) - Math.min(...noseYData)
    ) : 0.03;

    evaluating = true;

    const scan = {
      neckDeviationAngle: median(neckData),
      shoulderTilt: median(shoulderTiltData),
      headTilt: median(headTiltData),
      shoulderStability: sRange,
      headStability: nRange
    };

    const parts = [];
    if (scan.neckDeviationAngle != null) {
      parts.push(`Neck Deviation Angle: ${scan.neckDeviationAngle.toFixed(1)}°`);
    }
    if (scan.shoulderTilt != null) {
      parts.push(`Shoulder Tilt: ${scan.shoulderTilt.toFixed(1)}°`);
    }
    if (scan.headTilt != null) {
      parts.push(`Head Tilt: ${scan.headTilt.toFixed(1)}°`);
    }
    parts.push(`Shoulder Stability: ${scan.shoulderStability.toFixed(3)} variance over hold window`);
    parts.push(`Head Stability: ${scan.headStability.toFixed(3)} variance over hold window`);
    const payloadString = parts.join(', ');

    if (report) report.style.display = 'block';
    if (aiLoading) aiLoading.style.display = 'block';
    if (aiResults) aiResults.style.display = 'none';
    report.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: payloadString, lang: window.currentLang || 'en' })
      });

      if (!res.ok) {
        throw new Error('Evaluation service response error');
      }

      const data = await res.json();
      let raw = null;
      try {
        raw = JSON.parse(data.choices?.[0]?.message?.content);
      } catch (e) {
        raw = null;
      }
      if (!raw || typeof raw.summary !== 'string') {
        throw new Error('Unexpected format from evaluation');
      }

      consumeEvalQuota();

      const list = (v) => (Array.isArray(v) ? v : []).filter((t) => typeof t === 'string').slice(0, 5);
      const score = computePostureScore(scan);
      const parsed = {
        summary: raw.summary.slice(0, 500),
        severity: severityFor(score),
        causes: list(raw.causes),
        risks: list(raw.risks),
        recommendations: list(raw.recommendations)
      };

      if (scan.neckDeviationAngle != null && window.updateBiomechanicalGraphScan) {
        window.updateBiomechanicalGraphScan(scan.neckDeviationAngle);
      }

      if (aiSummary) aiSummary.textContent = parsed.summary || 'Screening complete.';
      if (aiSeverity) {
        aiSeverity.textContent = parsed.severity;
        const sLvl = getScoreSeverity(score);
        aiSeverity.style.color = sLvl.color;
      }

      const renderList = (el, items) => {
        if (!el) return;
        el.innerHTML = '';
        items.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = item;
          el.appendChild(li);
        });
      };

      renderList(aiCauses, parsed.causes);
      renderList(aiRisks, parsed.risks);
      renderList(aiRecs, parsed.recommendations);

      lastAIData = {
        metrics: scan,
        parsed,
        score,
        timestamp: new Date()
      };

      if (aiLoading) aiLoading.style.display = 'none';
      if (aiResults) aiResults.style.display = 'block';
      if (reportActions) reportActions.style.display = 'flex';

      // Save scan to localStorage and Supabase
      const scanRecord = {
        id: 'scan-' + Date.now(),
        user_id: window.currentUser ? window.currentUser.id : 'local',
        created_at: new Date().toISOString(),
        neck_deviation: scan.neckDeviationAngle != null ? parseFloat(scan.neckDeviationAngle.toFixed(2)) : null,
        shoulder_tilt: scan.shoulderTilt != null ? parseFloat(scan.shoulderTilt.toFixed(2)) : null,
        head_tilt: scan.headTilt != null ? parseFloat(scan.headTilt.toFixed(2)) : null,
        shoulder_stability: parseFloat(scan.shoulderStability.toFixed(3)),
        head_stability: parseFloat(scan.headStability.toFixed(3)),
        severity: parsed.severity,
        ai_result: parsed
      };

      try {
        const localKey = 'mediaspine_scans_history';
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        existing.push(scanRecord);
        localStorage.setItem(localKey, JSON.stringify(existing.slice(-200)));
      } catch (e) {}

      if (window.currentUser && supabase) {
        try {
          await supabase.from('scans').insert({
            user_id: window.currentUser.id,
            neck_deviation: scanRecord.neck_deviation,
            shoulder_tilt: scanRecord.shoulder_tilt,
            head_tilt: scanRecord.head_tilt,
            shoulder_stability: scanRecord.shoulder_stability,
            head_stability: scanRecord.head_stability,
            severity: scanRecord.severity,
            ai_result: scanRecord.ai_result
          });
        } catch (e) {}
      }

      loadProgressData();
    } catch (err) {
      if (aiLoading) aiLoading.style.display = 'none';
      if (aiResults) aiResults.style.display = 'block';
      if (aiSummary) aiSummary.textContent = 'Notice: unable to complete AI analysis. Measurements remain visible in real time.';
      if (reportActions) reportActions.style.display = 'none';
    } finally {
      evaluating = false;
      if (snapshotBtn) snapshotBtn.disabled = !currentLandmarks;
    }
  }

  if (shareResultBtn) {
    shareResultBtn.onclick = () => {
      if (!lastAIData) return;
      openShareCardModal({
        score: lastAIData.score,
        severity: lastAIData.parsed.severity,
        neck_deviation: lastAIData.metrics.neckDeviationAngle,
        shoulder_tilt: lastAIData.metrics.shoulderTilt,
        head_tilt: lastAIData.metrics.headTilt,
        shoulder_stability: lastAIData.metrics.shoulderStability,
        head_stability: lastAIData.metrics.headStability,
        summary: lastAIData.parsed.summary,
        scanned_at: lastAIData.timestamp
      });
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (report) report.style.display = 'none';
      lastAIData = null;
      if (snapshotBtn) snapshotBtn.disabled = !currentLandmarks;
      window.scrollTo({ top: document.getElementById('scan')?.offsetTop - 80 || 0, behavior: 'smooth' });
    };
  }
}
