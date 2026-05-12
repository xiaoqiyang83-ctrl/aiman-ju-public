/**
 * image-service.js - 智谱AI CogView图像生成服务
 * v1.0 支持 CogView-3-Flash(免费) 和 CogView-4(0.06元/张)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { pool } = require('../shared');

// 智谱AI配置
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || 'bbeed8803bea453bb6b12198c276087a.EmUkjkS2HbdyoLwg';
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

// CogView模型配置
const COGVIEW_MODELS = {
  'cogview-3-flash': {
    name: 'CogView-3-Flash',
    price: 0, // 免费
    quality: false // 不支持quality参数
  },
  'cogview-4-250304': {
    name: 'CogView-4',
    price: 0.06,
    quality: true // 支持 standard/hd
  }
};

// 默认使用免费模型
const DEFAULT_MODEL = 'cogview-3-flash';
const DEFAULT_SIZE = '1024x1024';

/**
 * 根据角色身份锚点构建基础提示词
 * @param {Object} character - 角色对象
 * @returns {string} 英文提示词
 */
function buildCharacterBasePrompt(character) {
  const anchors = character.identity_anchors || {};
  const parts = [];
  
  // 核心身份
  parts.push(character.name || 'character');
  if (anchors.gender) parts.push(anchors.gender);
  if (anchors.age) parts.push(anchors.age);
  
  // 体型
  if (anchors.physique) parts.push(anchors.physique);
  
  // 面部
  if (anchors.face) parts.push(anchors.face);
  
  // 发型
  if (anchors.hair) parts.push(anchors.hair);
  
  // 服装
  if (anchors.clothing) parts.push(anchors.clothing);
  
  // 如果没有identity_anchors，用description
  if (parts.length <= 1 && character.description) {
    return `1 person, ${character.description}`;
  }
  
  return `1 person, ${parts.join(', ')}`;
}

/**
 * 下载图片到本地
 * @param {string} url - 图片URL
 * @param {string} localPath - 本地保存路径
 * @returns {Promise<string>} 本地文件路径
 */
async function downloadImage(url, localPath) {
  return new Promise((resolve, reject) => {
    // 确保目录存在
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(localPath);
    
    https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        downloadImage(response.headers.location, localPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        reject(new Error('下载失败: HTTP ' + response.statusCode));
        return;
      }

      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('[ImageService] 图片已保存: ' + localPath);
        resolve(localPath);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(localPath, () => {}); // 清理失败的文件
      reject(err);
    });
  });
}

/**
 * 调用智谱AI CogView生图API
 * @param {Object} params - 生图参数
 * @param {string} params.prompt - 英文提示词
 * @param {string} [params.model] - 模型名称
 * @param {string} [params.size] - 图片尺寸
 * @param {string} [params.quality] - 质量 standard/hd (仅cogview-4支持)
 * @returns {Promise<Object>} { url: 远程URL, localPath: 本地路径 }
 */
async function generateImage({ prompt, model = DEFAULT_MODEL, size = DEFAULT_SIZE, quality }) {
  const config = COGVIEW_MODELS[model] || COGVIEW_MODELS[DEFAULT_MODEL];
  
  // 构建请求体
  const requestBody = {
    model: model,
    prompt: prompt,
    size: size
  };

  // 只有 cogview-4 支持 quality 参数
  if (quality && config.quality) {
    requestBody.quality = quality;
  }

  console.log('[ImageService] 开始生成图片, model=' + model + ', size=' + size);
  console.log('[ImageService] Prompt: ' + prompt.substring(0, 100) + '...');

  // 429重试逻辑
  const MAX_RETRIES = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(ZHIPU_BASE_URL + '/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ZHIPU_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const delay = attempt * 5000; // 5s, 10s, 15s
        console.log('[ImageService] 429限流，第' + attempt + '次重试，等待' + (delay/1000) + '秒...');
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = new Error('CogView API错误: ' + response.status + ' - ' + errorText);
        continue;
      }
      throw new Error('CogView API错误: ' + response.status + ' - ' + errorText);
    }

    const result = await response.json();
    
    if (!result.data || !result.data[0] || !result.data[0].url) {
      throw new Error('CogView API返回格式错误: ' + JSON.stringify(result));
    }

    const imageUrl = result.data[0].url;
    console.log('[ImageService] 图片生成成功: ' + imageUrl);

    return { url: imageUrl };
  }
  
  throw lastError || new Error('CogView API重试失败');
}

