const { deductCredits } = require('../services/credit-service');
const userService = require('../services/userService');

const userId = 1;

async function membership(req, res) {
  try {
    const row = await userService.getLatestMembership(userId);
    res.json({ success: true, data: row || { plan_type: 'free', status: 'active' } });
  } catch (err) {
    console.error('[User] 获取会员失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function credits(req, res) {
  try {
    const summary = await userService.getCreditsSummary(userId);
    const history = await userService.getCreditHistory(userId, 20);
    res.json({
      success: true,
      data: {
        balance: summary?.balance || 0,
        total_earned: summary?.total_earned || 0,
        total_spent: summary?.total_spent || 0,
        history,
      },
    });
  } catch (err) {
    console.error('[User] 获取积分失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function creditsDeduct(req, res) {
  try {
    const { operation, reason } = req.body;
    const newBalance = await deductCredits(userId, operation, reason);
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    console.error('[User] 积分扣减失败:', err);
    res.status(400).json({ success: false, message: err.message });
  }
}

async function creditsRecharge(req, res) {
  try {
    const { amount, plan_type } = req.body;
    await userService.recharge({ userId, amount, planType: plan_type });
    res.json({ success: true, message: 'Mock 充值成功' });
  } catch (err) {
    console.error('[User] 充值失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  membership,
  credits,
  creditsDeduct,
  creditsRecharge,
};

