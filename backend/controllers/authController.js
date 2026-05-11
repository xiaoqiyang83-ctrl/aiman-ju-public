const authService = require('../services/authService');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const data = await authService.login({ email, password });
    res.json({ success: true, message: '登录成功', data });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    const data = await authService.register({ name, email, password });
    res.json({ success: true, message: '注册成功', data });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function me(req, res) {
  try {
    const data = await authService.getMe();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function logout(req, res) {
  try {
    await authService.logout();
    res.json({ success: true, message: '登出成功' });
  } catch (err) {
    console.error('[Auth] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  login,
  register,
  me,
  logout,
};
