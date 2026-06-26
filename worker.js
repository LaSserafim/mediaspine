// worker.js

importScripts(
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/face_mesh.js'
);

let pendingPoseMetrics = null;
let pendingFaceMetrics = null;

let earHistory = [];
let marHistory = [];
let browHistory = [];
const HISTORY_LIMIT = 30;

// Initialize Pose
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
});

pose.setOptions({
  modelComplexity: 0,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults((results) => {
  if (results.poseLandmarks) {
    pendingPoseMetrics = extractPoseMetrics(results.poseLandmarks);
  } else {
    pendingPoseMetrics = { poseDetected: false };
  }
  trySendMetrics();
});

// Initialize FaceMesh
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults((results) => {
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    pendingFaceMetrics = extractFaceMetrics(results.multiFaceLandmarks[0]);
  } else {
    pendingFaceMetrics = { faceDetected: false };
  }
  trySendMetrics();
});

// Send aggregated metrics to main thread
function trySendMetrics() {
  if (pendingPoseMetrics && pendingFaceMetrics) {
    self.postMessage({
      type: 'analysis_data',
      metrics: {
        ...pendingPoseMetrics,
        ...pendingFaceMetrics
      }
    });
    // Reset for the next frame
    pendingPoseMetrics = null;
    pendingFaceMetrics = null;
  }
}

// ─── Receive frames from main thread ────────────────────────────────────────
//
// FIX: Models share GPU/WASM memory internally. Feeding both the same
// ImageBitmap via Promise.all causes a resource lock that stalls / crashes.
// Solution: await each model sequentially so the first fully releases the
// image source before the second one consumes it.
//
self.onmessage = async (e) => {
  if (e.data.type !== 'process_frame') return;

  const imageBitmap = e.data.frame;

  try {
    // Step 1 — Pose model finishes completely before FaceMesh touches the bitmap.
    await pose.send({ image: imageBitmap });

    // Step 2 — FaceMesh runs only after Pose has finished.
    await faceMesh.send({ image: imageBitmap });

  } catch (err) {
    // Notify the main thread immediately so it can unlock itself and
    // schedule the next frame capture rather than waiting indefinitely.
    console.error('[worker] Processing error:', err);
    self.postMessage({ type: 'error', message: err.message });

    // Also clear any half-populated pending metrics to avoid a stale
    // trySendMetrics() call on the next successful frame.
    pendingPoseMetrics = null;
    pendingFaceMetrics = null;

  } finally {
    // Always free the ImageBitmap regardless of success or failure.
    // Failing to do this leaks GPU-backed memory in the worker context.
    imageBitmap.close();
  }
};

// ─── Pose Math ──────────────────────────────────────────────────────────────
function calculateAngle(ear, shoulder) {
  return Math.atan(Math.abs(ear.x - shoulder.x) / Math.abs(ear.y - shoulder.y)) * (180 / Math.PI);
}

function analyzeFrontalPosture(lm) {
  const leftEye = lm[1], rightEye = lm[4];
  const leftShoulder = lm[11], rightShoulder = lm[12];

  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) * 100;
  const headTilt = Math.abs(leftEye.y - rightEye.y) * 100;

  return { shoulderTilt, headTilt };
}

function extractPoseMetrics(lm) {
  let metrics = {
    poseDetected: true,
    poseLandmarks: lm // Sending back for overlay drawing
  };

  const leftShoulder = lm[11], rightShoulder = lm[12];
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

  if (shoulderWidth < 0.15) {
    // Profile View
    const leftVis = (lm[7].visibility || 0) + (lm[11].visibility || 0);
    const rightVis = (lm[8].visibility || 0) + (lm[12].visibility || 0);
    const isLeft = leftVis > rightVis;

    const ear = isLeft ? lm[7] : lm[8];
    const shoulder = isLeft ? lm[11] : lm[12];

    const angle = calculateAngle(ear, shoulder);
    metrics.neckDeviationAngle = isNaN(angle) ? null : angle;
    metrics.shoulderTilt = null;
    metrics.headTilt = null;
  } else {
    // Frontal View
    const frontal = analyzeFrontalPosture(lm);
    metrics.shoulderTilt = frontal.shoulderTilt;
    metrics.headTilt = frontal.headTilt;
    metrics.neckDeviationAngle = null;
  }

  return metrics;
}

