<div align="center">

# 🦴 MediaSpine — Clinical AI Posture Scanner

**A real-time, browser-native biomechanical screening platform built for the SpineSafe NGO.**  
No installation. No server runtime. Just open the page, face your camera, and receive a clinical-grade posture report powered by computer vision and large language model inference.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-mediaspine.vercel.app-6366f1?style=for-the-badge)](https://mediaspine.vercel.app)
[![GitHub](https://img.shields.io/badge/Source-LaSserafim%2Fmediaspine-24292e?style=for-the-badge&logo=github)](https://github.com/LaSserafim/mediaspine)
[![Vercel](https://img.shields.io/badge/Hosted%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

</div>

---

## Table of Contents

1. [Mission & Context](#1-mission--context)
2. [System Architecture](#2-system-architecture)
3. [File Structure](#3-file-structure)
4. [How It Works — Full Pipeline](#4-how-it-works--full-pipeline)
   - [4.1 Camera Initialisation](#41-camera-initialisation)
   - [4.2 Frame Loop & Frame Lock](#42-frame-loop--frame-lock)
   - [4.3 FaceMesh Throttling](#43-facemesh-throttling)
   - [4.4 Pose Metric Extraction](#44-pose-metric-extraction)
   - [4.5 Face Metric Extraction](#45-face-metric-extraction)
   - [4.6 Merge & UI Update](#46-merge--ui-update)
   - [4.7 3-Second Stability Snapshot](#47-3-second-stability-snapshot)
   - [4.8 Password Gate](#48-password-gate)
   - [4.9 Groq AI Evaluation (Serverless Proxy)](#49-groq-ai-evaluation-serverless-proxy)
   - [4.10 Result Rendering](#410-result-rendering)
   - [4.11 CSV Export](#411-csv-export)
5. [Biomechanical Metrics — Deep Dive](#5-biomechanical-metrics--deep-dive)
6. [AI Clinical Assessment — The Prompt Design](#6-ai-clinical-assessment--the-prompt-design)
7. [Security Model](#7-security-model)
8. [Performance Optimisations](#8-performance-optimisations)
9. [Tech Stack](#9-tech-stack)
10. [Deployment Guide](#10-deployment-guide)
11. [Known Conditions & Limitations](#11-known-conditions--limitations)
12. [Future Prospects](#12-future-prospects)
13. [Disclaimer](#13-disclaimer)

---

## 1. Mission & Context

MediaSpine was created under the **SpineSafe NGO Platform**, whose mission is to reduce study-induced spinal strain among students. Prolonged sitting, screen use, and poor ergonomics are leading causes of chronic neck and back pain in young people — yet clinical posture screening is expensive and inaccessible for most.

MediaSpine addresses this by:

- Running **entirely in the browser** — no app install, no data upload, no specialist equipment
- Using a standard **laptop or phone webcam** as the sensor
- Providing a **clinical-quality biomechanical report** via AI without a physiotherapist in the room
- Being **free and open source**, deployable in seconds to any Vercel project

The target users are students, office workers, educators, and school health programs operating with minimal budget.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  Webcam → MediaPipe Pose (WASM) ─────┐                         │
│                                      ├──► Merge → UI Update    │
│  Webcam → MediaPipe FaceMesh (WASM) ─┘                         │
│                                                                 │
│  [AI Evaluate Button] → Password Modal → 3s Snapshot           │
│          │                                                      │
│          ▼                                                      │
│   POST /api/evaluate  { payload: "metrics string" }            │
└───────────────────────────┬─────────────────────────────────────┘
                            │  (no API key in browser)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             Vercel Serverless Function (api/evaluate.js)        │
│                                                                 │
│   Reads GROQ_API_KEY from environment variable                  │
│   Injects MediaSpine Clinical AI system prompt                  │
│   Forwards to api.groq.com → llama-3.3-70b-versatile           │
│   Returns parsed JSON to browser                                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
         { summary, severity, current_issues,
           future_risks, recommendations[] }
```

The key architectural decision is the **split between client and server**: all vision processing runs locally in the browser (no video data leaves the device), while only the derived numerical metrics are sent to the serverless function to call the LLM. This preserves user privacy.

---

## 3. File Structure

```
mediaspine/
├── index.html          # Entire client application (HTML + CSS + JS, ~990 lines)
├── api/
│   └── evaluate.js     # Vercel serverless function — Groq API proxy
├── .env.local          # Local dev API key (gitignored, never committed)
├── .gitignore          # Excludes .env*, .DS_Store, *.log
└── README.md           # This file
```

> The project is intentionally a **single-file frontend**. There is no build step, no bundler, no `node_modules` at the client level. The only server-side code is the 153-line `api/evaluate.js` function.

---

## 4. How It Works — Full Pipeline

### 4.1 Camera Initialisation

When the user clicks **Start Camera**, `startCamera()` is called. It creates a single `Camera` instance from MediaPipe's Camera Utils library, pointing at the user's `facingMode: 'user'` webcam at **480×360 resolution** (deliberately reduced from the original 640×480 to halve WASM inference time).

```js
cameraInstance = new Camera(video, {
  facingMode: 'user',
  width:  480,
  height: 360,
  onFrame: async () => { ... }
});
```

Both MediaPipe models (`Pose` and `FaceMesh`) are initialised once at page load — not inside `startCamera()` — so their WASM binaries are already compiled by the time the first frame arrives.

```js
const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/.../${f}` });
pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, ... });

const faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/.../${f}` });
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: false, ... });
```

`modelComplexity: 0` is the lightest pose model (BlazePose Lite), chosen for real-time performance. `refineLandmarks: false` disables the iris tracking in FaceMesh, which is unnecessary for this application and expensive.

---

### 4.2 Frame Loop & Frame Lock

The `onFrame` callback fires on every camera frame. A **frame lock** (`isProcessing`) prevents overlapping inference calls, which would cause WASM memory contention and crash:

```js
onFrame: async () => {
  if (isProcessing) return;                    // drop frame if busy
  if (video.videoWidth === 0) return;          // skip uninitialised frames

  isProcessing = true;
  frameCounter++;

  await pose.send({ image: video });           // always runs
  if (runFace) await faceMesh.send({ image: video }); // conditional (see §4.3)
}
```

The lock is released inside `tryMergeAndUpdate()` only after **both** model result callbacks have fired — not immediately after `.send()`. This ensures the UI is never updated with a partial (half-Pose, half-FaceMesh) result.

---

### 4.3 FaceMesh Throttling

FaceMesh is the heavier model. Running it on every frame at 30fps saturates the main thread and creates visible tracking lag. The fix is a **3-frame throttle**: FaceMesh runs only on frames where `frameCounter % 3 === 0`, while Pose runs every frame.

```js
const runFace = (frameCounter % 3 === 0);
if (!runFace) pendingFace = pendingFace ?? { faceDetected: false };
```

On skipped frames, `pendingFace` is pre-populated with the last known result (or a neutral fallback), so `tryMergeAndUpdate()` can fire immediately after Pose completes. This keeps the skeleton overlay smooth at ~30fps while FaceMesh runs at ~10fps — sufficient for facial metric accuracy since the human face does not change meaningfully at sub-100ms intervals.

---

### 4.4 Pose Metric Extraction

`extractPoseMetrics(landmarks)` takes the 33 MediaPipe Pose landmarks and computes two different measurement sets depending on camera angle:

**Profile view** (shoulder width < 0.15 normalised units — user is side-on):
```
Neck Deviation Angle = atan( |ear.x − shoulder.x| / |ear.y − shoulder.y| ) × (180/π)
```
This measures how far the ear has shifted forward relative to the shoulder — the primary indicator of forward head posture.

**Frontal view** (shoulder width ≥ 0.15 — user faces the camera):
```
Shoulder Tilt = |leftShoulder.y − rightShoulder.y| × 100
Head Tilt     = |leftEye.y − rightEye.y| × 100
```
These detect bilateral asymmetries in shoulder height and head levelling. The ×100 scale factor converts the normalised 0–1 coordinate space to a 0–100 range for readability.

The function returns `null` for metrics that are not applicable to the current camera angle, and the UI handles this gracefully by displaying `--°`.

---

### 4.5 Face Metric Extraction

`extractFaceMetrics(landmarks)` uses the 468 FaceMesh landmarks to compute three biometric signals:

**Eye Aspect Ratio (EAR)** — measures eyelid aperture. Computed as the ratio of vertical eye opening to horizontal eye width for both eyes, then averaged:
```
EAR = (vertical_open_top + vertical_open_bottom) / (2 × horizontal_width)
```
High EAR variance over the 30-frame rolling window indicates frequent eye-width changes — a proxy for blinking and fatigue.

**Mouth Aspect Ratio (MAR)** — measures lip separation relative to mouth width:
```
MAR = dist(upper_lip, lower_lip) / mouth_width
```
High MAR variance correlates with jaw clenching and relaxation cycles, a known stress response.

**Brow Tension** — Euclidean distance between the inner brow landmarks (lm[55] and lm[285]). Brow furrows narrow this distance; elevated brow tension correlates with cognitive strain and frustration.

**Micro-Stress Level (0–100%)** is the composite of all three:
```
stress = ((EAR_variance/0.2) + (MAR_variance/0.1) + (Brow_variance/0.05)) / 3 × 100
```
Each component is normalised against a maximum expected variance and capped at 1.0 before averaging.

**Emotion** is determined by mouth curvature — the difference in Y-position between the mouth centre and the mouth corners:
- `curvature > 0.015` → **Happy** (corners raised relative to centre)
- `curvature < -0.005` → **Tense/Sad** (corners pulled down)
- Otherwise → **Neutral**

---

### 4.6 Merge & UI Update

`tryMergeAndUpdate()` waits for both `pendingPose` and `pendingFace` to be non-null, then merges them into a single `latestMetrics` object:

```js
const merged = { ...pendingPose, ...pendingFace };
pendingPose  = null;
// pendingFace intentionally kept alive for throttled-frame reuse
isProcessing = false;
updateUI(merged);
```

`updateUI(merged)` then:
1. Resizes the canvas to match `video.videoWidth × video.videoHeight`
2. Draws the skeleton overlay (connections as strokes, landmarks as filled circles)
3. Updates all 8 biometric cards in the dashboard
4. Applies the `.good` / `.bad` CSS class to the main angle display based on posture thresholds
5. Appends data to recording buffers if `isRecording` is active

The skeleton uses landmark indices from the `CONNECTIONS` array — a hand-curated subset of the 33 Pose landmarks covering the upper body (shoulders, arms, spine region, and face outline).

---

### 4.7 3-Second Stability Snapshot

When the AI evaluation is triggered (after password verification), `startAIEvaluation()` runs a 3-second countdown. During this window, `isRecording = true` causes `updateUI()` to append every frame's data to five recording buffers:

| Buffer | Captures | Used to compute |
|---|---|---|
| `shoulderYData` | Y-position of shoulder midpoint | Shoulder Stability (range of motion variance) |
| `noseXData` + `noseYData` | Nose tip position | Head Stability (max positional drift) |
| `stressData` | Per-frame stress level | Average Stress over the 3 seconds |
| `emotionData` | Per-frame emotion label | Dominant Emotion (mode of all frames) |

After 3 seconds, the buffers are reduced to single summary values and passed to `runAIEvaluation()`. Stability is expressed as range (max − min), so a higher number means more movement — i.e., poorer postural control.

---

### 4.8 Password Gate

Clicking "Take Snapshot & AI Evaluation" does not immediately start the evaluation. It opens a **custom modal overlay** (`#pw-modal`) styled with glassmorphism and a blurred backdrop. The user must type the access password (`12345`) to proceed.

This gate serves a dual purpose: it prevents accidental AI calls (which consume Groq API credits) and provides a lightweight access control layer for shared/kiosk deployments. Wrong passwords display an inline error; the correct password closes the modal and calls `startAIEvaluation()`. The modal also dismisses on backdrop click and supports keyboard `Enter` submission.

The password is intentionally hardcoded in plain JS — this is **not a security mechanism** against determined attackers (it is a UX friction layer). Real access control would require server-side session management.

---

### 4.9 Groq AI Evaluation (Serverless Proxy)

`runAIEvaluation()` assembles the summarised metrics into a human-readable string:

```
"Shoulder Tilt: 3.2°, Head Tilt: 1.8°, Shoulder Stability: 0.04 variance,
Head Stability: 0.02 variance, Micro-Stress Level: 47.3%, Facial Emotion: Tense/Sad"
```

This string is sent as a `POST` to `/api/evaluate` — the Vercel serverless function. The browser never directly contacts Groq. The serverless function:

1. Reads `process.env.GROQ_API_KEY` (set in the Vercel dashboard, never in code)
2. Validates the request body
3. Constructs a Groq API request using the **MediaSpine Clinical AI system prompt** (see §6)
4. Calls `api.groq.com/openai/v1/chat/completions` with model `llama-3.3-70b-versatile`
5. Returns the raw Groq response to the browser

The model is configured with `response_format: { type: 'json_object' }` to enforce structured JSON output, and `temperature: 0.2` for near-deterministic but naturally varied language.

---

### 4.10 Result Rendering

The browser parses the returned JSON and populates five UI zones:

| JSON field | UI element | Notes |
|---|---|---|
| `summary` | Clinical Summary card (¾ width) | 80-word clinician-style overview |
| `severity` | Severity badge (¼ width) | Colour-coded gradient: green → red |
| `current_issues` | Red card (Current Issues) | Paragraph, exact numbers cited |
| `future_risks` | Orange card (Future Risks) | Short/medium/long-term projection |
| `recommendations` | Green card (Recommendations) | Array of 3, rendered as numbered circles |

The severity badge dynamically applies a CSS gradient class based on the returned value:

| Severity | Gradient |
|---|---|
| Normal | Emerald → Teal |
| Very Mild | Teal → Cyan |
| Mild | Yellow → Amber |
| Moderate | Orange → Amber |
| Moderately Severe | Red → Orange |
| Severe | Red → Rose |

---

### 4.11 CSV Export

`exportReportToCSV()` generates a single-row CSV containing:

```
Timestamp, Severity, Captured Metrics, Summary, Current Issues, Future Risks, Recommendations
```

Recommendations (an array) are joined with ` | ` as a delimiter. All text fields are double-quoted with internal commas replaced by semicolons and internal double-quotes escaped per RFC 4180. The file is downloaded via a temporary `<a>` element with `URL.createObjectURL()`.

---

## 5. Biomechanical Metrics — Deep Dive

### Neck Deviation Angle

Measured only in profile view. Represents the angular offset of the ear from the plumb line through the shoulder. A neutral head position places the ear directly above the shoulder (0°). Every 10° of forward shift approximately doubles the effective weight the cervical spine must support.

| Range | Classification |
|---|---|
| 0–5° | Normal |
| 5–10° | Very Mild |
| 10–15° | Mild |
| 15–20° | Moderate |
| 20°+ | Severe |

### Shoulder Tilt

Measured in frontal view. Represents the height difference between left and right shoulders as a percentage of frame height, scaled ×100. Persistent tilt is associated with asymmetric trapezius loading and can originate from scoliosis, habitual bag-carrying, or mouse-dominant arm posture.

### Head Tilt

Measured in frontal view using inner eye landmarks. A lateral head tilt is often compensatory — if the shoulders tilt one way, the head tilts the opposite way to keep the visual horizon level. Persistent lateral tilt strains the ipsilateral sternocleidomastoid and scalene muscles.

### Shoulder Stability

The range (max − min) of the shoulder midpoint Y-coordinate over the 3-second snapshot. High variance indicates the user shifted, breathed heavily, or struggled to hold still. Low variance indicates good postural endurance. Used in the AI prompt as a proxy for static muscular control.

### Head Stability

The maximum positional drift (either X or Y, whichever is greater) of the nose tip over the 3-second snapshot. Like shoulder stability, this reflects how well the user can hold their head position during a brief assessment window.

### Micro-Stress Level

A composite facial biometric index (0–100%) derived from the rolling variance of EAR, MAR, and brow tension over the last 30 frames. It is not a clinical stress measurement — it is a proxy for visible facial micro-tension. It is most useful in relative terms (e.g., 72% is notably elevated; 18% is calm).

### Detected Emotion

A simplified 3-class label (Happy, Neutral, Tense/Sad) derived from mouth curvature geometry. It is a rough heuristic, not a validated affective computing model. It is included to contextualise the stress score for the AI — a Tense/Sad emotion paired with high stress carries different clinical weight than Neutral with the same stress score.

### Eye Blink Count & Blinks Per Second

These are currently **simulated** (stochastic mock data that updates every 2 seconds when the camera is active). A real blink detector would require EAR threshold crossing detection over time — planned for a future version. The displayed values are therefore informational placeholders only.

---

## 6. AI Clinical Assessment — The Prompt Design

The system prompt that powers the Groq evaluation is ~1,400 words and defines a highly constrained clinical persona called **MediaSpine Clinical AI**. Key design decisions:

**Identity constraints** — The model is explicitly forbidden from acting as a general assistant, ChatGPT, or wellness coach. It is only permitted to interpret the numerical measurements it receives. This prevents hallucinated health advice unrelated to the actual scan.

**Structured JSON output** — The prompt mandates strict JSON with exactly five keys (`summary`, `severity`, `current_issues`, `future_risks`, `recommendations`). The `response_format: json_object` API parameter enforces this at the model level, eliminating the need for output parsing heuristics.

**Uniqueness rule** — The most important single directive: *"Your analysis MUST be unique for every combination of measurements."* Without this, LLMs tend to produce template-like responses with only the numbers swapped in. The instruction forces the model to construct the narrative around the specific data, not around a stored template.

**Severity rubric** — The six severity levels (Normal → Severe) are defined and must be derived from ALL metrics together, not any single angle. This prevents over-alarming a user with a high neck angle if all other indicators are healthy.

**Writing style** — The model is instructed to sound like "an experienced physiotherapist speaking directly to an intelligent patient" — natural, direct, jargon-light, and clinically grounded. It is explicitly prohibited from apologising, adding disclaimers, or recommending a doctor unless measurements are extreme.

**Recommendation specificity** — Each of the three recommendations must include the exact muscle group, how to perform the exercise, duration, frequency, and a direct link back to the user's specific measurement values. Generic advice is explicitly banned.

---

## 7. Security Model

| Concern | Approach |
|---|---|
| API key exposure | Key stored only in Vercel environment variables, never in any committed file |
| Inspect-element key theft | Browser never receives the key — all LLM calls are proxied via `/api/evaluate` |
| Accidental API spend | Password gate prevents unintentional AI evaluation triggers |
| Video data privacy | No video frames leave the user's device — only derived numerical metrics are transmitted |
| `.env` key leakage | `.env*` pattern in `.gitignore` prevents any env file from being committed |

> **Note**: The password `12345` is a UX friction layer, not a cryptographic access control. It prevents casual misuse but not a determined user reading the client-side JS source.

---

## 8. Performance Optimisations

| Optimisation | Impact |
|---|---|
| Camera resolution 480×360 (down from 640×480) | ~44% fewer pixels per frame processed by WASM |
| FaceMesh throttled to every 3rd frame | ~66% reduction in FaceMesh inference calls |
| Frame lock (`isProcessing`) | Eliminates WASM memory contention from overlapping sends |
| `modelComplexity: 0` (BlazePose Lite) | Fastest pose model, sufficient for upper-body landmarks |
| `refineLandmarks: false` (FaceMesh) | Disables iris tracking, reducing FaceMesh compute by ~20% |
| `enableSegmentation: false` (Pose) | Disables background segmentation mask, not needed here |
| DOM diffing for angle/class updates | `lastAngleStr` and `lastClass` prevent unnecessary DOM writes |
| Single `beginPath()` for full skeleton | Batches all segment draws into one GPU call instead of N calls |

---

## 9. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Computer Vision | MediaPipe Pose | 0.5.1675469404 (CDN) |
| Computer Vision | MediaPipe FaceMesh | 0.4.1633559619 (CDN) |
| Camera Utilities | MediaPipe Camera Utils | 0.3.1675466862 (CDN) |
| UI Framework | Tailwind CSS | CDN (Play CDN) |
| AI Model | Groq — `llama-3.3-70b-versatile` | Temperature 0.2, JSON mode |
| Serverless | Vercel Functions (Node.js) | `api/evaluate.js` |
| Hosting | Vercel | Zero-config static + serverless |
| Source Control | GitHub | `LaSserafim/mediaspine` |

---

## 10. Deployment Guide

### Prerequisites
- A [Vercel](https://vercel.com) account linked to your GitHub
- A [Groq](https://console.groq.com) account with an API key

### Steps

**1. Fork / clone the repository**
```bash
git clone https://github.com/LaSserafim/mediaspine.git
cd mediaspine
```

**2. Set up local development**
```bash
# Install Vercel CLI globally (once)
npm i -g vercel

# Create local env file
echo "GROQ_API_KEY=your_key_here" > .env.local

# Run locally (serves both static files and /api/* functions)
vercel dev
```

**3. Add the environment variable on Vercel**

Go to: `vercel.com → mediaspine → Settings → Environment Variables`

| Key | Value | Environments |
|---|---|---|
| `GROQ_API_KEY` | `gsk_...` | Production, Preview |

**4. Deploy**

Push to `main` — Vercel auto-deploys every commit. No build step required.

---

## 11. Known Conditions & Limitations

| Limitation | Details |
|---|---|
| **2D webcam only** | All measurements are derived from 2D projections. Depth is inferred, not measured. Camera angle and distance heavily affect reading accuracy. |
| **Single person** | The pipeline is calibrated for one person in the frame. Multiple people will produce unpredictable results. |
| **Lighting sensitivity** | MediaPipe models degrade in poor lighting, strong backlighting, or extreme colour temperatures. |
| **Profile vs. frontal switch** | The code switches metric modes based on shoulder width. Intermediate angles (45°) produce neither clean profile nor frontal readings. |
| **Facial Tension Index is a proxy** | Facial Tension Index is a baseline-relative facial micro-tension score (0–100%), normalised against the user's own resting variance captured during the 3-second stability window. It is not a physiological stress measurement and should be read as a supporting signal, not a primary clinical output. The baseline resets on every page reload; the first "Analyse Posture" click after a reload uses legacy fixed-constant fallback values until calibration completes. |
| **Model cold start** | On first load, WASM binary compilation takes 3–8 seconds before tracking begins. Subsequent frames are fast. |
| **No persistent storage** | All data exists in memory only. Refreshing the page resets everything. The CSV export is the only persistence mechanism. |
| **Mobile support** | Functional on modern mobile browsers but tracking accuracy is lower due to camera angle, resolution constraints, and CPU throttling. |

---

## 12. Future Prospects

### Near-Term (0–6 months)

- **Real blink detection** — Replace the simulated blink tracker with a proper EAR threshold-crossing detector. Track EAR over time; a rapid drop below ~0.25 followed by recovery constitutes one blink.
- **Session history** — Store multiple scans in `localStorage` and display a trend chart showing how posture improves or degrades across sessions.
- **Multi-metric severity graph** — Visualise all 6 metrics on a radar/spider chart for intuitive multi-dimensional assessment at a glance.
- **Improved angle display** — Show a real-time indicator of whether the user is in profile or frontal mode, and guide them to the optimal camera position.

### Medium-Term (6–18 months)

- **User profiles** — Allow users to save their name, school, or organisation, and generate longitudinal reports across multiple scans.
- **Physiotherapist dashboard** — A separate authenticated view where a clinician can review multiple students' scans side-by-side.
- **Multi-language support** — Translate the AI output into Bahasa Indonesia, Malay, and Thai to serve the Southeast Asian NGO target market.
- **Depth estimation integration** — Use a monocular depth estimation model (e.g., MiDaS) to improve the 3D accuracy of neck deviation measurements without requiring a stereo camera.
- **Validated stress model** — Replace the EAR/MAR/brow heuristic with a validated facial action unit (AU) classifier trained on clinical stress datasets.

### Long-Term (18+ months)

- **Native mobile app** — A React Native or Flutter wrapper that accesses device sensors (gyroscope, accelerometer) to supplement the 2D webcam data with true 3D orientation.
- **Real-time posture coaching mode** — Continuous audio or haptic feedback when posture deviates beyond a threshold, enabling active correction without manual evaluation triggers.
- **Institutional integration** — API endpoints for school health management systems to ingest MediaSpine reports directly into student health records.
- **Clinical validation study** — Conduct a formal study comparing MediaSpine measurements against gold-standard clinical goniometry to establish sensitivity, specificity, and agreement coefficients (ICC).
- **Wearable sensor fusion** — Integrate BLE accelerometer data (e.g., from a chest-mounted sensor) to provide continuous posture monitoring beyond the screen-facing window.

---

## 13. Disclaimer

MediaSpine is a **screening tool** based on 2D webcam analysis and AI language model interpretation. It is **not a medical device**, **not a clinical diagnosis**, and **not a substitute for professional physiotherapy assessment**. All outputs should be treated as indicative findings that may prompt further investigation by a qualified health professional. The SpineSafe NGO and MediaSpine contributors accept no liability for decisions made based on this tool's outputs.

---

<div align="center">
  <sub>Built with ❤️ for the SpineSafe NGO Platform · Deployed on Vercel · Powered by Groq Llama-3</sub>
</div>
