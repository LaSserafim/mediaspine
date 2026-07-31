// Vercel Serverless Function — Groq API Proxy
// The GROQ_API_KEY environment variable is set in the Vercel dashboard.
// It is never sent to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY. Contact the site owner.' });
  }

  const { payload } = req.body;
  if (!payload || typeof payload !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid payload field.' });
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical biomechanics AI. You will receive raw numerical data for Neck Deviation, Shoulder Tilt, Shoulder Stability (variance), Head Stability, Micro-Stress Level (%), and Facial Emotion. You MUST output ONLY a JSON object with three keys: "current_issues", "future_risks", and "recommendations".\nRules:\n- You MUST cite the exact degrees, numerical variance, stress levels, and emotion in your analysis.\n- You MUST heavily weight the micro-stress level and facial emotion when generating your analysis and recommendations.\n- You MUST classify the severity (e.g., Mild: <5°, Moderate: 5°-15°, Severe: >15°).\n- In "current_issues", explain the exact anatomical impact (e.g., asymmetrical loading on the trapezius, cervical spine strain) and correlate it with the observed stress/emotion.\n- In "future_risks", provide a projected timeline and how chronic stress/emotion might exacerbate musculoskeletal issues.\n- In "recommendations", provide exactly 3 specific, actionable ergonomic fixes or targeted stretches addressing both physical posture and mental tension.'
        },
        {
          role: 'user',
          content: `Here is the raw numerical data: ${payload}.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    return res.status(groqRes.status).json({ error: `Groq API error: ${groqRes.status}`, detail: errText });
  }

  const data = await groqRes.json();
  res.status(200).json(data);
}
