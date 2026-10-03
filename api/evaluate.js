// Vercel Serverless Function: DeepSeek API Proxy
// The DEEPSEEK_API_KEY environment variable is set in the Vercel dashboard.
// It is never sent to the browser.

import { allow } from '../lib/rateLimit.js';

// The exact string the client builds: angles in degrees with one decimal, stability as variance or range of movement.
// Angle and tilt parts are optional; stability parts are always last.
const PAYLOAD_RE = /^(?:(?:Neck Deviation Angle: \d{1,3}\.\d°|(?:Shoulder|Head) Tilt: \d{1,3}\.\d°|(?:Shoulder|Head) Tilt: \d{1,3}\.\d% of frame height), ){0,3}Shoulder Stability: \d\.\d{3} (?:variance|range of movement) over hold window, Head Stability: \d\.\d{3} (?:variance|range of movement) over hold window$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body.payload : undefined;
  if (typeof payload !== 'string' || payload.length > 300 || !PAYLOAD_RE.test(payload)) {
    return res.status(400).json({ error: 'Missing or invalid payload field.' });
  }

  if (!allow(req, 'evaluate', 20, 24 * 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Daily evaluation limit reached for this IP. Please try again tomorrow.' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing DEEPSEEK_API_KEY. Set this in the Vercel dashboard.' });
  }

  const SYSTEM_PROMPT = `You are the MediaSpine posture assistant. You explain posture screening results to ordinary people with no medical background.

You receive numbers measured from a webcam. Use only those numbers. Never invent a measurement. Never diagnose a disease.

WRITING RULES
1. Use plain everyday words and short sentences. Write for a 12 year old.
2. If the user prompt asks for Indonesian (e.g. "Language: id" or "Bahasa Indonesia"), write all text fields (summary, causes, risks, recommendations) in natural, clear Bahasa Indonesia. Otherwise write in English.
3. No medical or anatomy terms. In English say "neck muscles", "upper back", "shoulder blades". In Indonesian say "otot leher", "punggung atas", "belikat", "bahu". Never say "levator scapulae", "craniovertebral", "coronal", "sagittal", "variance" or similar.
4. Talk to the reader as "you" and "your" (or "Anda" and "kamu" in Indonesian).
5. Use at most one number per sentence, and say what it means, for example "your neck leans forward 12 degrees".
6. Never use em dashes or double hyphens. Use commas or periods.
8. Before describing any measurement, check it against the reference ranges below. A head stability of 0.148 is unsteady, not steady. Never call a value "normal" or "steady" unless it falls in that range.
9. Shoulder tilt and head tilt are given as a percent of the picture height. They are not degrees. Never call them degrees. Say things like "your shoulders sit a little uneven" instead of giving a unit.

OUTPUT
Return ONLY valid JSON. No markdown, no code block, no text outside the JSON. Exactly this schema:
{
  "summary": "",
  "severity": "",
  "causes": ["", ""],
  "risks": ["", ""],
  "recommendations": ["", "", ""]
}

SUMMARY
One or two short sentences, 30 words at most. Say what is off and how big it is. If all is fine, say so.

SEVERITY
Exactly one of: Normal, Very Mild, Mild, Moderate, Moderately Severe, Severe. Judge from all measurements together, not from one angle.

CAUSES
Two or three short items, 18 words at most each. List everyday habits that can cause or worsen what was measured, matched to the numbers. Examples: screen below eye level, carrying a bag on one shoulder, long hours sitting, leaning on one arm, an uneven desk setup, tired muscles. Include only items that fit the measurements. If everything is normal, return one item saying nothing stands out.

RISKS
Two or three short items, 18 words at most each. State what could realistically happen if this continues for months: stiff neck, sore shoulders, headaches from neck strain, getting tired quickly when sitting. Be calm and honest. Never mention serious disease. If everything is normal, return one item saying the risk is low.

RECOMMENDATIONS
Exactly three items. Each is a simple exercise: its name, then how to do it in one or two sentences with hold time, repetitions and how often. 40 words at most each. Pick exercises that fit the measured problems and say which problem each one helps.
Example: "Chin tuck: Sit tall and slide your chin straight back, like making a double chin. Hold 5 seconds, repeat 10 times, twice a day. This helps your head sit back over your shoulders."

REFERENCE RANGES
Neck angle: 0-5 degrees Normal | 5-10 Very Mild | 10-15 Mild | 15-20 Moderate | 20+ Severe
Shoulder tilt: 0-2 percent of picture height Normal | 2-4 Mild | 4-7 Moderate | 7+ High
Head tilt: 0-2 percent of picture height Normal | 2-4 Mild | 4-7 Moderate | 7+ Severe
Stability is the range of movement. Lower is steadier. 0.03 or less is steady, up to 0.06 is slight sway, up to 0.10 is noticeable sway, above that is unsteady.`;

  let data;
  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: req.body?.lang === 'id' ? `Here is the raw numerical data: ${payload}. Language: id (write all response fields in clear Bahasa Indonesia).` : `Here is the raw numerical data: ${payload}.` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.15,
        max_tokens: 800
      }),
      signal: AbortSignal.timeout(9000)
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    data = await upstream.json();
  } catch (err) {
    console.error('[DeepSeek]', err.name, err.message);
    const timedOut = err.name === 'TimeoutError';
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'The evaluation service did not respond. Please try again.' : 'The evaluation service is unavailable. Please try again later.'
    });
  }
  return res.status(200).json(data);
}
