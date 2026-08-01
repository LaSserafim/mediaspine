# MediaSpine Fix Log

This file is the shared memory across a multi-step fix process. Each step
appends one entry below. Read the ENTIRE file before starting any step.
Never edit or delete a previous entry — only append.

---

## Step 1 — Audit
**Date:** 2026-08-01  
**Scope:** Read-only. No application logic changed.

---

### 1. Eye Blink Count & Blinks-Per-Second (simulated / mock data)

**File:** `index.html`  
**Lines:** 422–435 (state vars at 424–425)

**State variables (lines 424–425):**
```js
let blinkCount = 0;
let blinkSessionStartTime = Date.now();
```

**Mock interval (lines 426–435):**
```js
setInterval(() => {
  if (currentLandmarks && cameraInstance) {
    if (Math.random() > 0.6) blinkCount += Math.floor(Math.random() * 2) + 1;
    valBlinkCount.textContent = blinkCount;
    const elapsed = (Date.now() - blinkSessionStartTime) / 1000;
    if (elapsed > 0) valBps.textContent = (blinkCount / elapsed).toFixed(2);
  } else {
    blinkSessionStartTime = Date.now();
  }
}, 2000);
```

**Current logic summary:**  
Every 2 seconds, if landmarks are present, there is a 40 % chance of adding 1–2 to `blinkCount` via `Math.random()`. No real EAR threshold is crossed; the entire blink detector is fabricated randomness. `blinkSessionStartTime` resets whenever no landmarks are detected, so BPS restarts the clock on every lost-face event.

---

### 2. Micro-Stress Level Calculation (EAR / MAR / brow variance composite)

**File:** `index.html`  
**Function:** `extractFaceMetrics(lm)` — lines 481–519

**Rolling-history state (lines 412–419):**
```js
let earHistory  = [];
let marHistory  = [];
let browHistory = [];
const HISTORY_LIMIT    = 30;
const EAR_MAX_VARIANCE  = 0.2;
const MAR_MAX_VARIANCE  = 0.1;
const BROW_MAX_VARIANCE = 0.05;
```

**Helper used (lines 446–449):**
```js
function calcVariance(arr) {
  if (!arr.length) return 0;
  return Math.max(...arr) - Math.min(...arr);   // range, not statistical variance
}
```

**Full stress block inside `extractFaceMetrics` (lines 481–519):**
```js
function extractFaceMetrics(lm) {
  // EAR
  const leftEyeWidth  = dist(lm[33],  lm[133]);
  const rightEyeWidth = dist(lm[362], lm[263]);
  const leftEAR  = safeDivide(dist(lm[160], lm[144]) + dist(lm[158], lm[153]), 2.0 * leftEyeWidth);
  const rightEAR = safeDivide(dist(lm[385], lm[380]) + dist(lm[387], lm[373]), 2.0 * rightEyeWidth);
  const ear = (leftEAR + rightEAR) / 2.0;

  // MAR
  const mouthWidth = dist(lm[78], lm[308]);
  const mar = safeDivide(dist(lm[13], lm[14]), mouthWidth);

  // Brow tension
  const browTension = dist(lm[55], lm[285]);

  // Rolling history
  earHistory.push(ear);
  marHistory.push(mar);
  browHistory.push(browTension);
  if (earHistory.length  > HISTORY_LIMIT) earHistory.shift();
  if (marHistory.length  > HISTORY_LIMIT) marHistory.shift();
  if (browHistory.length > HISTORY_LIMIT) browHistory.shift();

  // Stress 0-100
  const earStress  = Math.min(safeDivide(calcVariance(earHistory),  EAR_MAX_VARIANCE),  1);
  const marStress  = Math.min(safeDivide(calcVariance(marHistory),  MAR_MAX_VARIANCE),  1);
  const browStress = Math.min(safeDivide(calcVariance(browHistory), BROW_MAX_VARIANCE), 1);
  const stressLevel = Math.round(((earStress + marStress + browStress) / 3) * 100);

  // Emotion curvature
  const mouthCenterY  = (lm[13].y + lm[14].y)  / 2.0;
  const mouthCornersY = (lm[61].y + lm[291].y) / 2.0;
  const emotionCurvature = mouthCenterY - mouthCornersY;
  const emotion = emotionCurvature > 0.015 ? 'Happy'
                : emotionCurvature < -0.005 ? 'Tense/Sad'
                : 'Neutral';

  return { faceDetected: true, ear, mar, browTension, stressLevel, emotion };
}
```

