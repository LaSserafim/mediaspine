// Vercel Serverless Function — User Activity Recorder & Session Synchronizer
// Securely records Google OAuth sign-in activity into Supabase using SUPABASE_SERVICE_ROLE_KEY.
// Determines weekly active status (minimum 1 session in the last 7 days).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wbnvjyfiegjsogvopyhz.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The caller proves who they are with their Supabase session token.
  // A user_id in the request body is never trusted.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
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

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    const userId = user.id;

    // 1. Record daily activity entry in user_activity table
    const { error: activityError } = await supabase
      .from('user_activity')
      .upsert(
        { user_id: userId, activity_date: todayStr },
        { onConflict: 'user_id,activity_date' }
      );

    if (activityError) {
      console.error('[Supabase user_activity upsert error]', activityError);
      return res.status(500).json({ error: 'Could not record activity' });
    }

    // 2. Query user activity in the last 7 days to evaluate weekly active status
    const { data: userRecords, error: queryError } = await supabase
      .from('user_activity')
      .select('activity_date')
      .eq('user_id', userId)
      .gte('activity_date', sevenDaysAgo)
      .lte('activity_date', todayStr);

    const daysActiveLast7Days = (userRecords && userRecords.length) || 1;
    const isWeeklyActive = daysActiveLast7Days >= 1; // Minimum 1 time a week

    return res.status(200).json({
      ok: true,
      user_id: userId,
      email: user.email || '',
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
