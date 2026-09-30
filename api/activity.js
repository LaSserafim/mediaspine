// Vercel Serverless Function — User Activity Recorder & Session Synchronizer
// Securely records Google OAuth sign-in activity into Supabase using SUPABASE_SERVICE_ROLE_KEY.
// Determines weekly active status (minimum 1 session in the last 7 days).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wbnvjyfiegjsogvopyhz.supabase.co';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return res.status(500).json({
      error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY environment variable. Set this in the Vercel dashboard.'
    });
  }

  const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── POST: Record User Activity On Sign-in / Session Ping ────────────────────
  if (req.method === 'POST') {
    const { user_id, email, full_name, avatar_url } = req.body || {};

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid user_id' });
    }

    try {
      // 1. Record daily activity entry in user_activity table
      const { error: activityError } = await supabase
        .from('user_activity')
        .upsert(
          { user_id: user_id.trim(), activity_date: todayStr },
          { onConflict: 'user_id,activity_date' }
        );

      if (activityError) {
        console.error('[Supabase user_activity upsert error]', activityError);
      }

      // 2. Query user activity in the last 7 days to evaluate weekly active status
      const { data: userRecords, error: queryError } = await supabase
        .from('user_activity')
        .select('activity_date')
        .eq('user_id', user_id.trim())
        .gte('activity_date', sevenDaysAgo)
        .lte('activity_date', todayStr);

      const daysActiveLast7Days = (userRecords && userRecords.length) || 1;
      const isWeeklyActive = daysActiveLast7Days >= 1; // Minimum 1 time a week

      return res.status(200).json({
        ok: true,
        user_id: user_id.trim(),
        email: email || '',
        activity_date: todayStr,
        weeklyActive: isWeeklyActive,
        daysActiveLast7Days,
        message: 'User activity recorded successfully'
      });
    } catch (err) {
      console.error('[Activity record error]', err);
      return res.status(500).json({ error: 'Internal server error recording user activity' });
    }
  }

  // ── GET: Check Active Status for specific user (?user_id=... or ?email=...) ─
  if (req.method === 'GET') {
    const targetUserId = req.query?.user_id;
    if (!targetUserId) {
      // Delegate to stats query if no specific user requested
      const { data } = await supabase.from('user_activity').select('user_id, activity_date');
      const records = data || [];
      const allUsers = new Set(records.map(r => r.user_id).filter(Boolean));
      const weeklyUsers = new Set(
        records.filter(r => r.activity_date >= sevenDaysAgo && r.activity_date <= todayStr).map(r => r.user_id).filter(Boolean)
      );
      const todayUsers = new Set(
        records.filter(r => r.activity_date === todayStr).map(r => r.user_id).filter(Boolean)
      );
      return res.status(200).json({
        totalUsers: allUsers.size,
        activeWeekly: weeklyUsers.size,
        activeToday: todayUsers.size
      });
    }

    try {
      const { data: userRecords } = await supabase
        .from('user_activity')
        .select('activity_date')
        .eq('user_id', targetUserId)
        .gte('activity_date', sevenDaysAgo)
        .lte('activity_date', todayStr);

      const count = (userRecords && userRecords.length) || 0;
      return res.status(200).json({
        user_id: targetUserId,
        activeWeekly: count >= 1, // Minimum 1 time in past 7 days
        daysActiveLast7Days: count,
        window: { start: sevenDaysAgo, end: todayStr }
      });
    } catch (err) {
      console.error('[Activity check error]', err);
      return res.status(500).json({ error: 'Internal server error checking user status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
