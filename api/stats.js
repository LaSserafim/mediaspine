// Vercel Serverless Function — Public Aggregated User Activity Stats
// Uses SUPABASE_SERVICE_ROLE_KEY to query user_activity table server-side.
// Computes Total Users, Weekly Active Users (>= 1 time a week), and Active Today.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wbnvjyfiegjsogvopyhz.supabase.co';

export default async function handler(req, res) {
  // Allow GET and OPTIONS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return res.status(500).json({
      error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY environment variable. Set this in the Vercel dashboard.'
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error } = await supabase
      .from('user_activity')
      .select('user_id, activity_date');

    if (error) {
      console.error('[Supabase user_activity error]', error);
      return res.status(500).json({ error: 'Failed to query user activity data' });
    }

    const records = data || [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 1. Total distinct signed-in users across all history
    const allUsers = new Set(records.map(r => r.user_id).filter(Boolean));
    const totalUsers = allUsers.size;

    // 2. Weekly Active Users: distinct users with at least 1 session in the past 7 days (min 1x/week)
    const weeklyUsers = new Set(
      records
        .filter(r => r.activity_date >= sevenDaysAgo && r.activity_date <= todayStr)
        .map(r => r.user_id)
        .filter(Boolean)
    );
    const activeWeekly = weeklyUsers.size;

    // 3. Distinct users active today (last 24h)
    const todayUsers = new Set(
      records.filter(r => r.activity_date === todayStr).map(r => r.user_id).filter(Boolean)
    );
    const activeToday = todayUsers.size;

    // 4. Optional specific user check (e.g. ?user_id=...)
    let specificUser = null;
    const targetUserId = req.query?.user_id;
    if (targetUserId) {
      const userActivityPast7 = records.filter(
        r => r.user_id === targetUserId && r.activity_date >= sevenDaysAgo && r.activity_date <= todayStr
      );
      specificUser = {
        user_id: targetUserId,
        activeWeekly: userActivityPast7.length >= 1,
        activeDaysLast7Days: userActivityPast7.length,
        dates: userActivityPast7.map(r => r.activity_date)
      };
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      totalUsers,
      activeWeekly,
      activeToday,
      window: {
        start: sevenDaysAgo,
        end: todayStr
      },
      specificUser
    });
  } catch (err) {
    console.error('[Activity stats error]', err);
    return res.status(500).json({ error: 'Internal server error processing activity stats' });
  }
}
