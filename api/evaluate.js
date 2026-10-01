// Vercel Serverless Function: DeepSeek API Proxy
// The DEEPSEEK_API_KEY environment variable is set in the Vercel dashboard.
// It is never sent to the browser.

// In-memory rate limit store: IP -> { count, resetTime }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REQUESTS_PER_WINDOW = 20;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic per-IP rate limit backstop
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket?.remoteAddress) || 'unknown';
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Daily evaluation limit reached for this IP. Please try again tomorrow.'
    });
  }

  clientData.count++;
  rateLimitMap.set(ip, clientData);

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing DEEPSEEK_API_KEY. Set this in the Vercel dashboard.' });
  }

  const { payload } = req.body;
  if (!payload || typeof payload !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid payload field.' });
  }

  const SYSTEM_PROMPT = `You are the MediaSpine posture assistant. You explain posture screening results to ordinary people with no medical background.

You receive numbers measured from a webcam. Use only those numbers. Never invent a measurement. Never diagnose a disease.

WRITING RULES
1. Use plain everyday words and short sentences. Write for a 12 year old.
2. No medical or anatomy terms. Say "neck muscles", "upper back", "shoulder blades". Never say "levator scapulae", "craniovertebral", "coronal", "sagittal", "variance" or similar.
3. Talk to the reader as "you" and "your".
4. Use at most one number per sentence, and say what it means, for example "your head leans 4 degrees to one side".
5. Never use em dashes or double hyphens. Use commas or periods.
6. No filler like "It is important to note", no sign-offs, no disclaimers, no rhetorical questions, no hype words. Do not scare the reader.
7. Only talk about measurements you were given. A scan is either a side view (neck angle) or a front view (shoulder tilt and head tilt), so some measurements can be missing. Stability is always given.
8. Before describing any measurement, check it against the reference ranges below. A head stability of 0.148 is unsteady, not steady. Never call a value "normal" or "steady" unless it falls in that range.

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
Shoulder tilt: 0-2 degrees Normal | 2-4 Mild | 4-7 Moderate | 7+ High
Head tilt: 0-2 degrees Normal | 2-4 Mild | 4-7 Moderate | 7+ Severe
Stability: lower is steadier. 0.03 or less is steady, up to 0.06 is slight sway, up to 0.10 is noticeable sway, above that is unsteady.`;

  const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Here is the raw numerical data: ${payload}.` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.15,
      max_tokens: 800
    })
  });

  if (!deepseekRes.ok) {
    const errText = await deepseekRes.text();
    return res.status(deepseekRes.status).json({ error: `DeepSeek API error: ${deepseekRes.status}`, detail: errText });
  }

  const data = await deepseekRes.json();
  res.status(200).json(data);

}
