const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');
const sceneService = require('../services/sceneService');
const shotService = require('../services/shotService');
const aiService = require('../services/ai-service');

router.get('/', sceneController.list);

router.post('/generate', sceneController.generate);

router.put('/:id', sceneController.update);

router.delete('/:id', sceneController.remove);

router.post('/:id/generate-image', sceneController.generateImage);

// 重新生成单个shot的image_prompt
router.post('/:sceneId/shots/:shotIndex/regenerate', async (req, res) => {
  try {
    const { sceneId, shotIndex } = req.params;
    const { regenerate_visual_prompt } = req.body;
    
    const scene = await sceneService.getSceneById(sceneId);
    if (!scene) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }

    const shots = await shotService.listShots({ sceneId });
    const index = parseInt(shotIndex);
    if (isNaN(index) || index < 0 || index >= shots.length) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的镜头索引: ' + shotIndex + '，该场景共有 ' + shots.length + ' 个镜头'
      });
    }

    const shot = shots[index];
    const characters = await sceneService.getCharactersByScriptId(scene.script_id);
    const imagePrompt = aiService.compileImagePrompt(shot, scene, characters);
    
    await shotService.updateShot({
      id: shot.id,
      imagePrompt: imagePrompt
    });

    if (regenerate_visual_prompt) {
      try {
        const visualPrompt = {
          lighting: shot.visual_description || '',
          color_palette: '',
          character_placement: '',
          facial_detail: '',
          scene_description: shot.visual_description || '',
          composition: ''
        };
        await shotService.updateShot({
          id: shot.id,
          visualPrompt: JSON.stringify(visualPrompt)
        });
      } catch (vpErr) {
        console.error('[Scenes] 重新生成visual_prompt失败:', vpErr);
      }
    }

    const updatedShot = await shotService.getShotById(shot.id);
    res.json({ 
      success: true, 
      message: '镜头重新生成成功',
      data: { shot: updatedShot, image_prompt: imagePrompt }
    });
  } catch (err) {
    console.error('[Scenes] 重新生成shot失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新shots排序
router.put('/:sceneId/shots/reorder', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { shotOrder } = req.body;

    if (!Array.isArray(shotOrder)) {
      return res.status(400).json({ success: false, message: 'shotOrder必须是数组格式' });
    }

    const scene = await sceneService.getSceneById(sceneId);
    if (!scene) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }

    const shots = await shotService.listShots({ sceneId });
    if (shots.length === 0) {
      return res.status(400).json({ success: false, message: '该场景没有镜头' });
    }

    if (shotOrder.length !== shots.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'shotOrder长度(' + shotOrder.length + ')与镜头数量(' + shots.length + ')不匹配'
      });
    }

    const sortedOrder = [...shotOrder].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrder.length; i++) {
      if (sortedOrder[i] !== i) {
        return res.status(400).json({ 
          success: false, 
          message: 'shotOrder必须包含0到n-1的所有索引，且不能重复'
        });
      }
    }

    const reorderedShots = shotOrder.map((newIndex, displayOrder) => ({
      ...shots[newIndex],
      shot_number: displayOrder + 1
    }));

    for (const shot of reorderedShots) {
      await shotService.updateShot({
        id: shot.id,
        shotNumber: shot.shot_number
      });
    }

    const updatedShots = await shotService.listShots({ sceneId });
    res.json({ 
      success: true, 
      message: '镜头排序更新成功',
      data: { shots: updatedShots }
    });
  } catch (err) {
    console.error('[Scenes] 更新镜头排序失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
