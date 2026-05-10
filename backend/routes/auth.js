const express = require('express');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: 'mock_token_' + Date.now(),
        user: { id: 1, name: '演示用户', email: email || 'demo@example.com' },
      },
    });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    res.json({
      success: true,
      message: '注册成功',
      data: {
        token: 'mock_token_' + Date.now(),
        user: { id: 1, name: name || '新用户', email: email || 'demo@example.com' },
      },
    });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    res.json({
      success: true,
      data: { id: 1, name: '演示用户', email: 'demo@example.com' },
    });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    res.json({ success: true, message: '登出成功' });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
