// Vercel Serverless Function — User Feedback Dispatcher
// Dispatches user feedback directly to ibnuthyra488@gmail.com via authenticated Gmail SMTP.

import nodemailer from 'nodemailer';
import { allow } from '../lib/rateLimit.js';

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s) => s.replace(/[\r\n]+/g, ' ').trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message, score } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Feedback message is required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Feedback message is too long (2000 characters max).' });
  }

  const senderName = typeof name === 'string' && oneLine(name) ? oneLine(name).slice(0, 80) : 'Anonymous Tester';
  let senderEmail = 'no-reply@mediaspine.vercel.app';
  if (typeof email === 'string' && email.trim()) {
    if (email.trim().length > 120 || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Email address looks invalid.' });
    }
    senderEmail = email.trim();
  }
  const scoreNum = typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : null;
  const trimmedMsg = message.trim();
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' WIB';

  if (!allow(req, 'feedback', 5, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many messages. Please try again later.' });
  }

  const smtpUser = process.env.SMTP_USER || 'claudeai2223344@gmail.com';
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpPass) {
    return res.status(500).json({
      error: 'Server is missing SMTP_PASS environment variable. Set this in the Vercel dashboard.'
    });
  }
  const targetEmail = process.env.FEEDBACK_TO || 'ibnuthyra488@gmail.com';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const subject = `[MediaSpine Feedback] Note from ${senderName}`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E1DED4; border-radius: 8px; background: #FAF8F4;">
      <div style="border-bottom: 2px solid #4A6B5A; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #1C1D1B; font-size: 20px; font-weight: 600;">MediaSpine User Feedback</h2>
        <span style="font-size: 12px; color: #6E7069;">Received on ${dateStr}</span>
      </div>

      <div style="background: #FFFFFF; padding: 18px; border-radius: 6px; border: 1px solid #E8E5DD; margin-bottom: 20px;">
        <p style="margin: 0 0 10px; font-size: 13px; color: #4A6B5A; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Feedback Message:</p>
        <p style="margin: 0; font-size: 15px; color: #1C1D1B; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(trimmedMsg)}</p>
      </div>

      <table style="width: 100%; font-size: 13.5px; color: #4A4C45; border-collapse: collapse;">
        <tr>
          <td style="padding: 7px 0; font-weight: 600; width: 120px; color: #6E7069;">Sender:</td>
          <td style="padding: 7px 0; color: #1C1D1B;">${escapeHtml(senderName)}</td>
        </tr>
        <tr>
          <td style="padding: 7px 0; font-weight: 600; color: #6E7069;">Reply-To:</td>
          <td style="padding: 7px 0;"><a href="mailto:${escapeHtml(senderEmail)}" style="color: #4A6B5A; text-decoration: none;">${escapeHtml(senderEmail)}</a></td>
        </tr>
        ${scoreNum != null ? `<tr><td style="padding: 7px 0; font-weight: 600; color: #6E7069;">Latest Score:</td><td style="padding: 7px 0; font-weight: 600; color: #4A6B5A;">${scoreNum} / 100</td></tr>` : ''}
      </table>

      <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #E8E5DD; font-size: 11px; color: #9A9C95; text-align: center;">
        Dispatched automatically from MediaSpine Platform &bull; <a href="https://mediaspine.vercel.app" style="color: #6E7069;">mediaspine.vercel.app</a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"MediaSpine Feedback" <${smtpUser}>`,
      to: targetEmail,
      replyTo: senderEmail,
      subject: subject,
      text: `MediaSpine Feedback received from ${senderName} (${senderEmail}) on ${dateStr}:\n\n${trimmedMsg}\n\nLatest Score: ${scoreNum != null ? scoreNum : 'N/A'}`,
      html: htmlContent
    });

    return res.status(200).json({ ok: true, message: 'Feedback sent successfully' });
  } catch (err) {
    console.error('[Feedback SMTP error]', err);
    return res.status(500).json({ error: 'Failed to deliver feedback email. Please try again later.' });
  }
}