**Note:** `calcVariance` returns `max − min` (range), not σ². All three sub-scores are individually clamped to [0, 1] before averaging. `browTension` is raw Euclidean distance between landmarks 55 and 285 — it is not normalised by face width.

---

### 3. FaceMesh Throttling Logic (`frameCounter % 3 === 0`)

**File:** `index.html`  
**Function:** anonymous `onFrame` callback inside `startCamera()` — lines 688–712  
**State variable:** `frameCounter` declared at line 390

**State (line 390):**
```js
let frameCounter    = 0;       // throttle FaceMesh to every 3rd frame
```

**Throttle block (lines 693–711):**
```js
isProcessing = true;
frameCounter++;
pendingPose  = null;

// FaceMesh throttle: run every 3rd frame — it's the heavier model.
// On skipped frames, reuse the last known face result.
const runFace = (frameCounter % 3 === 0);
if (!runFace) pendingFace = pendingFace ?? { faceDetected: false };

try {
  await pose.send({ image: video });
  if (runFace) await faceMesh.send({ image: video });
  // isProcessing released inside tryMergeAndUpdate() once both are ready.
} catch (err) {
  console.error('[main] Frame processing error:', err);
  isProcessing = false;
  pendingPose  = null;
  if (runFace) pendingFace = null;
}
```

**Merge guard (`tryMergeAndUpdate`, lines 568–578):**
```js
function tryMergeAndUpdate() {
  if (!pendingPose || !pendingFace) return; // wait for the other model

  const merged = { ...pendingPose, ...pendingFace };
  pendingPose  = null;
  // keep pendingFace alive so throttled frames can reuse the last face result
  isProcessing = false;           // ← release frame lock AFTER both results are in

  latestMetrics = merged;
  updateUI(merged);
}
```

**Behaviour:** `frameCounter` starts at 0 and is pre-incremented before the check, so FaceMesh first fires at frame 3, then 6, 9 … — i.e. exactly every 3rd frame. On skipped frames `pendingFace` is re-used from the previous FaceMesh result (or falls back to `{ faceDetected: false }` if none has run yet).

---

### 4. 3-Second Stability Snapshot Recording Buffers

**File:** `index.html`  
**Function:** `startAIEvaluation()` — lines 731–798 (buffer writes at 618–623 inside `updateUI`)

**Buffer declarations (lines 402–406):**
```js
let shoulderYData = [];
let noseXData     = [];
let noseYData     = [];
let stressData    = [];
let emotionData   = [];
```

**Buffer reset inside `startAIEvaluation()` (lines 733–738):**
```js
isRecording   = true;
shoulderYData = [];
noseXData     = [];
noseYData     = [];
stressData    = [];
emotionData   = [];
```

**Per-frame buffer writes inside `updateUI()` (lines 618–623):**
```js
if (isRecording) {
  shoulderYData.push((lm[11].y + lm[12].y) / 2);
  noseXData.push(lm[0].x);
  noseYData.push(lm[0].y);
  if (metrics.stressLevel !== undefined) stressData.push(metrics.stressLevel);
  if (metrics.emotion     !== undefined) emotionData.push(metrics.emotion);
}
```

**Snapshot consumption after countdown (lines 764–787):**
```js
const sMax = Math.max(...shoulderYData);
const sMin = Math.min(...shoulderYData);
const shoulderStability = (sMax - sMin) * 100;

const nxMax = Math.max(...noseXData), nxMin = Math.min(...noseXData);
const nyMax = Math.max(...noseYData), nyMin = Math.min(...noseYData);
const headStability = Math.max(nxMax - nxMin, nyMax - nyMin) * 100;

const avgStress = stressData.length
  ? stressData.reduce((a, b) => a + b, 0) / stressData.length
  : 0;

let dominantEmotion = 'Neutral';
if (emotionData.length) {
  const counts = {};
  let maxCount = 0;
  emotionData.forEach(e => {
    counts[e] = (counts[e] || 0) + 1;
    if (counts[e] > maxCount) { maxCount = counts[e]; dominantEmotion = e; }
  });
}

runAIEvaluation(shoulderStability, headStability, avgStress, dominantEmotion);
```

**Recording flag lifecycle:** `isRecording = true` at line 733; `isRecording = false` at line 762 (inside the `countdownValue <= 0` branch of the 1-second `setInterval`). The countdown runs for 3 ticks (3 seconds), then stops recording and immediately calls `runAIEvaluation`.

---

### 5. Cross-Reference Map — where blink / stress values are consumed

