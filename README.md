# MediaSpine — Clinical AI Posture Scanner

A real-time, browser-based posture and facial biometric analysis tool built for the **SpineSafe NGO Platform**.

## Features

- 🦴 **Pose Detection** — Shoulder tilt, head tilt, neck deviation angle (profile & frontal view)
- 😐 **FaceMesh Analytics** — Eye Aspect Ratio (EAR), Mouth Aspect Ratio (MAR), brow tension → Micro-Stress Level (0–100%) & Emotion detection
- 📊 **Live Dashboard** — 8 real-time biometric cards updated every frame
- 🤖 **AI Clinical Analysis** — 3-second stability snapshot fed to Groq Llama-3 for current issues, future risks, and recommendations
- 📥 **CSV Export** — Download the full AI report

## Tech Stack

| Layer | Technology |
|---|---|
| Vision | MediaPipe Pose + FaceMesh (CDN) |
| AI     | Groq API — `llama-3.3-70b-versatile` |
| UI     | Tailwind CSS (CDN), Vanilla JS |
| Hosting | Vercel (static) |

## How It Works

1. Click **Start Camera** — both MediaPipe models initialize on the main thread
2. A frame lock (`isProcessing`) ensures sequential `pose.send()` → `faceMesh.send()` calls to prevent WASM memory contention
3. Results are merged and the DOM is updated every frame
4. Click **Take Snapshot & AI Evaluation** — a 3-second countdown records biometric data, then sends it to Groq for clinical analysis

## Deployment

Deployed as a **zero-config static site** on Vercel — no build step required.

## Disclaimer

This tool provides rough AI-assisted analysis based on 2D webcam data. It is **not** a medical diagnosis. Consult a healthcare professional for any pain or injury.
