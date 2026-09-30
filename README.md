# MediaSpine

MediaSpine screens posture from a webcam. MediaPipe Pose tracks body landmarks in the browser, the page measures neck, shoulder and head alignment during a 3 second hold, and only the resulting numbers go to a language model, which writes a short assessment. It was built for the SpineSafe NGO platform, which works on reducing spinal strain in students.

Live site: https://mediaspine.vercel.app

MediaSpine is a screening aid, not a medical device. See [Disclaimer](#disclaimer).

## What it does

- Tracks pose landmarks from the webcam with MediaPipe Pose, in the browser.
- Measures five values: neck deviation, shoulder tilt, head tilt, shoulder stability and head stability.
- Asks an AI model for a summary, a severity level, current issues, future risks and three recommendations.
- Converts the measurements into a 0 to 100 posture score and a shareable image card.
- Saves each scan and draws a progress chart for signed-in users (Google sign-in through Supabase).
- Shows total users, weekly active users and users active today on the landing page.
- Emails the feedback form to the maintainers.

## How a scan works

1. Camera. The page requests the front camera at an ideal 480x360. Pose runs at model complexity 0 (the lightest), with landmark smoothing on and segmentation off. Only one frame is processed at a time, and frames that arrive while the model is busy are skipped.
2. View detection. If the horizontal distance between the two shoulder landmarks is below 0.15 (normalized units), the scan counts as a profile view. Otherwise it counts as a frontal view.
3. Profile view. Neck deviation is the angle `atan(|ear.x - shoulder.x| / |ear.y - shoulder.y|)` in degrees. The page uses whichever side has the higher combined ear and shoulder visibility.
4. Frontal view. Shoulder tilt is `|left shoulder.y - right shoulder.y| * 100`. Head tilt is `|left eye.y - right eye.y| * 100`. These are percentages of frame height. The AI prompt calls them degrees.
5. Snapshot. "Take snapshot & AI evaluation" starts a 3 second countdown and records shoulder height and nose position on every processed frame. Shoulder stability is the range of shoulder height times 100. Head stability is the larger of the nose's horizontal and vertical ranges times 100. A higher number means less steady.
6. Evaluation. The browser sends the metrics as a text string to `/api/evaluate`. The function adds the system prompt and forwards the request to Groq.
7. Result. The page renders the response. If the user is signed in, it also saves the scan.

A scan is either profile or frontal, so the metrics from the other view are empty. A profile scan says nothing about tilt, and a frontal scan says nothing about neck deviation. The score counts an empty metric as zero penalty.

Each browser gets 5 AI evaluations per day, counted in `localStorage`. The server also allows 20 requests per IP per 24 hours, counted in memory per function instance, so that count resets on a cold start.

## Posture score

The score is 100 minus the penalties below, rounded and limited to 0 to 100.

| Metric | Largest penalty |
|---|---|
| Neck deviation | 40 |
| Shoulder tilt | 20 |
| Head tilt | 20 |
| Shoulder stability | 7.5 |
| Head stability | 7.5 |

| Score | Label |
|---|---|
| 88 and above | Normal |
| 75 to 87 | Very Mild |
| 58 to 74 | Mild |
| 38 to 57 | Moderate |
| Below 38 | Severe |

The AI returns its own severity, chosen from Normal, Very Mild, Mild, Moderate, Moderately Severe and Severe, and its prompt tells it to weigh all metrics together. The two labels can differ.

The reference ranges written into the AI prompt:

| Metric | Normal | Very Mild | Mild | Moderate | Severe (High for shoulder tilt) |
|---|---|---|---|---|---|
| Neck deviation | 0 to 5 | 5 to 10 | 10 to 15 | 15 to 20 | over 20 |
| Shoulder tilt, head tilt | 0 to 2 | not used | 2 to 4 | 4 to 7 | over 7 |

## Project layout

```
index.html                      landing page and scanner (HTML, CSS and JS in one file)
api/evaluate.js                 Groq proxy
api/activity.js                 records sign-in activity in Supabase
api/stats.js                    user counts from Supabase
api/feedback.js                 feedback email over Gmail SMTP
vite.config.js                  dev server, serves some api routes locally
vercel.json                     build command (vite build) and output folder (dist)
public/                         favicon, hero and logo images
mediaspine logo/                logo and icon assets
smoke-test.js                   checks index.html, evaluate.js, dist/ and stats.js
mediaspine_hero.jpg             not referenced by index.html
MEDIASPINE_FIXLOG.md            log of the earlier fix passes
AGENTS.md                       instructions for coding agents
design-engineering-reasoning/   reference notes for coding agents
```

The browser loads MediaPipe Pose 0.5.1675469404 and canvas-confetti 1.9.4 from jsDelivr, supabase-js from esm.sh, and the Fraunces, IBM Plex Mono and Inter fonts from Google Fonts. The server functions depend on `nodemailer` and `@supabase/supabase-js`. Vite is a dev dependency.

## Endpoints

| Route | Method | What it does |
|---|---|---|
| `/api/evaluate` | POST | Body `{ "payload": "<metrics string>" }`. Calls Groq model `openai/gpt-oss-120b` with temperature 0.2 and JSON output, and returns the raw Groq response. |
| `/api/activity` | POST, GET | POST needs the header `Authorization: Bearer <Supabase access token>`. The function takes the user from the verified token, ignores any id in the body, records today's activity and returns `weeklyActive` and `daysActiveLast7Days`. It returns 401 for a missing or invalid token. GET with `?user_id=` returns the activity status for that user. |
| `/api/stats` | GET | Returns `totalUsers`, `activeWeekly` and `activeToday` from the `user_activity` table. |
| `/api/feedback` | POST | Body `{ name, email, message, score }`. Only `message` is required. Sends an email through Gmail SMTP. |

The model is told to return JSON with these keys: `summary` (at most 80 words), `severity`, `current_issues`, `future_risks` and `recommendations` (an array of exactly three strings).

## Configuration

### Environment variables

Set these in Vercel under Project Settings, Environment Variables. For local work, put them in `.env.local`.

| Name | Required | Used by |
|---|---|---|
| `GROQ_API_KEY` | yes | `/api/evaluate` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `/api/stats`, `/api/activity` |
| `SMTP_PASS` | yes | `/api/feedback`. A Gmail app password for the sender account. |
| `SMTP_USER` | no | `/api/feedback`. Sender address. The default is set in the code. |
| `FEEDBACK_TO` | no | `/api/feedback`. Recipient address. The default is set in the code. |
| `SUPABASE_URL` | no | `/api/stats`, `/api/activity`. The default is set in the code. |

Each function returns a 500 with a message naming the missing variable if a required one is unset.

The Supabase project URL and publishable key are written into the script block of `index.html`. A fork has to edit them there.

### Supabase

1. Enable the Google provider under Authentication, Providers.
2. Under Authentication, URL Configuration, set the Site URL to the production domain and add `https://<your-domain>/**` to Redirect URLs. For local sign-in, also add `http://localhost:5173/**`.
3. Create the tables below.

The repo does not contain migrations, so the schema lives only in the Supabase project. These are the columns the code reads and writes.

| Table | Columns used |
|---|---|
| `scans` | `user_id`, `neck_deviation`, `shoulder_tilt`, `head_tilt`, `shoulder_stability`, `head_stability`, `severity`, `ai_result` (the parsed AI JSON), `created_at` |
| `user_activity` | `user_id`, `activity_date`. The upsert conflicts on `(user_id, activity_date)`, so that pair needs a unique constraint. |
| `shared_results` | `id`, `score`, `severity`, `metrics`, `summary`, `variant`, `trend`, `milestone` |

The browser reads and writes `scans` and `shared_results` with the publishable key, so Row Level Security policies decide who can see what. Only `/api/activity` writes `user_activity`, using the service role key, so that table needs no policy that lets the browser insert. The policies are part of the Supabase project and not this repo.

### Google Cloud

Create an OAuth client and paste its client ID and secret into the Supabase Google provider. The client's authorized redirect URI is Supabase's callback, `https://<project-ref>.supabase.co/auth/v1/callback`. It does not change when the site's domain changes.

## Run locally

Use Node 22 or newer. The Vercel project runs Node 24, and `@supabase/supabase-js` needs a native `WebSocket`, so the `/api` handlers that talk to Supabase fail to start on Node 20.

```bash
npm install
```

Create `.env.local` with the variables from the table above (`GROQ_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` at minimum, plus `SMTP_PASS` to test the feedback form), then:

```bash
npm run dev
```

The site is served at http://localhost:5173. Browsers allow camera access on `localhost` and on HTTPS pages only.

The dev server in `vite.config.js` serves the four routes in `api/` from the same handlers Vercel runs.

### Checks

```bash
npm run build
node smoke-test.js
```

The smoke test looks for the Pose script tag in `index.html`, the model name in `api/evaluate.js`, `dist/index.html`, and the Supabase logic in `api/stats.js`, so build first.

`node smoke-test.js https://mediaspine.vercel.app` checks a deployed site instead. It also posts one sample request to `/api/evaluate`, which uses one Groq call and one slot of that IP's rate limit.

## Deploy

The Vercel project `mediaspine` is connected to this repository, and a push to `main` deploys to production. `vercel.json` runs `vite build` and serves `dist`. Each file in `api/` becomes a serverless function.

### Changing the domain

The Google sign-in redirect uses `window.location.origin`, so it follows whatever domain serves the page. Three places in the code name the domain directly and need editing: the share card fallback URL in `index.html`, and the sender address and footer link in `api/feedback.js`. Then update the Supabase Site URL and Redirect URLs.

## What leaves the device

Video frames stay in the browser. The request to `/api/evaluate` carries the metrics string and nothing else, and the function forwards that string and the system prompt to Groq.

For a signed-in user, the site also stores each scan's metrics and AI result in Supabase, and records the date of each session. When a user shares a result card, its score, severity, metrics and summary are stored in `shared_results`, and anyone with the link can open them. The feedback form emails whatever name, email and message the user enters.

## Limitations

- Everything comes from a 2D webcam image. Camera angle and distance change the readings.
- One person should be in frame. Poor or uneven lighting reduces tracking quality.
- A view near 45 degrees is neither a clean profile nor a clean frontal view.
- The browser limit of 5 evaluations a day resets when the user clears site data.
- The AI text is generated from five numbers. The model never sees the person.
- MediaPipe files load from jsDelivr on first use, so the scanner needs network access and takes a few seconds to start.

## Disclaimer

MediaSpine gives an indicative reading from a 2D webcam and a language model. It is not a medical device, not a diagnosis, and not a replacement for an assessment by a physiotherapist. Anyone with pain or a health concern should see a qualified professional.