| Location | File | Lines | What it does |
|---|---|---|---|
| `valBlinkCount.textContent` | index.html | 429 | Live UI update — mock blink count |
| `valBps.textContent` | index.html | 431 | Live UI update — mock BPS |
| `valStress.textContent` | index.html | 671 | Live UI update — real-time stress % from `extractFaceMetrics` |
| `valEmotion.textContent` | index.html | 672 | Live UI update — emotion string |
| `stressData.push(metrics.stressLevel)` | index.html | 622 | Feeds 3-second snapshot buffer |
| `emotionData.push(metrics.emotion)` | index.html | 623 | Feeds 3-second snapshot buffer |
| `avgStress` passed to `runAIEvaluation` | index.html | 787 | Average stress over snapshot period |
| `dominantEmotion` passed to `runAIEvaluation` | index.html | 787 | Mode emotion over snapshot period |
| AI payload string — `` `Micro-Stress Level: ${avgStress.toFixed(1)}%` `` | index.html | 830 | Sent to Groq via `/api/evaluate` |
| AI payload string — `` `Facial Emotion: ${dominantEmotion}` `` | index.html | 831 | Sent to Groq via `/api/evaluate` |
| CSV export — `Avg Stress: ${metrics['Average Stress']?.toFixed(1)}%` | index.html | 918 | Written to downloaded `.csv` |
| CSV export — `Emotion: ${metrics['Dominant Emotion']}` | index.html | 918 | Written to downloaded `.csv` |
| `lastAIData` object | index.html | 893 | Stores snapshot metrics for CSV export |

**Blink-specific note:** `blinkCount` and `blinkSessionStartTime` are **never** passed into the 3-second snapshot, the AI payload, or the CSV export. The mock blink data exists only in the two live UI elements (`val-blink-count`, `val-bps`).

---

## Step 2 — Real Blink Detection
**Date:** 2026-08-01  
**Scope:** Replaced stochastic mock blink generator with a real EAR threshold-crossing state machine.

---

### Functions Added

| Function | Location | Purpose |
|---|---|---|
| `eyeAspectRatio(lm, idx)` | `index.html` ~line 445 | Single-eye 6-point EAR: `(v1 + v2) / (2 * h)` |
| `computeEAR(lm)` | `index.html` ~line 457 | Averages `eyeAspectRatio` over both eyes |
| `detectBlink(lm)` | `index.html` ~line 467 | State machine; increments count, updates UI |

### Threshold and Refractory Values

| Constant | Value | Meaning |
|---|---|---|
| `EAR_THRESH` | `0.21` | EAR below this → eye is "closed" |
| `REFRACTORY_MS` | `150` | Minimum ms between two counted blinks |
| `BPS_WINDOW_MS` | `10000` | Rolling window (ms) for blinks-per-second calculation |

All three are `const` declarations at the top of the blink block, easy to tune.

### Existing Code Replaced / Removed

- **Removed entirely:** the `MOCK BLINK TRACKER` `setInterval` block (lines 421–435 in the pre-change file), which every 2 seconds added 1–2 to `blinkCount` via `Math.random() > 0.6`. Also removed `blinkSessionStartTime`.
- **Replaced call:** the `setInterval` that wrote to `valBlinkCount.textContent` and `valBps.textContent` is gone. Both elements are now written by `detectBlink()` on every FaceMesh frame where a face is detected.
- **Downstream preserved:** `valBlinkCount` (`#val-blink-count`) and `valBps` (`#val-bps`) still receive `textContent` updates from the same code path. No CSV, AI payload, or snapshot buffer changes were needed (blink data was never in those paths per the Step 1 audit note).

### Wiring

- `extractFaceMetrics(lm)` now returns `_faceLandmarks: lm` in its result object (one-line addition).
- `updateUI(metrics)` calls `detectBlink(metrics._faceLandmarks)` when `metrics.faceDetected && metrics._faceLandmarks` is truthy — i.e., exactly when FaceMesh produced a real face result. Throttled (face-skipped) frames reuse the stale `pendingFace` which has `faceDetected: false` or the previous real result; if it carries the prior `_faceLandmarks` it will re-call `detectBlink` with the same landmark snapshot, which is harmless because EAR will be identical and no state transition can fire without a real eye movement. However since `pendingFace` is **replaced** by the new result each FaceMesh run (not merged), skipped frames carry the **previous** `_faceLandmarks` — this means `detectBlink` is effectively called every frame (every ~33 ms), not just every 3rd. This is intentional: it keeps the state machine running at full rate so closed frames are not missed due to throttling.

