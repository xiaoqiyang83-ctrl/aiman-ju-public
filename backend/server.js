require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 创建必要的目录
const dirs = ['logs', 'uploads', 'data'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`;
    console.log(log);
    
    const logFile = path.join(__dirname, 'logs', 'access.log');
    fs.appendFile(logFile, log + '\n', (err) => {
      if (err) console.error('日志写入失败:', err);
    });
  });
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI漫剧制作工具服务运行中',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// API文档
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'AI漫剧制作工具 API',
    version: '2.0.0',
    description: 'AI漫剧制作工具后端接口',
    modules: {
      users: {
        'POST /api/users/register': '用户注册',
        'POST /api/users/login': '用户登录',
        'GET /api/users/profile': '获取当前用户信息（需认证）',
        'PUT /api/users/profile': '更新用户信息（需认证）',
        'PUT /api/users/password': '修改密码（需认证）',
        'GET /api/users/credits': '获取积分（需认证）',
        'POST /api/users/credits/deduct': '扣除积分（需认证）',
        'POST /api/users/logout': '退出登录（需认证）',
        'DELETE /api/users/account': '注销账户（需认证）'
      },
      admin: {
        'GET /api/admin/users': '用户列表',
        'GET /api/admin/users/:id': '用户详情',
        'PUT /api/admin/users/:id/status': '更新用户状态',
        'POST /api/admin/users/:id/credits': '调整用户积分',
        'PUT /api/admin/users/:id/premium': '设置会员状态',
        'GET /api/admin/users/stats/overview': '用户统计概览',
        'GET /api/admin/orders': '订单列表',
        'GET /api/admin/orders/:id': '订单详情',
        'PUT /api/admin/orders/:id/status': '更新订单状态',
        'GET /api/admin/orders/stats/overview': '订单统计概览',
        'GET /api/admin/orders/stats/daily': '每日订单统计',
        'GET /api/admin/video/records': '视频生成记录列表',
        'GET /api/admin/video/records/:id': '视频生成详情',
        'GET /api/admin/video/stats/overview': '视频统计概览',
        'GET /api/admin/video/stats/api-usage': 'API使用统计'
      },
      characters: {
        'GET /api/characters': '角色列表（需认证）',
        'POST /api/characters': '创建角色（需认证）',
        'GET /api/characters/:id': '角色详情（需认证）',
        'PUT /api/characters/:id': '更新角色（需认证）',
        'DELETE /api/characters/:id': '删除角色（需认证）',
        'POST /api/characters/:id/avatar': '上传角色头像（需认证）',
        'POST /api/characters/batch': '批量创建角色（需认证）',
        'GET /api/characters/templates/list': '获取角色模板（需认证）',
        'POST /api/characters/:id/duplicate': '复制角色（需认证）'
      },
      projects: {
        'GET /api/projects': '项目列表（需认证）',
        'POST /api/projects': '创建项目（需认证）',
        'GET /api/projects/:id': '项目详情（需认证）',
        'PUT /api/projects/:id': '更新项目（需认证）',
        'DELETE /api/projects/:id': '删除项目（需认证）',
        'POST /api/projects/:id/duplicate': '复制项目（需认证）',
        'GET /api/projects/meta/categories': '获取项目分类（需认证）',
        'PUT /api/projects/:id/archive': '归档项目（需认证）'
      },
      video: {
        'POST /api/video/generate': '生成视频（需认证，需积分）',
        'GET /api/video/:id': '视频详情（需认证）',
        'GET /api/video/project/:projectId': '项目视频列表（需认证）',
        'POST /api/video/batch/create': '批量生成视频（需认证）',
        'GET /api/video/batch/:batchId': '批量任务状态（需认证）',
        'GET /api/video/status/:taskId': '任务状态（需认证）',
        'DELETE /api/video/:id': '删除视频（需认证）',
        'GET /api/video/my/list': '我的视频列表（需认证）'
      },
      scripts: {
        'GET /api/scripts': '剧本列表（需认证）',
        'POST /api/scripts': '创建剧本（需认证）',
        'GET /api/scripts/:id': '剧本详情（需认证）',
        'PUT /api/scripts/:id': '更新剧本（需认证）',
        'DELETE /api/scripts/:id': '删除剧本（需认证）',
        'POST /api/scripts/generate': 'AI生成剧本（需认证）'
      },
      storyboard: {
        'POST /api/storyboard/generate': 'AI生成分镜（需认证）',
        'GET /api/storyboard/:id': '分镜详情（需认证）',
        'PUT /api/storyboard/:id': '更新分镜（需认证）',
        'DELETE /api/storyboard/:id': '删除分镜（需认证）',
        'GET /api/storyboard/project/:projectId': '项目分镜列表（需认证）',
        'PUT /api/storyboard/batch/reorder': '批量更新分镜顺序（需认证）'
      },
      templates: {
        'GET /api/templates': '模板列表',
        'GET /api/templates/:id': '模板详情',
        'POST /api/templates': '创建模板',
        'PUT /api/templates/:id': '更新模板',
        'DELETE /api/templates/:id': '删除模板',
        'GET /api/templates/meta/categories': '模板分类',
        'POST /api/templates/:id/apply': '应用模板',
        'POST /api/templates/:id/duplicate': '复制模板'
      },
      marketing: {
        'POST /api/marketing/generate-copy': '生成营销文案',
        'POST /api/marketing/generate-social': '生成社交媒体内容',
        'POST /api/marketing/generate-email': '生成邮件营销',
        'POST /api/marketing/generate-ad': '生成广告文案'
      },
      'ai-script': {
        'POST /api/ai-script/generate': 'AI生成剧本',
        'GET /api/ai-script/history': '生成历史',
        'POST /api/ai-script/continue': '续写剧本',
        'POST /api/ai-script/dialogue': '生成角色对话',
        'POST /api/ai-script/scene': '生成场景描述',
        'GET /api/ai-script/templates': '获取剧本模板'
      },
      audio: {
        'GET /api/audio/bgm-presets': '获取BGM预设列表（需认证）',
        'GET /api/audio/sfx-presets': '获取SFX预设列表（需认证）',
        'POST /api/audio/bgm-apply': '应用背景音乐到项目（需认证）',
        'POST /api/audio/sfx-apply': '应用环境音效到分镜（需认证）',
        'POST /api/audio/tts/:shotId': '为指定分镜生成配音（需认证）'
      }
    }
  });
});

// 注册路由
const usersRouter = require('./routes/users');
const adminUsersRouter = require('./routes/admin_users');
const adminOrdersRouter = require('./routes/admin_orders');
const adminVideoRouter = require('./routes/admin_video');
const charactersRouter = require('./routes/characters');
const projectsRouter = require('./routes/projects');
const videoRouter = require('./routes/video');
const scriptsRouter = require('./routes/scripts');
const storyboardRouter = require('./routes/storyboard');
const templateRouter = require('./routes/template');
const marketingRouter = require('./routes/marketing');
const aiScriptRouter = require('./routes/ai-script');
const audioRouter = require('./routes/audio');

app.use('/api/users', usersRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/video', adminVideoRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/video', videoRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/storyboard', storyboardRouter);
app.use('/api/templates', templateRouter);
app.use('/api/marketing', marketingRouter);
app.use('/api/ai-script', aiScriptRouter);
app.use('/api/audio', audioRouter);

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 处理
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
});

// 初始化数据库
const db = require('./config/database');
console.log('✅ 数据库初始化完成');

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 AI漫剧制作工具服务启动成功`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📚 API文档: http://localhost:${PORT}/api/docs`);
  console.log(`${'='.repeat(60)}\n`);
});