// ─── Face Math (Stress & Emotion) ───────────────────────────────────────────
function distance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function calculateVariance(arr) {
  if (arr.length === 0) return 0;
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  return max - min;
}

// Safe division: returns fallback (default 0) when denominator is zero/tiny.
function safeDivide(numerator, denominator, fallback = 0) {
  return Math.abs(denominator) < 1e-6 ? fallback : numerator / denominator;
}

function extractFaceMetrics(lm) {
  // 1. EAR (Eye Aspect Ratio)
  // Left eye: 33, 160, 158, 133, 153, 144
  // Right eye: 362, 385, 387, 263, 373, 380
  const leftEyeWidth  = distance(lm[33], lm[133]);
  const rightEyeWidth = distance(lm[362], lm[263]);

  // Guard: if the eye width collapses to zero (e.g. eyes fully closed or
  // landmark jitter) use 0 so we don't produce Infinity / NaN.
  const leftEAR  = safeDivide(
    distance(lm[160], lm[144]) + distance(lm[158], lm[153]),
    2.0 * leftEyeWidth
  );
  const rightEAR = safeDivide(
    distance(lm[385], lm[380]) + distance(lm[387], lm[373]),
    2.0 * rightEyeWidth
  );
  const ear = (leftEAR + rightEAR) / 2.0;

  // 2. MAR (Mouth Aspect Ratio)
  // Inner lips: top (13), bottom (14), left corner (78), right corner (308)
  const mouthWidth = distance(lm[78], lm[308]);
  // Guard: mouth width can be near-zero when tightly closed.
  const mar = safeDivide(distance(lm[13], lm[14]), mouthWidth);

  // 3. Brow Tension
  // Distance between inner eyebrows (indices 55 and 285)
  const browTension = distance(lm[55], lm[285]);

  // Update History Arrays
  earHistory.push(ear);
  marHistory.push(mar);
  browHistory.push(browTension);

  if (earHistory.length > HISTORY_LIMIT) earHistory.shift();
  if (marHistory.length > HISTORY_LIMIT) marHistory.shift();
  if (browHistory.length > HISTORY_LIMIT) browHistory.shift();

  // Calculate Variances (range over window)
  const earVariance  = calculateVariance(earHistory);
  const marVariance  = calculateVariance(marHistory);
  const browVariance = calculateVariance(browHistory);

  // Normalize to [0, 1] — caps guard against the max-variance constants being
  // set to 0 accidentally (safeDivide returns 0 in that case, not Infinity).
  const EAR_MAX_VARIANCE  = 0.2;  // Erratic blinking
  const MAR_MAX_VARIANCE  = 0.1;  // Jaw tremors / clenching
  const BROW_MAX_VARIANCE = 0.05; // Brow furrowing

  const earStress  = Math.min(safeDivide(earVariance,  EAR_MAX_VARIANCE),  1);
  const marStress  = Math.min(safeDivide(marVariance,  MAR_MAX_VARIANCE),  1);
  const browStress = Math.min(safeDivide(browVariance, BROW_MAX_VARIANCE), 1);

  // Combined stress level 0-100
  const combinedStress = (earStress + marStress + browStress) / 3;
  const stressLevel = Math.round(combinedStress * 100);

  // 4. Emotion Curvature
  // Y-axis difference between mouth corners (61, 291) and mouth centre.
  // Happy  = corners higher than centre (smaller Y) => positive curvature.
  // Tense  = corners lower  than centre (larger  Y) => negative curvature.
  const mouthCenterY  = (lm[13].y + lm[14].y) / 2.0;
  const mouthCornersY = (lm[61].y + lm[291].y) / 2.0;
  const emotionCurvature = mouthCenterY - mouthCornersY;

  let emotion = 'Neutral';
  if (emotionCurvature > 0.015) {
    emotion = 'Happy';
  } else if (emotionCurvature < -0.005) {
    emotion = 'Tense/Sad';
  }

  return {
    faceDetected: true,
    ear,
    mar,
    browTension,
    stressLevel,
    emotionCurvature,
    emotion,
    faceLandmarks: lm // Sending back for overlay drawing if needed
  };
}
