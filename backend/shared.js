// ========================================
// AIManju v3.8 - 数据库连接池配置
// ========================================
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'aimanju',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试连接
pool.on('connect', () => {
  console.log('数据库连接成功');
});

pool.on('error', (err) => {
  console.error('数据库连接错误:', err);
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'aimanju-jwt-secret-key-2024-change-in-production';

// Mock Mode - 模拟视频/音频生成
const MOCK_MODE = process.env.MOCK_MODE === 'true';

module.exports = {
  pool,
  JWT_SECRET,
  MOCK_MODE
};
