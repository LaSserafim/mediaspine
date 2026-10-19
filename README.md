# MediaSpine

MediaSpine is an in-browser posture screening tool built for the SpineSafe NGO platform to help students and office workers track spinal strain. It runs MediaPipe Pose locally in the browser to track body landmarks from a standard webcam, measures cervical spine angle, shoulder symmetry, and postural sway, and converts those measurements into a 0 to 100 posture score. Video frames stay on the user's device. Only five summary numbers are sent to a backend function that queries DeepSeek for a plain-language assessment and targeted mobility exercises.

Live site: https://mediaspine.vercel.app  
Repository: https://github.com/LaSserafim/mediaspine  

MediaSpine is an educational and screening tool, not a medical diagnostic device. See [Disclaimer](#disclaimer).

## Core Capabilities

- In-browser pose tracking: runs MediaPipe Pose (BlazePose Lite, model complexity 0, smoothed landmarks) via WebAssembly. Video frames are processed one at a time and discarded immediately.
- Automatic view detection: distinguishes profile views from frontal views by checking the horizontal distance between shoulder landmarks.
- Five kinematic metrics: measures neck deviation angle, shoulder tilt, head tilt, rolling 30-frame live stability variance, and 3-second hold stability variance.
- Deterministic 0 to 100 scoring: subtracts calibrated penalties from 100, grouping results into Normal, Very Mild, Mild, Moderate, or Severe categories.
- Plain-language AI assessment: uses DeepSeek (`deepseek-chat`) with temperature 0.15 to generate a 30-word summary, everyday causes, realistic risks, and three targeted exercises. Written without complex anatomical jargon.
- Bilingual interface: toggle between English and Bahasa Indonesia across the entire UI, including data tables, interactive readouts, streak counters, and AI responses.
- Interactive cervical load curve: high-DPI canvas plotting head tilt against cervical spinal compressive force (11 to 60 lbs) using the Kapandji-Hansraj model, with posture presets and live scan syncing.
- Local and cloud history: stores up to 200 scans in `localStorage` with daily streak tracking and progress charts. Optional Google sign-in via Supabase syncs records across devices.
- Shareable score cards: generates an animated 1080x1350 score card with Three.js, downloadable PNGs, and 90-day shareable web links (`#/r/<uuid>`).
- Direct feedback routing: sends user messages and scores to the maintainer's inbox using Nodemailer over Gmail SMTP.

## How a Scan Works

1. Camera capture: requests the webcam at 480x360. MediaPipe Pose runs with model complexity 0 (lightest model), landmark smoothing enabled, and segmentation disabled. If the model is busy processing a frame, subsequent incoming frames are dropped to prevent lag.
2. View classification: the page calculates the horizontal separation between left and right shoulders (`|leftShoulder.x - rightShoulder.x|`). If the distance is under 0.15 normalized units, the scan runs in Profile mode. Otherwise, it runs in Frontal mode.
3. Profile mode (Sagittal plane): measures neck deviation angle from the vertical plumb line:
   $$\theta_{\text{neck}} = \text{atan}\left(\frac{|x_{\text{ear}} - x_{\text{shoulder}}|}{|y_{\text{ear}} - y_{\text{shoulder}}|}\right) \times \frac{180}{\pi}$$
   The algorithm selects whichever side (left or right) has higher combined visibility for ear and shoulder landmarks.
4. Frontal mode (Coronal plane): measures lateral tilts in degrees:
   $$\text{Shoulder Tilt} = \text{atan}\left(\frac{|y_{\text{left shoulder}} - y_{\text{right shoulder}}|}{|x_{\text{left shoulder}} - x_{\text{right shoulder}}|}\right) \times \frac{180}{\pi}$$
   $$\text{Head Tilt} = \text{atan}\left(\frac{|y_{\text{left eye}} - y_{\text{right eye}}|}{|x_{\text{left eye}} - x_{\text{right eye}}|}\right) \times \frac{180}{\pi}$$
5. Stability measurement:
   - Live preview: a rolling 30-frame buffer (about 1 second at 30 fps) calculates continuous sway for shoulder height and nose coordinates so users can stabilize before recording.
   - 3-second snapshot hold: clicking "Take snapshot & AI evaluation" begins a 3-second hold. Shoulder stability is the total range (`max - min`) of vertical shoulder movement. Head stability is the larger of the nose's horizontal and vertical ranges. Holds capturing fewer than 20 frames are rejected as unstable.
6. AI evaluation: the browser sends the median measurements and selected language (`en` or `id`) to `/api/evaluate`. The backend function appends the clinical prompt and requests structured JSON from DeepSeek.
7. Results and storage: the page displays the AI text and computes the posture score. The scan is saved locally in `localStorage` and, if signed in, inserted into the Supabase `scans` table.

Because a scan is either profile or frontal, metrics for the opposite view are null. The scoring engine assigns zero penalty to missing metrics.

Each browser can run 10 evaluations per day (tracked in `localStorage`). The server also enforces a limit of 20 evaluation requests per IP per 24 hours.

## Posture Score & Penalty System

The overall score starts at 100 and subtracts penalties across five categories. The total is rounded and clamped between 0 and 100:

$$\text{Score} = \max(0, \min(100, 100 - (\text{NeckPenalty} + \text{ShoulderPenalty} + \text{HeadPenalty} + \text{ShoulderStabPenalty} + \text{HeadStabPenalty})))$$

### Penalty Thresholds

| Metric | Max Penalty | Calculation Bracket |
|---|---|---|
| Neck deviation | 40 pts | <=5°: 1.0x<br><=10°: 5 + (angle - 5) * 1.6<br><=15°: 13 + (angle - 10) * 2.2<br><=20°: 24 + (angle - 15) * 1.8<br>>20°: min(40, 33 + (angle - 20) * 1.2) |
| Shoulder tilt | 20 pts | <=2.5°: 1.5x<br><=4.5°: 3.75 + (tilt - 2.5) * 2.5<br><=7.0°: 8.75 + (tilt - 4.5) * 2.0<br>>7.0°: min(20, 13.75 + (tilt - 7.0) * 1.2) |
| Head tilt | 20 pts | <=2.5°: 1.5x<br><=4.5°: 3.75 + (tilt - 2.5) * 2.5<br><=7.0°: 8.75 + (tilt - 4.5) * 2.0<br>>7.0°: min(20, 13.75 + (tilt - 7.0) * 1.2) |
| Shoulder stability | 7.5 pts | <=0.030 var: stab * (2 / 0.03)<br><=0.060 var: 2 + (stab - 0.03) * (2.2 / 0.03)<br><=0.100 var: 4.2 + (stab - 0.06) * (2.0 / 0.04)<br>>0.100 var: min(7.5, 6.2 + (stab - 0.10) * 8) |
| Head stability | 7.5 pts | <=0.030 var: stab * (2 / 0.03)<br><=0.060 var: 2 + (stab - 0.03) * (2.2 / 0.03)<br><=0.100 var: 4.2 + (stab - 0.06) * (2.0 / 0.04)<br>>0.100 var: min(7.5, 6.2 + (stab - 0.10) * 8) |

### Score Classifications

| Score Range | Severity Label |
|---|---|
| 88 to 100 | Normal |
| 75 to 87 | Very Mild |
| 58 to 74 | Mild |
| 38 to 57 | Moderate |
| Below 38 | Severe |

Severity labels in the UI and share cards are derived directly from the numerical score so that labels and numbers always agree.

### AI Model Reference Ranges

The system prompt guides the model with the following clinical reference ranges:

| Metric | Normal | Very Mild | Mild | Moderate | Severe / High |
|---|---|---|---|---|---|
| Neck deviation | 0 to 5° | 5 to 10° | 10 to 15° | 15 to 20° | Over 20° |
| Shoulder tilt | 0 to 2.5° | Not used | 2.5 to 4.5° | 4.5 to 7.0° | Over 7.0° |
| Head tilt | 0 to 2.5° | Not used | 2.5 to 4.5° | 4.5 to 7.0° | Over 7.0° |
| Stability variance | <= 0.030 | Not used | 0.030 to 0.060 | 0.060 to 0.100 | Over 0.100 |

## Cervical Load Curve (Kapandji-Hansraj Model)

The interactive graph in the `#graph` section plots compressive force on the cervical spine across forward head tilt angles:

$$F(\theta) \approx 11 \cdot (1 + 4.5 \sin(\theta \cdot \pi / 180)) \text{ lbs}$$

| Forward Tilt Angle | Spinal Load (lbs) | Spinal Load (kg) | Load Multiplier | Everyday Scenario |
|---|---|---|---|---|
| 0° | 11.0 lbs | 5.0 kg | 1.0x baseline | Upright neutral posture |
| 15° | 27.0 lbs | 12.2 kg | 2.5x baseline | Eye level computer monitor |
| 30° | 40.0 lbs | 18.1 kg | 3.6x baseline | Laptop on standard desk |
| 45° | 49.0 lbs | 22.2 kg | 4.5x baseline | Texting on smartphone |
| 60° | 60.0 lbs | 27.2 kg | 5.5x baseline | Reading phone in lap |

The graph renders on an HTML5 canvas scaled by `window.devicePixelRatio` for sharp lines on Retina displays, interpolates curves using quadratic Bézier points, and updates the marker position whenever a profile scan completes.

## Project Structure

```
index.html                      Single-page application (HTML, CSS, JavaScript)
api/evaluate.js                 DeepSeek API proxy with input validation and rate limiting
api/activity.js                 Records daily user sessions in Supabase
api/stats.js                    Aggregates registered and active user counts from Supabase
api/feedback.js                 Sends user feedback via Gmail SMTP
lib/rateLimit.js                In-memory IP rate limiter for serverless functions
vite.config.js                  Vite dev server and build configuration
vercel.json                     Vercel build and output settings
package.json                    Project dependencies and scripts
smoke-test.js                   Local integrity tests and live URL validator
public/favicon.svg              Application favicon
mediaspine logo/                Branding assets and SVG icons
```

External runtime dependencies:
- MediaPipe Pose (`0.5.1675469404`) loaded via jsDelivr with Subresource Integrity (SRI) hashing.
- Fonts (IBM Plex Mono and Inter) loaded from Google Fonts.
- `@supabase/supabase-js`, `gsap`, and lazy-loaded Three.js bundled by Vite.
- Serverless API functions use `nodemailer` and `@supabase/supabase-js`.

## API Endpoints

| Route | Method | Request Payload / Headers | Description |
|---|---|---|---|
| `/api/evaluate` | POST | Body: `{ "payload": string, "lang": "en" \| "id" }` | Validates metrics string against regex, checks IP rate limits, and sends prompt to DeepSeek (`deepseek-chat`). Returns structured JSON. |
| `/api/activity` | POST | Header: `Authorization: Bearer <token>` | Verifies Supabase session JWT, extracts user ID, and records today's date in `user_activity`. Returns weekly active status. |
| `/api/stats` | GET | None | Queries Supabase Auth admin API for total registered users (falls back to distinct user IDs) and calculates 7-day and 24-hour active users. |
| `/api/feedback` | POST | Body: `{ "name": string, "email": string, "message": string, "score": number }` | Validates input, applies rate limiting (5 messages/hour), and sends an email to the administrator via Gmail SMTP. |

### DeepSeek Evaluation Schema

The model responds with strictly formatted JSON:

```json
{
  "summary": "Short plain-language overview, under 30 words.",
  "severity": "Normal | Very Mild | Mild | Moderate | Moderately Severe | Severe",
  "causes": [
    "Desk surface sits too low relative to chair height.",
    "Carrying a bag on one shoulder during transit."
  ],
  "risks": [
    "Muscle tightness in the upper neck and shoulders.",
    "Fatigue during long study or work sessions."
  ],
  "recommendations": [
    "Chin tuck: Sit upright and pull your chin straight back. Hold 5 seconds, repeat 10 times, twice a day. Helps align your head over your shoulders.",
    "Chest stretch: Place your hands behind your back and gently draw your shoulder blades together. Hold 15 seconds, repeat 3 times.",
    "Shoulder roll: Roll your shoulders backward in smooth circles 10 times. Helps ease tightness between study blocks."
  ]
}
```

The system prompt explicitly instructs the model to use plain terminology, write for a 12-year-old reading level, avoid diagnostic claims, and respond in natural Indonesian when `lang: "id"` is provided.

## Local Development & Setup

### Prerequisites

Node.js 22 or newer is required. Supabase client features rely on native `WebSocket` support available in modern Node versions.

### Installation

```bash
git clone https://github.com/LaSserafim/mediaspine.git
cd mediaspine
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root:

```env
# Required for /api/evaluate
DEEPSEEK_API_KEY=your_deepseek_api_key

# Required for /api/stats and /api/activity
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Required for /api/feedback
SMTP_PASS=your_gmail_app_password

# Optional overrides (defaults exist in code)
SUPABASE_URL=https://your-project.supabase.co
SMTP_USER=sender@example.com
FEEDBACK_TO=admin@example.com
```

### Running Locally

```bash
npm run dev
```

Open http://localhost:5173. Webcams require either `localhost` or an HTTPS connection to operate.

### Verification & Tests

```bash
# Build production bundle and run baseline checks
npm run build
npm test

# Test deployed production URL
node smoke-test.js https://mediaspine.vercel.app
```

The smoke test validates:
- Presence of MediaPipe Pose script tag and valid SRI hash.
- Zero references to legacy removed features (`facemesh`, `stress`, `emotion`, `blink`, `tension`).
- Successful execution of top-level scripts in mock DOM.
- Model configuration set to `deepseek-chat`.
- Integrity of `dist/index.html` production build.
- Live response formatting and HTTP rejection codes on serverless endpoints.

## Database & Authentication (Supabase)

### 1. Authentication
- Enable Google OAuth in Supabase under Authentication > Providers.
- Set Site URL to the production domain (`https://mediaspine.vercel.app`).
- Add redirect wildcards for both production (`https://mediaspine.vercel.app/**`) and local development (`http://localhost:5173/**`).

### 2. Database Tables

The application reads and writes to three tables:

| Table | Columns | Notes |
|---|---|---|
| `scans` | `id`, `user_id`, `neck_deviation`, `shoulder_tilt`, `head_tilt`, `shoulder_stability`, `head_stability`, `severity`, `ai_result` (jsonb), `created_at` | Stores individual user scan history. Row Level Security allows authenticated users to read and insert their own records. |
| `user_activity` | `user_id`, `activity_date` | Tracks unique active user days. Requires a unique composite constraint on `(user_id, activity_date)` to support upserts. Managed exclusively by `/api/activity` using the service role key. |
| `shared_results` | `id` (uuid), `score`, `severity`, `neck_deviation`, `shoulder_tilt`, `head_tilt`, `trend` (jsonb), `created_at`, `expires_at` | Stores public share cards. The `trend` object holds `summary`, `shoulder_stability`, `head_stability`, and `scanned_at`. Readable by public ID (`#/r/<uuid>`). |

## Data Privacy & Telemetry

MediaSpine handles data with explicit boundaries:
- Camera video: frames are processed frame-by-frame in browser RAM via MediaPipe Pose WASM. No video, canvas snapshots, or raw facial landmarks are ever sent to a server.
- DeepSeek queries: `/api/evaluate` receives only five numbers (neck angle, shoulder tilt, head tilt, shoulder stability, head stability) and the language flag. The language model never sees the user or any image data.
- Local scans: unauthenticated users have their scan history stored entirely within browser `localStorage`.
- Account data: signed-in users store their numerical metrics and generated advice in Supabase under user-isolated Row Level Security policies.
- Share cards: creating a share link saves only the card's numerical scores, severity rating, and summary in `shared_results`. Links expire after 90 days.
- User feedback: feedback messages are emailed directly to the maintainer without being written to an open database.

## Limitations

- Single-camera 2D perspective: webcam angles, distance from lens, and leaning relative to the screen can alter angular measurements.
- Lighting and clothing: uneven lighting or baggy clothing can reduce landmark tracking accuracy.
- Single subject: the scanner assumes one person is centered in frame.
- Quota resets: clearing site cookies or localStorage resets the client evaluation counter.
- Network requirement: MediaPipe Pose WASM binaries load from jsDelivr on first visit, requiring an initial internet connection.

## Disclaimer

MediaSpine provides indicative postural screening based on 2D computer vision and automated language generation. It does not provide medical diagnoses, clinical assessments, or physical therapy prescriptions. It is not a certified medical device. Individuals experiencing persistent back pain, neck discomfort, or numbness should consult a licensed healthcare professional or physiotherapist.