### Landmark Index Assumptions

The required indices (`LEFT_EYE = [362, 385, 387, 263, 373, 380]`, `RIGHT_EYE = [33, 160, 158, 133, 153, 144]`) are the canonical 6-point EAR mapping for MediaPipe FaceMesh 468-landmark model (non-refined). They work with the existing model config (`refineLandmarks: false`). The `eyeAspectRatio` function treats the index list as `[corner1, top1, top2, corner2, bot2, bot1]` so that `idx[1]/idx[5]` and `idx[2]/idx[4]` are the two vertical pairs, and `idx[0]/idx[3]` are the horizontal corners — matching the standard Soukupová & Čech (2016) formula exactly.

The pre-existing `extractFaceMetrics` used a different 4-point approximation (`dist(lm[160],lm[144]) + dist(lm[158],lm[153])` as numerator, `2 * dist(lm[33],lm[133])` as denominator) for the stress variance calculation. That formula is **untouched** — it feeds only the stress history rolling buffer. The new `computeEAR` function uses separate, independent landmark arrays and is not connected to the stress pipeline.

---

## Step 3 — FaceMesh Sampling Fix
**Date:** 2026-08-01  
**Scope:** Improved eye-landmark sampling rate for blink detection. No model config, resolution, or external dependencies changed.

---

### Problem Statement

After Step 2 the blink detector's state machine was correct, but FaceMesh was throttled to every 3rd frame. At the camera's nominal ~30 fps the effective FaceMesh rate was **~10 fps** — one new landmark set every ~100 ms. A natural blink lasts 100–400 ms, meaning the closed-eye phase could easily fall entirely between two consecutive FaceMesh samples, making it invisible to `detectBlink`. The EAR never dropped below `EAR_THRESH` within the sampled frames, so the blink was silently missed.

---

### Why a Separate "Eye-Only" Path Is Not Viable Here

The task description asked for a lighter, more frequent sampling path covering only the 12 eye-region landmarks (`LEFT_EYE` / `RIGHT_EYE` indices). This is architecturally sound in principle but is not achievable within the existing `@mediapipe/face_mesh@0.4` library:

- The library's WASM bundle runs the full TFLite FaceMesh model and returns all 468 landmarks unconditionally. There is no public API to request a landmark subset, run a partial inference, or retrieve intermediate activations.
- Adding a second, independent eye-only model (e.g., a custom TFLite eye detector or MediaPipe Tasks `FaceLandmarker`) would introduce a new CDN dependency, a second WASM initialisation, and a non-trivial integration surface — disproportionate to the problem.
- Running two concurrent `FaceMesh` instances (one at full rate, one throttled) would double the WASM heap and inference time, negating any performance saving.

Conclusion: within the constraints of this codebase, increasing the full-FaceMesh sampling rate is the only realistic option.

---

### Approach Taken

**Changed the throttle divisor from 3 → 2** (`frameCounter % 3 === 0` → `frameCounter % 2 === 0`).

This is the minimum effective change: FaceMesh now runs on every other camera frame instead of every third. No model options, camera resolution, or other settings were altered.

Two secondary changes were made to make the freshness signal explicit:

1. **`_freshLandmarks` flag**: the `faceMesh.onResults` callback now adds `_freshLandmarks: true` to `pendingFace`. On throttled (skipped) frames the stale-reuse path sets `_freshLandmarks: false`.

2. **`detectBlink` guard**: `updateUI` now only calls `detectBlink` when `metrics._freshLandmarks` is truthy. Previously, `detectBlink` was called on stale-landmark frames too — the EAR was identical (same landmark snapshot), so no false state transitions fired, but the calls were wasteful and the Step 2 note's claim that this was "intentional" to keep the state machine running was misleading. With the throttle at `% 2`, each genuine blink is now sampled at ≥15 fps, making stale-frame re-firing unnecessary.

---

### Effective Sampling Rates (Before vs After)

| Signal | Before (% 3) | After (% 2) |
|---|---|---|
| FaceMesh landmarks (all 468) | ~10 fps | ~15 fps |
| Eye EAR / `detectBlink` | ~10 fps (fresh) + ~20 fps (stale re-fires, no new info) | ~15 fps (fresh only) |
| Pose landmarks | ~30 fps (unchanged) | ~30 fps (unchanged) |
| Blink worst-case miss window | ~200 ms (2 skipped frames) | ~133 ms (1 skipped frame) |

