// ========================================
// JWT 认证中间件
// ========================================
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aimanju-jwt-secret-key-2024-change-in-production';

const { pool } = require('../config/database');
const { CREDIT_COSTS } = require('../services/credit-service');

/**
 * 验证JWT Token，将用户信息挂载到 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录或token已过期' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token已过期，请重新登录' });
    }
    return res.status(401).json({ success: false, message: '无效的Token' });
  }
}

/**
 * 可选认证 - 有token就解析，没有也放行
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id,
        username: decoded.username
      };
    } catch (err) {
      // token无效，但不拦截
    }
  }
  next();
}

/**
 * 检查用户积分是否足够
 * @param {string} operation - 操作类型 (script_generation, video_generation, tts_generation, auto_generate)
 */
function checkCredits(operation) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || 1; // 临时，如果没登录默认为用户1
      const cost = CREDIT_COSTS[operation] || 0;
      
      const result = await pool.query(
        'SELECT balance FROM credits WHERE user_id = $1',
        [userId]
      );
      
      const balance = result.rows[0]?.balance || 0;
      if (balance < cost) {
        return res.status(403).json({ 
          success: false, 
          message: `积分不足，该操作需要 ${cost} 积分，当前剩余 ${balance} 积分。`,
          code: 'INSUFFICIENT_CREDITS'
        });
      }
      
      // 将 cost 挂载到 req，方便后续扣减
      req.credit_cost = cost;
      next();
    } catch (err) {
      console.error('[Middleware] 积分检查失败:', err);
      res.status(500).json({ success: false, message: '积分检查失败' });
    }
  };
}

module.exports = { authMiddleware, optionalAuth, checkCredits };
