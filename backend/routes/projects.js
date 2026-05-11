const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// 从模板创建项目
router.post('/from-template', projectController.fromTemplate);

// 获取项目列表
router.get('/', projectController.list);

// 创建项目
router.post('/', projectController.create);

// 更新项目
router.put('/:id', projectController.update);

// 删除项目
// 注意：数据库已设置ON DELETE CASCADE，删除项目会自动删除所有关联数据
router.delete('/:id', projectController.remove);

router.put('/:id/team', projectController.setTeam);

// 一键成片
router.post('/:id/auto-generate', ...projectController.autoGenerate);

module.exports = router;