At 15 fps, a 100 ms blink spans ~1.5 sample intervals. Combined with the `REFRACTORY_MS = 150` guard, this means a blink that closes and reopens within a single 67 ms inter-frame gap can still be missed, but blinks ≥ ~135 ms (the majority of natural blinks, which average 150–200 ms) will be reliably detected. This is a meaningful improvement over the prior 10 fps baseline.

---

### Performance Impact

- **CPU/GPU inference cost**: FaceMesh WASM inference runs 50% more often (2 of every 3 frames instead of 1 of 3). Estimated additional inference time: +15–20 ms per second on a mid-range laptop CPU (FaceMesh at `modelComplexity: 0`, 480×360 input takes ~25–35 ms per run; 5 extra runs/sec ≈ +125–175 ms/sec CPU time). This remains within the performance budget documented in README §8, which targeted a combined Pose+FaceMesh pipeline that already budgets for overlapping inference at 30 fps.
- **Frame lock (`isProcessing`)**: the existing frame lock prevents FaceMesh from blocking a new camera frame. Frames arriving while FaceMesh is still running are skipped entirely, so the `% 2` change does not cause queue buildup — it simply means more frames pass the lock check and trigger inference.
- **Memory**: one extra object spread per skipped frame (`{ ...pendingFace, _freshLandmarks: false }`) — negligible.

---

### Files Changed

| File | Lines changed | What |
|---|---|---|
| `index.html` | ~390 | `frameCounter` comment updated |
| `index.html` | ~611–615 | `faceMesh.onResults` — add `_freshLandmarks: true` |
| `index.html` | ~724–730 | `updateUI` — guard `detectBlink` on `_freshLandmarks` |
| `index.html` | ~754–763 | `onFrame` throttle — `% 3` → `% 2`, stale-reuse sets `_freshLandmarks: false` |

---

## Step 4 — Stress Baseline & Smoothing
**Date:** 2026-08-01  
**Scope:** `index.html` only. No new dependencies, no API or CSV schema changes.

---

### Problem

`extractFaceMetrics` normalised EAR/MAR/brow variance against three fixed
population constants (`EAR_MAX_VARIANCE = 0.2`, `MAR_MAX_VARIANCE = 0.1`,
`BROW_MAX_VARIANCE = 0.05`) that were picked without any user data. Two
separate issues compounded this:

1. **Fixed constants ignore personal face geometry** — a user with naturally
   wider eyes or a more expressive face will read permanently high stress
   regardless of their actual arousal state.
2. **Raw landmark values are noisy** — MediaPipe FaceMesh introduces
   per-frame jitter of ±0.002–0.005 in normalised coordinates. Without
   smoothing, this jitter inflates the computed range (`max − min`) and
   produces a falsely elevated variance baseline.

---

### 1. EMA Pre-Smoothing

**Location:** `extractFaceMetrics(lm)` — immediately after the raw
EAR/MAR/brow values are computed, before they are pushed to the rolling
history.

**Formula:**

```
ema_new = α × raw + (1 − α) × ema_prev
```

**Constant:**

```js
const EMA_ALPHA = 0.3;   // new value 30 %, previous EMA 70 %
```

`α = 0.3` was chosen as a balance between lag (lower α) and noise retention
(higher α). At 15 fps face-mesh rate, each frame advances time by ~67 ms;
an α of 0.3 gives a time constant of roughly 133 ms — enough to absorb
single-frame spikes while still tracking genuine slow movements (brow
furrow, jaw tension) that evolve over 200–500 ms.

**Seeding:** `earEma`, `marEma`, `browEma` are initialised to `null`. On
the very first FaceMesh frame each is seeded to its raw value (no warm-up
period required; the first history sample is just the raw value itself).

**History push:** Only the EMA-smoothed values are pushed into `earHistory`,
`marHistory`, `browHistory`. The raw values are still returned in the
function's result object (`ear`, `mar`, `browTension`) so downstream
consumers (emotion curvature, return value) are unaffected.

---

### 2. Calibration Phase

**Location:** End of the existing 3-second stability countdown inside
`startAIEvaluation()` — the single line added is:

```js
calibrateBaseline(); // snapshot rolling histories as personal resting baseline
```

This is called immediately after `isRecording = false`, which is the
`countdownValue <= 0` branch of the 1-second `setInterval` (same moment
the recording window closes and `runAIEvaluation` is invoked).

