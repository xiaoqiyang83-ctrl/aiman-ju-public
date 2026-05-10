const express = require('express');
const router = express.Router();
const { pool } = require('../shared');
const { CREDIT_COSTS, deductCredits } = require('../services/credit-service');

const userId = 1; // 临时硬编码

// 获取会员状态
router.get('/membership', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM memberships WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    res.json({ success: true, data: result.rows[0] || { plan_type: 'free', status: 'active' } });
  } catch (err) {
    console.error('[User] 获取会员失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取积分信息和流水
router.get('/credits', async (req, res) => {
  try {
    // 获取余额
    const creditRes = await pool.query(
      'SELECT balance, total_earned, total_spent FROM credits WHERE user_id = $1',
      [userId]
    );
    
    // 获取流水 (最近20条)
    const historyRes = await pool.query(
      'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );
    
    res.json({ 
      success: true, 
      data: {
        balance: creditRes.rows[0]?.balance || 0,
        total_earned: creditRes.rows[0]?.total_earned || 0,
        total_spent: creditRes.rows[0]?.total_spent || 0,
        history: historyRes.rows
      }
    });
  } catch (err) {
    console.error('[User] 获取积分失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 扣减积分接口 (供内部或前端显式调用)
router.post('/credits/deduct', async (req, res) => {
  try {
    const { operation, reason } = req.body;
    const newBalance = await deductCredits(userId, operation, reason);
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    console.error('[User] 积分扣减失败:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Mock 充值接口
router.post('/credits/recharge', async (req, res) => {
  try {
    const { amount, plan_type } = req.body;
    // TODO: 接入微信/支付宝支付 SDK
    // 1. 调用支付平台下单
    // 2. 等待支付回调
    // 3. 支付成功后更新积分/会员
    
    // 这里是 Mock 成功逻辑
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      if (plan_type) {
        // 升级会员
        await client.query(
          `INSERT INTO memberships (user_id, plan_type, start_date, end_date)
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')
           ON CONFLICT (user_id) DO UPDATE SET plan_type = $2, end_date = memberships.end_date + INTERVAL '30 days'`,
          [userId, plan_type]
        );
      }

      if (amount > 0) {
        // 增加积分
        await client.query(
          `INSERT INTO credits (user_id, balance, total_earned)
           VALUES ($1, $2, $2)
           ON CONFLICT (user_id) DO UPDATE SET balance = credits.balance + $2, total_earned = credits.total_earned + $2`,
          [userId, amount]
        );
        
        await client.query(
          `INSERT INTO credit_transactions (user_id, amount, type, reason) 
           VALUES ($1, $2, 'earn', '用户充值')`,
          [userId, amount]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Mock 充值成功' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[User] 充值失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
