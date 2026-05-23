const { pool } = require('../config/database');

/**
 * 积分消耗规则
 */
const CREDIT_COSTS = {
  script_generation: 50,
  video_generation: 100,
  tts_generation: 20,
  auto_generate: 500
};

/**
 * 扣减积分通用逻辑
 * @param {number} userId - 用户ID
 * @param {string} operation - 操作类型
 * @param {string} reason - 理由
 * @returns {Promise<number>} - 新余额
 */
async function deductCredits(userId, operation, reason) {
  const amount = CREDIT_COSTS[operation] || 0;
  if (amount <= 0) return 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 检查余额
    const checkRes = await client.query(
      'SELECT balance FROM credits WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    
    const balance = checkRes.rows[0]?.balance || 0;
    if (balance < amount) {
      throw new Error(`积分不足，需要 ${amount} 积分，当前剩余 ${balance}`);
    }

    // 2. 扣减积分
    await client.query(
      `UPDATE credits 
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2`,
      [amount, userId]
    );

    // 3. 记录流水
    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, reason) 
       VALUES ($1, $2, 'spend', $3)`,
      [userId, amount, reason || `Operation: ${operation}`]
    );

    await client.query('COMMIT');
    return balance - amount;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  CREDIT_COSTS,
  deductCredits
};