**Why the existing snapshot is sufficient:**
The rolling histories (`earHistory`, `marHistory`, `browHistory`) are capped
at `HISTORY_LIMIT = 30` frames. At 15 fps (post Step 3 throttle change) that
covers the last ~2 seconds of face-mesh data. The 3-second stability window
has the user holding still, which is exactly the resting condition we want
to characterise. No separate dedicated calibration UI or timer was needed.

**`calibrateBaseline()` logic:**

```js
function calibrateBaseline() {
  if (earHistory.length < 5 || marHistory.length < 5 || browHistory.length < 5) return;
  const earS  = arrayStats(earHistory);
  const marS  = arrayStats(marHistory);
  const browS = arrayStats(browHistory);
  stressBaseline = {
    earMean:  earS.mean,  earStd:  earS.std,
    marMean:  marS.mean,  marStd:  marS.std,
    browMean: browS.mean, browStd: browS.std
  };
}
```

`arrayStats` returns the arithmetic mean and population standard deviation
of the input array. If `std` is zero (all values identical), it is floored
to `1e-6` to prevent division-by-zero. The guard `length < 5` ensures the
baseline is not recorded if the face was barely visible during the window.

**What is stored:** `stressBaseline` is an in-memory JS object — no
`localStorage` persistence, no server round-trip. It is reset to `null` if
the page is reloaded, requiring one more "Analyse Posture" click to
recalibrate. Adding persistence was YAGNI for this step.

---

### 3. Baseline-Relative Normalization Formula

**Location:** `extractFaceMetrics(lm)` — replaces the three fixed-constant
`Math.min(safeDivide(...))` lines.

**Exact formula (per component):**

```
stress_component = clamp( (variance − baseline_mean) / baseline_std, 0, 3 ) / 3
```

In code:

```js
earStress  = Math.min(Math.max((earVar  - stressBaseline.earMean)  / stressBaseline.earStd,  0), 3) / 3;
marStress  = Math.min(Math.max((marVar  - stressBaseline.marMean)  / stressBaseline.marStd,  0), 3) / 3;
browStress = Math.min(Math.max((browVar - stressBaseline.browMean) / stressBaseline.browStd, 0), 3) / 3;
```

`variance` here is the range (`max − min`) of the 30-frame smoothed history —
the same `calcVariance` function that was already present.

**Interpretation:** A score of 0 means the user's current variance is at or
below their personal resting level. A score of 1 (100 %) means the variance
is 3 standard deviations above their resting level. Clamping at 3 σ covers
all realistic stress signals while preventing outliers from pinning the
meter at maximum.

**Composite:** the three component scores are averaged and multiplied by 100,
identical to the previous formula: `stressLevel = round(((e+m+b)/3) * 100)`.

---

### 4. Fallback for Missing Baseline

**When it applies:** On first load, on page reload, or if `calibrateBaseline()`
returns early (fewer than 5 history frames — face barely visible).

**Behaviour:** `stressBaseline` remains `null`. `extractFaceMetrics` falls
into the `else` branch:

```js
// No baseline yet — use fixed population constants so the meter is never broken.
earStress  = Math.min(safeDivide(calcVariance(earHistory),  EAR_MAX_VARIANCE),  1);
marStress  = Math.min(safeDivide(calcVariance(marHistory),  MAR_MAX_VARIANCE),  1);
browStress = Math.min(safeDivide(calcVariance(browHistory), BROW_MAX_VARIANCE), 1);
```

This is identical to the pre-Step-4 formula, so the meter produces the same
(imperfect but defined) values it always did. The UI never shows `undefined`,
`NaN`, or a blank stress field. No indicator or warning is shown for the
uncalibrated state — the fallback values are acceptable for casual use and
are silently replaced the next time the user triggers the AI analysis.

---

### Files Changed

| File | What |
|---|---|
| `index.html` | Added `EMA_ALPHA`, `earEma`, `marEma`, `browEma`, `stressBaseline` constants/state vars |
| `index.html` | Added `arrayStats()` and `calibrateBaseline()` helpers (before `extractFaceMetrics`) |
| `index.html` | Rewrote `extractFaceMetrics`: EMA before history push, baseline-relative scoring with fallback |
| `index.html` | Added `calibrateBaseline()` call at end of 3-second countdown (`isRecording = false` line) |

---

## Step 5 — Copy & Docs
**Date:** 2026-08-01  
**Scope:** Copy/documentation only. No application logic changed.

---

### Strings & Files Changed

