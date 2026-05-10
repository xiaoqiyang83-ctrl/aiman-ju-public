# AIManJu 架构重构指令

## 项目概况

AIManJu 是一个 AI 漫剧制作平台，包含4大子系统：

| 子系统 | 职责 | 关键模块 |
|--------|------|----------|
| 1. 内容生成系统(AI) | AI剧本生成、分镜拆分、画面描述生成 | ai-script、script-split、shot-generate |
| 2. 任务调度系统(异步) | BullMQ队列管理、Worker执行、进度追踪 | video-queue、audio-queue、export-queue |
| 3. 媒体处理系统(图/视频/音频) | 图片生成、视频生成(Vidu/即梦)、TTS配音、FFmpeg合成 | vidu-service、tts-service、ffmpeg-service |
| 4. SaaS后台系统(用户/项目/付费) | 注册登录、项目管理、积分扣减、会员订阅 | users、projects、credits、membership |

## 技术栈

- 前端：Vue 3 + Vite + Element Plus + Pinia
- 后端：Node.js + Express
- 数据库：PostgreSQL（当前用的SQLite，需迁移）
- 缓存/队列：Redis + BullMQ
- 媒体处理：Vidu/即梦API（视频）、TTS API（配音）、FFmpeg（合成）

## 核心任务：后端三层架构重构

当前后端是两层结构（routes直接写业务逻辑+数据库操作），需重构为标准三层。

### 目标目录结构

```
backend/
├── server.js              # 入口
├── config/
│   └── database.js        # 数据库配置（PostgreSQL连接池）
├── middleware/
│   └── auth.js            # JWT认证中间件
├── routes/                # 第1层：路由层（薄层）
│   ├── scripts.js
│   ├── video.js
│   ├── audio.js
│   ├── users.js
│   ├── projects.js
│   └── ...
├── controllers/           # 第2层：控制层（业务编排）
│   ├── scriptController.js
│   ├── videoController.js
│   ├── audioController.js
│   ├── userController.js
│   └── ...
├── services/              # 第3层：服务层（纯逻辑）
│   ├── scriptService.js
│   ├── videoService.js
│   ├── audioService.js
│   ├── userService.js
│   ├── creditService.js
│   ├── viduService.js
│   ├── ttsService.js
│   └── ffmpegService.js
├── workers/               # BullMQ Worker
│   ├── videoWorker.js
│   ├── audioWorker.js
│   └── exportWorker.js
└── uploads/
```

### 各层职责

**routes层**（薄层）：
- 路由注册 (router.get/post/put/delete)
- 参数校验 (express-validator)
- 调用 controller 对应方法
- 返回统一格式响应 `{ success, message, data }`

**controllers层**（业务编排）：
- 组合调用多个 service 完成业务逻辑
- 处理异常，返回合适的HTTP状态码
- 调用 creditService 检查/扣减积分
- 提交 BullMQ 异步任务

**services层**（纯逻辑）：
- 数据库 CRUD（SQL操作）
- 外部API调用（Vidu、TTS等）
- 不关心HTTP状态码，只抛异常或返回数据
- 数据库引用统一：`const { pool } = require('../config/database')`

### 重构步骤

1. 先建目录结构：创建 controllers/ 和整理 services/
2. 从 scripts 模块开始：routes/scripts.js → controllers/scriptController.js → services/scriptService.js
3. 跑通 scripts 模块：启动后端，测试 /api/scripts 相关接口全部正常
4. 依次迁移其他模块：video → audio → users → projects → characters → ...
5. 每迁移一个模块都要测试：确认接口正常后再迁移下一个
6. 迁移完成后删除 routes 中的旧业务代码

## 同时修复的问题

### 场景和镜头1:1问题

- 每个场景最少生成2-3个镜头（全景+中景+特写）
- generateShotsForScene 不要按字数算，改为按剧情结构拆分
- 前端视频页每行=1个镜头，不是1个场景
- 镜号用 shot_number 字段，不是行索引

### 分镜页面优化

- 场景为分组，可折叠展开
- 展开后显示多个镜头卡片（缩略图+景别+描述+状态）
- 支持添加/删除/拖拽排序镜头

## 完成后必须执行

```bash
git add .
git commit -m "三层架构重构+场景镜头修复+分镜页面优化"
```
