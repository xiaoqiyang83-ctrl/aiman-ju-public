async function login({ email }) {
  return {
    token: 'mock_token_' + Date.now(),
    user: { id: 1, name: '演示用户', email: email || 'demo@example.com' },
  };
}

async function register({ name, email }) {
  return {
    token: 'mock_token_' + Date.now(),
    user: { id: 1, name: name || '新用户', email: email || 'demo@example.com' },
  };
}

async function getMe() {
  return { id: 1, name: '演示用户', email: 'demo@example.com' };
}

async function logout() {
  return true;
}

module.exports = {
  login,
  register,
  getMe,
  logout,
};