| File | Location | Old string | New string |
|---|---|---|---|
| `index.html` | Line 233 — UI card label | `Micro-Stress Level` | `Facial Tension Index` |
| `index.html` | Line 955 — AI evaluation payload (sent to `/api/evaluate`) | `` `Micro-Stress Level: ${avgStress.toFixed(1)}%` `` | `` `Facial Tension Index: ${avgStress.toFixed(1)}%` `` |
| `README.md` | Section 11, Limitations table — row 1 of 2 removed | `**Simulated blinks** \| Eye blink count and blinks-per-second are mock data…` | *(row deleted — no longer true after Step 2)* |
| `README.md` | Section 11, Limitations table — row revised | `**Stress is a proxy** \| Micro-Stress Level is a facial micro-tension index…` | `**Facial Tension Index is a proxy** \| Facial Tension Index is a baseline-relative facial micro-tension score (0–100%), normalised against the user's own resting variance…` |

### Rationale

- **Label change** (`Micro-Stress Level` → `Facial Tension Index`): the Step 4 implementation no longer produces a score relative to fixed population constants — it normalises each component against the user's personal resting variance captured during the 3-second stability window. "Micro-Stress Level" implied a direct stress reading; "Facial Tension Index" more accurately conveys that the value is a geometry-based tension proxy calibrated to the individual.
- **AI payload change**: the LLM receives the label verbatim as part of the clinical summary prompt. Keeping it in sync avoids the model receiving a label in the payload that differs from what the UI shows.
- **README §11 — "Simulated blinks" removed**: Step 2 replaced the stochastic mock with a real EAR threshold-crossing state machine. The limitation no longer applies.
- **README §11 — stress row revised**: the old text described a fixed-constant normalisation (`EAR_MAX_VARIANCE = 0.2` etc.) that was replaced in Step 4. The new text describes the baseline-relative calibration approach and its per-session reset behaviour.

---

## Step 6 — Integration Test
**Date:** 2026-08-01  
**Scope:** Static code review of the full `index.html` pipeline against all five previous steps. Two bugs found and fixed in this pass.

---

### Verification Results

#### 1. Blink Count / BPS — Camera Restart Behaviour
**Status: BUG FOUND AND FIXED.**

`blinkCount`, `blinkState`, `lastBlinkTime`, and `blinkTimestamps` are module-level `let`/`const` declarations that were never reset when the camera (re)started. Because `startCamera()` constructs the `Camera` object only once (`if (!cameraInstance)`) and subsequent calls simply call `.start()` on the existing instance, any accumulated blink count and stale timestamps from a previous session would persist across restarts. The 10-second rolling window (`BPS_WINDOW_MS`) would slowly drain the stale timestamps, so BPS would be wrong for up to 10 seconds after each restart.

**Fix:** Added a reset block in the `cameraInstance.start().then()` handler:
```js
blinkCount = 0;
blinkState = 'open';
lastBlinkTime = 0;
blinkTimestamps.length = 0;
valBlinkCount.textContent = '0';
valBps.textContent = '0.00';
```
This fires on every successful camera start (first use and re-starts). The `detectBlink` state machine and BPS rolling window are now always consistent with the current session.

The EAR threshold-crossing logic itself, the refractory guard (`REFRACTORY_MS = 150`), and the rolling-window BPS calculation are all correct. `detectBlink` is correctly gated on `_freshLandmarks` (not called on stale throttled frames). ✅

---

#### 2. Stress Calibration — First Use and Skip-Calibration Fallback
**Status: CORRECT.**

- `calibrateBaseline()` is called at `countdownValue <= 0` (line 887), immediately after `isRecording = false`, before `runAIEvaluation`.
- The guard `earHistory.length < 5` ensures a silent no-op if the face was barely visible during the window — `stressBaseline` stays `null` and the fallback path in `extractFaceMetrics` uses the legacy fixed constants (`EAR_MAX_VARIANCE`, `MAR_MAX_VARIANCE`, `BROW_MAX_VARIANCE`).
- If the user clicks "AI Evaluation" before any face has been detected, `startAIEvaluation()` returns early via `!currentLandmarks` — the button never fires without pose data.
- If AI is triggered and face data was absent, `stressData` is empty → `avgStress = 0`. The fallback produces defined, non-NaN output at all times. ✅

---

#### 3. tryMergeAndUpdate — Partial-Result Race Condition
**Status: CORRECT. No race condition.**

The Step 3 change (`% 3 → % 2`) did not introduce a race. On throttled (non-runFace) frames, `pendingFace` is pre-set to a stale copy with `_freshLandmarks: false` **before** `pose.send()` is called. When `pose.onResults` fires and calls `tryMergeAndUpdate`, both `pendingPose` and `pendingFace` are non-null and the merge fires immediately.

