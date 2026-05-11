const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保uploads目录存在
const uploadDirs = ['scripts', 'audio', 'scenes', 'shots', 'characters', 'exports', 'videos'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, 'uploads', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const { pool } = require('./config/database');
pool.connect((err, client, release) => {
  if (err) {
    console.error('数据库连接失败:', err.stack);
  } else {
    console.log('数据库连接成功 ✓');
    release();
  }
});
/*
// ==================== 路由加载 ====================
const routeFiles = fs.readdirSync(path.join(__dirname, 'routes')).filter(file => file.endsWith('.js'));

routeFiles.forEach(file => {
  const routeName = file.replace('.js', '');
  
  try {
    const routeModule = require(path.join(__dirname, 'routes', file));
    
    // 导出的是函数形式 (app, pool) => {...}
    if (typeof routeModule === 'function') {
      if (routeModule.length == 2) {
        routeModule(app, pool);
        console.log(`[${routeName}] 加载成功 ✓`);
      } else {
        console.log(`[${routeName}] 参数不匹配: ${routeModule.length}个`);
      }
    }
    // 导出的是Router对象
    else if (routeModule && typeof routeModule === 'object' && routeModule.stack) {
      app.use(`/api/${routeName}`, routeModule);
      console.log(`[${routeName}] 加载成功 ✓ (Router格式)`);
    }
    // 导出的是包含router属性的对象
    else if (routeModule && routeModule.router && routeModule.router.stack) {
      app.use(`/api/${routeName}`, routeModule.router);
      console.log(`[${routeName}] 加载成功 ✓ ({router}格式)`);
    }
    else {
      console.log(`[${routeName}] 未知格式: ${typeof routeModule}`);
    }
    
  } catch (error) {
    console.log(`[${routeName}] 加载失败: ${error.message}`);
  }
});
*/
// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', timestamp: new Date().toISOString() });
});
// 把这13行放在404处理的前面！
const { videoWorker } = require('./workers/videoWorker'); // 启动Worker
const { autoGenerateWorker } = require('./workers/autoGenerateWorker'); // 启动一键成片Worker
const { lipSyncWorker } = require('./workers/lipSyncWorker'); // 启动口型同步Worker
const { exportWorker } = require('./workers/exportWorker'); // 启动导出Worker
app.use('/api/projects', require('./routes/projects'));
app.use('/api/scripts', require('./routes/scripts'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/scenes', require('./routes/scenes'));
app.use('/api/shots', require('./routes/shots'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/task_jobs', require('./routes/task_jobs'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/project_versions', require('./routes/project_versions'));
app.use('/api/audio', require('./routes/audio'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/versions', require('./routes/versions'));
app.use('/api/videos', require('./routes/videos'));
// 404处理
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});


//app.use('/api/projects', require('./routes/projects'));
//app.use('/api/scripts', require('./routes/scripts'));
//app.use('/api/scenes', require('./routes/scenes'));

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
