const { pool } = require('../config/database');

async function getLatestMembership(userId) {
  const res = await pool.query('SELECT * FROM memberships WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [
    userId,
  ]);
  return res.rows[0] || null;
}

async function getCreditsSummary(userId) {
  const res = await pool.query('SELECT balance, total_earned, total_spent FROM credits WHERE user_id = $1', [userId]);
  return res.rows[0] || { balance: 0, total_earned: 0, total_spent: 0 };
}

async function getCreditHistory(userId, limit = 20) {
  const res = await pool.query(
    'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return res.rows;
}

async function recharge({ userId, amount, planType }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (planType) {
      await client.query(
        `INSERT INTO memberships (user_id, plan_type, start_date, end_date)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')
         ON CONFLICT (user_id) DO UPDATE SET plan_type = $2, end_date = memberships.end_date + INTERVAL '30 days'`,
        [userId, planType]
      );
    }

    const n = Number(amount) || 0;
    if (n > 0) {
      await client.query(
        `INSERT INTO credits (user_id, balance, total_earned)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance = credits.balance + $2, total_earned = credits.total_earned + $2`,
        [userId, n]
      );

      await client.query(`INSERT INTO credit_transactions (user_id, amount, type, reason) VALUES ($1, $2, 'earn', '用户充值')`, [
        userId,
        n,
      ]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  getLatestMembership,
  getCreditsSummary,
  getCreditHistory,
  recharge,
};