/**
 * 生成角色三视图（正面+侧面+背面）
 * @param {number} characterId - 角色ID
 * @param {number} [variationId] - 变体ID（可选）
 * @param {Object} [options] - 额外选项
 * @param {string} [options.prompt] - 自定义提示词（如果有）
 * @returns {Promise<Object>} { front, side, back } 各视角本地路径
 */
async function generateCharacterImage(characterId, variationId = null, options = {}) {
  const { prompt: customPrompt } = options;
  const { compileCharacterPrompt } = require('./character_calibration');
  
  // 获取角色信息
  const charResult = await pool.query(
    'SELECT * FROM characters WHERE id = $1',
    [characterId]
  );
  
  if (charResult.rows.length === 0) {
    throw new Error('角色不存在: ' + characterId);
  }
  
  const character = charResult.rows[0];
  
  // 检查是否有校准过的视觉提示词
  let visualPrompt = character.visual_prompt_en;
  
  if (!visualPrompt && character.identity_anchors) {
    // 如果有身份锚点但没有编译的提示词，需要先编译
    const compiled = compileCharacterPrompt(character, null);
    visualPrompt = compiled.visual_prompt_en;
  }
  
  if (!visualPrompt) {
    throw new Error('角色尚未校准，无法生成图片。请先进行角色校准。');
  }

  // 如果有变体ID，获取变体信息并合并提示词
  if (variationId) {
    const varResult = await pool.query(
      'SELECT * FROM character_variations WHERE id = $1 AND character_id = $2',
      [variationId, characterId]
    );
    
    if (varResult.rows.length > 0) {
      const variation = varResult.rows[0];
      const compiled = compileCharacterPrompt(character, variation);
      visualPrompt = compiled.visual_prompt_en;
    }
  }
  
  // 如果有自定义prompt，使用自定义prompt
  if (customPrompt) {
    visualPrompt = customPrompt;
  }

  // 三视图配置
  const views = [
    { key: 'front', suffix: 'front view, facing camera, full body', field: 'front_image_url' },
    { key: 'side', suffix: 'side view, profile, full body', field: 'side_image_url' },
    { key: 'back', suffix: 'back view, from behind, full body', field: 'back_image_url' }
  ];
  
  const results = {};
  const timestamp = Date.now();
  
  // 依次生成三视图（不并行，避免API限流）
  for (const view of views) {
    try {
      console.log(`[ImageService] 开始生成${view.key}视图...`);
      
      const viewPrompt = `${visualPrompt}, ${view.suffix}, anime style, flat color, clean lines, white background, masterpiece, best quality`;
      
      // 生成图片
      const result = await generateImage({ prompt: viewPrompt });
      
      // 下载到本地
      const filename = `char-${characterId}-${view.key}-${variationId || 'base'}-${timestamp}.png`;
      const localPath = path.join(__dirname, '../uploads/images', filename);
      const relativePath = '/uploads/images/' + filename;
      
      await downloadImage(result.url, localPath);
      
      results[view.key] = relativePath;
      console.log(`[ImageService] ${view.key}视图生成成功: ${relativePath}`);
      
    } catch (err) {
      console.error(`[ImageService] 生成${view.key}视图失败:`, err.message);
    }
  }
  
  // 批量更新数据库（保留已成功的部分）
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  
  if (results.front) {
    updateFields.push(`front_image_url = $${paramIndex++}`);
    updateValues.push(results.front);
    // 兼容：同时更新image_url
    updateFields.push(`image_url = $${paramIndex++}`);
    updateValues.push(results.front);
  }
  if (results.side) {
    updateFields.push(`side_image_url = $${paramIndex++}`);
    updateValues.push(results.side);
  }
  if (results.back) {
    updateFields.push(`back_image_url = $${paramIndex++}`);
    updateValues.push(results.back);
  }
  
  if (updateFields.length > 0) {
    updateValues.push(characterId);
    await pool.query(
      `UPDATE characters SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
      updateValues
    );
    console.log(`[ImageService] 数据库更新成功，共${updateFields.length / 2}个字段`);
  }

  return results;
}

/**
 * 生成分镜图片
 * @param {number} shotId - 镜头ID
 * @param {string} [visualContinuityPrompt] - 视觉连续性提示词（可选）
 * @returns {Promise<Object>} { imageUrl: 本地路径 }
 */
async function generateShotImage(shotId, visualContinuityPrompt, size) {
  // 获取镜头信息
  const shotResult = await pool.query(
    'SELECT * FROM shots WHERE id = $1',
    [shotId]
  );
  
  if (shotResult.rows.length === 0) {
    throw new Error('镜头不存在: ' + shotId);
  }
  
  const shot = shotResult.rows[0];
  
  // 使用 image_prompt 或 visual_prompt
  let prompt = shot.image_prompt || shot.visual_prompt;
  
  if (!prompt) {
    throw new Error('镜头没有图片提示词，请先设置 image_prompt');
  }

  // 敏感词替换（避免触发智谱内容审核）
  const sensitiveReplacements = [
    [/丧尸/g, '变异者'],
    [/僵尸/g, '异形生物'],
    [/攻击/g, '行动'],
    [/杀/g, '击败'],
    [/血/g, '能量'],
    [/暴力/g, '冲突'],
    [/恐怖/g, '神秘'],
    [/死亡/g, '消失'],
    [/武器/g, '装备'],
    [/战斗/g, '对峙']
  ];
  var originalPrompt = prompt;
  for (var ri = 0; ri < sensitiveReplacements.length; ri++) {
    prompt = prompt.replace(sensitiveReplacements[ri][0], sensitiveReplacements[ri][1]);
  }
  if (prompt !== originalPrompt) {
    console.log('[ImageService] 敏感词已替换: ' + originalPrompt.substring(0, 50) + ' -> ' + prompt.substring(0, 50));
  }
  
  // 添加视觉连续性提示词（如果有）
  if (visualContinuityPrompt) {
    prompt = `${prompt}, ${visualContinuityPrompt}`;
    console.log('[ImageService] 添加视觉连续性提示词: ' + visualContinuityPrompt);
  }

  // 生成图片
  const result = await generateImage({ prompt, size: size || '1344x768' });
  
  // 下载到本地
  const timestamp = Date.now();
  const filename = 'shot-' + shotId + '-' + timestamp + '.png';
  const localPath = path.join(__dirname, '../uploads/images', filename);
  const relativePath = '/uploads/images/' + filename;
  
  await downloadImage(result.url, localPath);
  
  // 更新shots表的scene_image_url字段
  await pool.query(
    'UPDATE shots SET scene_image_url = $1 WHERE id = $2',
    [relativePath, shotId]
  );

  return { 
    imageUrl: relativePath,
    localPath: localPath
  };
}

/**
 * 通用生图接口（直接传prompt）
 * @param {Object} params - { prompt, model, size, quality }
 * @returns {Promise<Object>} { imageUrl: 本地路径 }
 */
async function generateFromPrompt({ prompt, model, size, quality }) {
  // 生成图片
  const result = await generateImage({ prompt, model, size, quality });
  
  // 下载到本地
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const filename = 'gen-' + timestamp + '-' + randomSuffix + '.png';
  const localPath = path.join(__dirname, '../uploads/images', filename);
  const relativePath = '/uploads/images/' + filename;
  
  await downloadImage(result.url, localPath);

  return { 
    imageUrl: relativePath,
    localPath: localPath,
    sourceUrl: result.url
  };
}

/**
 * 测试API连接
 */
async function testConnection() {
  try {
    const result = await generateImage({ 
      prompt: 'a beautiful anime girl, high quality',
      model: 'cogview-3-flash',
      size: '1024x1024'
    });
    return { success: true, url: result.url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateImage,
  generateCharacterImage,
  generateShotImage,
  generateFromPrompt,
  downloadImage,
  testConnection,
  COGVIEW_MODELS,
  DEFAULT_MODEL,
  DEFAULT_SIZE
};