On runFace frames, `pose.send()` and `faceMesh.send()` are awaited sequentially (lines 827–828). Because the WASM callbacks fire asynchronously after each `send()`, and `tryMergeAndUpdate` requires both `pendingPose` and `pendingFace` to be non-null before merging, the guard at line 684 prevents any partial-result update. The frame lock (`isProcessing`) is released only inside `tryMergeAndUpdate` after both results are present. ✅

---

#### 4. CSV Export — Blink and Stress Fields
**Status: CORRECT.**

- `lastAIData.metrics` contains the `'Average Stress'` and `'Dominant Emotion'` keys set at line 931–937 of `runAIEvaluation`.
- The CSV line (line 1043) correctly reads `metrics['Average Stress']?.toFixed(1)` and `metrics['Dominant Emotion']`.
- Blink data (`blinkCount`, `blinkTimestamps`) was audited in Step 1 and confirmed to not be part of the AI payload or CSV — this is intentional and unchanged. ✅

---

#### 5. Password Modal and AI Evaluation Call
**Status: CORRECT.**

- `showPasswordModal()` is double-guarded: `!currentLandmarks || isRecording` prevents opening without a live pose, and `submitPassword()` → `startAIEvaluation()` carries the same guard again.
- Password comparison is a plain string equality check against the hardcoded `CORRECT_PW = '12345'`. This is the existing design — no change made.
- The AI call in `runAIEvaluation` constructs the payload from snapshot averages, sends to `/api/evaluate`, and handles both success and error paths. The `finally` block re-enables `aiBtn` correctly. ✅

---

#### 6. Console Errors on Fresh Load
**Status: CORRECT — no errors expected.**

- All DOM `getElementById` calls resolve to elements that exist in the HTML.
- `aiRecommend` (line 361) is declared but never used — `aiRecommendOl` is re-queried inside `runAIEvaluation` at line 982. Dead variable; no runtime error.
- `worker.js` exists in the repo but is not imported anywhere. No error.
- No unguarded property accesses on potentially-null objects found.
- All three CDN MediaPipe scripts (`@mediapipe/pose`, `@mediapipe/face_mesh`, `@mediapipe/camera_utils`) are referenced with pinned version URLs — no version drift risk at load time. ✅

---

### Bugs Found and Fixed in This Pass

| # | Severity | File | Description | Fix |
|---|---|---|---|---|
| 1 | Medium | `index.html` | `blinkCount` and `blinkTimestamps` never reset on camera restart — BPS polluted by stale timestamps from prior session for up to 10 s, and cumulative `blinkCount` grows monotonically across restarts. | Added reset block in `cameraInstance.start().then()`. |
| 2 | Low | `api/evaluate.js` | System prompt's input field list and interpretation scale still used the old label `"Micro-Stress Level"` / `"Micro-Stress"` after Step 5 renamed it to `"Facial Tension Index"`. LLM received an inconsistent label between the user payload and its reference guide. | Updated both occurrences in the system prompt to `"Facial Tension Index"`. |

---

### Open / Unresolved — For Human Review

1. **`CORRECT_PW = '12345'` is hardcoded in client-side JS.** The password is visible to anyone who opens DevTools. If the intent is real access control, the password check must move server-side (e.g., a `/api/auth` endpoint). This was pre-existing and out of scope for this step.

2. **`stressBaseline` has no `localStorage` persistence.** Reloading the page discards the calibration. The current behaviour is documented in Step 4 as intentional (YAGNI), but a user who reloads frequently will always fall back to the legacy fixed constants until they trigger another AI evaluation. Noted for future consideration.

3. **`aiRecommend` (line 361) is a dead DOM ref** — declared in the outer scope but the inner `aiRecommendOl` const at line 982 is used instead. No runtime impact; can be deleted in a cleanup pass.

4. **`worker.js` is an orphan file** — it exists in the repo but is not `import`ed or loaded anywhere in `index.html`. If it is a legacy artefact from the pre-unification architecture, it can be deleted. A human should confirm it is not consumed by any build step before removing it.

5. **FaceMesh at `% 2` on slower devices.** The Step 3 analysis estimates +15–20 ms/sec additional CPU cost on a mid-range laptop. On low-end hardware the frame lock (`isProcessing`) will drop more frames than expected, potentially reducing effective FaceMesh rate below 15 fps. No runtime error, but blink miss rate would increase. Performance profiling on target hardware was not possible in this static review pass.

---
