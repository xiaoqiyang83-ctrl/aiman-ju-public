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

/**
 * 生成角色图片（根据角色锚点+变体）
 * @param {number} characterId - 角色ID
 * @param {number} [variationId] - 变体ID（可选）
 * @returns {Promise<Object>} { imageUrl: 本地路径 }
 */
async function generateCharacterImage(characterId, variationId = null) {
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

  // 生成图片
  const result = await generateImage({ prompt: visualPrompt });
  
  // 下载到本地
  const timestamp = Date.now();
  const filename = 'char-' + characterId + '-' + (variationId || 'base') + '-' + timestamp + '.png';
  const localPath = path.join(__dirname, '../uploads/images', filename);
  const relativePath = '/uploads/images/' + filename;
  
  await downloadImage(result.url, localPath);
  
  // 更新角色表中的图片URL
  await pool.query(
    'UPDATE characters SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [relativePath, characterId]
  );

  return { 
    imageUrl: relativePath,
    localPath: localPath
  };
}

/**
 * 生成分镜图片
 * @param {number} shotId - 镜头ID
 * @returns {Promise<Object>} { imageUrl: 本地路径 }
 */
async function generateShotImage(shotId) {
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
  const prompt = shot.image_prompt || shot.visual_prompt;
  
  if (!prompt) {
    throw new Error('镜头没有图片提示词，请先设置 image_prompt');
  }

  // 生成图片
  const result = await generateImage({ prompt });
  
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
