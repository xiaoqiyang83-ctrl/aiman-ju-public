/**
 * prompt-compiler.js - AIManju v5.3 提示词编译引擎
 * 将结构化数据编译为 CogView/CogVideoX 的英文提示词
 */

const { pool } = require('../shared');

// 智谱AI配置
const ZHIPU_API_KEY = 'bbeed8803bea453bb6b12198c276087a.EmUkjkS2HbdyoLwg';
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

/**
 * 调用智谱AI进行翻译
 * @param {string} chineseText - 中文文本
 * @returns {Promise<string>} 英文翻译
 */
async function translateToEnglish(chineseText) {
  if (!chineseText || !chineseText.trim()) return '';
  
  try {
    const response = await fetch(ZHIPU_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional translator specializing in anime/manga visual description. Translate the following Chinese visual description to concise English prompt keywords for AI image generation. Output ONLY the English translation, no explanations. Keep it under 200 characters.'
          },
          { role: 'user', content: chineseText }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });
    
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    return chineseText;
  } catch (error) {
    console.error('[PromptCompiler] 翻译失败:', error.message);
    return chineseText;
  }
}

/**
 * 生成负面提示词
 * @param {string} content - 内容类型标识
 * @returns {string} 负面提示词
 */
function buildNegativePrompt(content) {
  const base = 'deformed, bad anatomy, blurry, low quality, extra limbs, disfigured, mutation, watermark, text, signature';
  
  const additions = [];
  const text = (content || '').toLowerCase();
  
  if (text.includes('face') || text.includes('面部') || text.includes('portrait')) {
    additions.push('asymmetric eyes, crossed eyes, deformed face');
  }
  if (text.includes('hand') || text.includes('手') || text.includes('finger')) {
    additions.push('extra fingers, missing fingers, deformed hands');
  }
  if (text.includes('three views') || text.includes('三视图') || text.includes('character sheet')) {
    additions.push('overlapping figures, different proportions, inconsistent style');
  }
  if (text.includes('video') || text.includes('motion') || text.includes('action')) {
    additions.push('jittery, unstable, broken, stuttering');
  }
  
  return additions.length > 0 ? `${base}, ${additions.join(', ')}` : base;
}

/**
 * 替换角色锚点
 * @param {string} text - 包含 @角色名 的文本
 * @param {Array} characters - 角色数组
 * @returns {string} 替换后的文本
 */
function resolveCharacterAnchors(text, characters) {
  if (!text || !characters || !Array.isArray(characters)) return text;
  
  let result = text;
  for (const char of characters) {
    const pattern = new RegExp(`@${char.name}\\b`, 'g');
    const charDesc = buildCharacterDescription(char);
    result = result.replace(pattern, charDesc);
  }
  return result;
}

/**
 * 构建角色描述
 * @param {Object} character - 角色对象
 * @returns {string} 角色描述
 */
function buildCharacterDescription(character) {
  const anchors = character.identity_anchors || {};
  const parts = [];
  
  if (character.name) {
    parts.push(character.name);
  }
  if (anchors.face) parts.push(anchors.face);
  if (anchors.hair) parts.push(anchors.hair);
  if (anchors.clothing) parts.push(anchors.clothing);
  
  return parts.join(', ');
}

/**
 * 替换场景锚点
 * @param {string} text - 包含 @场景名 的文本
 * @param {Object} scene - 场景对象
 * @returns {string} 替换后的文本
 */
function resolveSceneAnchor(text, scene) {
  if (!text || !scene) return text;
  
  const pattern = /@场景名\b/g;
  if (scene.description) {
    return text.replace(pattern, scene.description);
  }
  if (scene.name) {
    return text.replace(pattern, scene.name);
  }
  return text;
}

/**
 * 编译分镜静态图提示词
 * @param {Object} shot - 镜头对象（包含 visual_prompt_json, action_prompt_json, emotion_cue_json）
 * @param {Array} characters - 角色数组
 * @param {Object} scene - 场景对象
 * @returns {Promise<Object>} { prompt, negative_prompt, prompt_cn, size }
 */
async function compileImagePrompt(shot, characters, scene) {
  const visualJson = shot.visual_prompt_json || {};
  const actionJson = shot.action_prompt_json || {};
  const emotionJson = shot.emotion_cue_json || {};
  
  // Step 1: 提取各字段并组合中文描述
  const cnParts = [];
  
  // 角色描述
  if (visualJson.character_placement) {
    cnParts.push(`角色位置：${visualJson.character_placement}`);
  }
  if (visualJson.facial_detail) {
    cnParts.push(`面部细节：${visualJson.facial_detail}`);
  }
  
  // 动作/表情
  if (actionJson.physical_action) {
    cnParts.push(`动作：${actionJson.physical_action}`);
  }
  if (actionJson.micro_movement) {
    cnParts.push(`微动作：${actionJson.micro_movement}`);
  }
  
  // 情感
  if (emotionJson.primary_emotion) {
    cnParts.push(`情感：${emotionJson.primary_emotion}`);
  }
  if (emotionJson.visual_mapping) {
    cnParts.push(`视觉映射：${emotionJson.visual_mapping}`);
  }
  
  // 场景描述
  if (visualJson.scene_description) {
    cnParts.push(`场景：${visualJson.scene_description}`);
  }
  
  // 光影色彩
  if (visualJson.lighting) {
    cnParts.push(`光影：${visualJson.lighting}`);
  }
  if (visualJson.color_palette) {
    cnParts.push(`色彩：${visualJson.color_palette}`);
  }
  
  // 构图
  if (visualJson.composition) {
    cnParts.push(`构图：${visualJson.composition}`);
  }
  
  const promptCn = cnParts.join('；');
  
  // Step 2-3: 注入锚点
  let resolvedText = resolveCharacterAnchors(promptCn, characters);
  resolvedText = resolveSceneAnchor(resolvedText, scene);
  
  // Step 4-5: AI翻译并添加画质后缀
  let promptEn = await translateToEnglish(resolvedText);
  
  // 添加风格和质量后缀
  const styleSuffix = ', anime style, masterpiece, best quality, cinematic lighting, highly detailed, 4K';
  promptEn += styleSuffix;
  
  // Step 6: 生成负面提示词
  const negativePrompt = buildNegativePrompt(promptEn);
  
  // 确定图片尺寸
  const size = shot.size || '1024x1024';
  
  return {
    prompt: promptEn,
    negative_prompt: negativePrompt,
    prompt_cn: promptCn,
    size: size
  };
}

/**
 * 编译视频提示词
 * @param {Object} shot - 镜头对象
 * @param {Array} characters - 角色数组
 * @param {Object} scene - 场景对象
 * @returns {Promise<Object>} { prompt, prompt_cn, image_url }
 */
async function compileVideoPrompt(shot, characters, scene) {
  const visualJson = shot.visual_prompt_json || {};
  const actionJson = shot.action_prompt_json || {};
  const emotionJson = shot.emotion_cue_json || {};
  
  // 构建运动脚本
  const cnParts = [];
  
  // 动作描述
  if (actionJson.physical_action) {
    cnParts.push(`动作：${actionJson.physical_action}`);
  }
  if (actionJson.micro_movement) {
    cnParts.push(`微动作：${actionJson.micro_movement}`);
  }
  
  // 情感
  if (emotionJson.primary_emotion) {
    cnParts.push(`情感：${emotionJson.primary_emotion}`);
  }
  if (emotionJson.visual_mapping) {
    cnParts.push(`视觉映射：${emotionJson.visual_mapping}`);
  }
  
  // 场景与光影
  if (visualJson.scene_description) {
    cnParts.push(`场景：${visualJson.scene_description}`);
  }
  if (visualJson.lighting) {
    cnParts.push(`光影：${visualJson.lighting}`);
  }
  
  // 镜头语言
  if (shot.camera_angle) {
    cnParts.push(`镜头：${shot.camera_angle}`);
  }
  if (shot.narration) {
    cnParts.push(`旁白：${shot.narration}`);
  }
  
  const promptCn = cnParts.join('；');
  
  // 替换锚点
  let resolvedText = resolveCharacterAnchors(promptCn, characters);
  resolvedText = resolveSceneAnchor(resolvedText, scene);
  
  // 构建时序脚本
  const timeScript = buildTimeScript(actionJson, visualJson, shot);
  
  // AI精炼为40-70字英文散文体
  const promptEn = await refineVideoPrompt(timeScript);
  
  // 确保prompt不超过限制
  const finalPrompt = promptEn.length > 200 ? promptEn.substring(0, 197) + '...' : promptEn;
  
  return {
    prompt: finalPrompt,
    prompt_cn: promptCn,
    image_url: shot.scene_image_url || null
  };
}

/**
 * 构建时序脚本
 * @param {Object} actionJson - 动作描述
 * @param {Object} visualJson - 视觉描述
 * @param {Object} shot - 镜头对象
 * @returns {string} 时序脚本
 */
function buildTimeScript(actionJson, visualJson, shot) {
  const scenes = [];
  
  // 0-2s: 初始状态
  const initial = [];
  if (visualJson.character_placement) {
    initial.push(visualJson.character_placement);
  }
  if (visualJson.facial_detail) {
    initial.push(visualJson.facial_detail);
  }
  if (initial.length > 0) {
    scenes.push('0-2s: ' + initial.join(', '));
  }
  
  // 2-4s: 动作执行
  const action = [];
  if (actionJson.physical_action) {
    action.push(actionJson.physical_action);
  }
  if (actionJson.micro_movement) {
    action.push(actionJson.micro_movement);
  }
  if (action.length > 0) {
    scenes.push('2-4s: ' + action.join(', '));
  }
  
  // 4-5s: 动作结束
  const end = [];
  if (emotionJson?.primary_emotion) {
    end.push(emotionJson.primary_emotion);
  }
  if (visualJson.scene_description) {
    end.push(visualJson.scene_description);
  }
  if (end.length > 0) {
    scenes.push('4-5s: ' + end.join(', '));
  }
  
  // 镜头运动
  if (shot.camera_angle) {
    scenes.push('镜头运动: ' + shot.camera_angle);
  }
  
  return scenes.join('\n');
}

/**
 * AI精炼视频提示词
 * @param {string} timeScript - 时序脚本
 * @returns {Promise<string>} 精炼后的英文提示词
 */
async function refineVideoPrompt(timeScript) {
  try {
    const response = await fetch(ZHIPU_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          { 
            role: 'system', 
            content: `You are a professional video prompt engineer. Convert the following time-script into a 40-70 word English prose prompt for CogVideoX AI video generation.
Rules:
1. Write in present tense, third person narrative
2. Include camera movement naturally
3. Focus on character action and emotion
4. Keep between 40-70 words
5. Output ONLY the English prompt, no explanations or quotes`
          },
          { role: 'user', content: timeScript }
        ],
        temperature: 0.3,
        max_tokens: 150
      })
    });
    
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      let prompt = data.choices[0].message.content.trim();
      // 移除可能的引号
      prompt = prompt.replace(/^["']|["']$/g, '');
      return prompt;
    }
    return timeScript;
  } catch (error) {
    console.error('[PromptCompiler] 视频提示词精炼失败:', error.message);
    return timeScript;
  }
}

/**
 * 编译角色设定图提示词
 * @param {Object} character - 角色对象（包含identity_anchors）
 * @param {Object} variation - 可选的变体对象
 * @returns {Promise<Object>} { prompt, negative_prompt, size }
 */
async function compileCharacterPrompt(character, variation) {
  const anchors = character.identity_anchors || {};
  
  // 构建中文描述
  const cnParts = [];
  
  if (character.name) {
    cnParts.push(`角色名：${character.name}`);
  }
  if (anchors.gender) {
    cnParts.push(`性别：${anchors.gender}`);
  }
  if (anchors.age) {
    cnParts.push(`年龄：${anchors.age}`);
  }
  if (anchors.physique) {
    cnParts.push(`体型：${anchors.physique}`);
  }
  if (anchors.face) {
    cnParts.push(`面部：${anchors.face}`);
  }
  if (anchors.hair) {
    cnParts.push(`发型：${anchors.hair}`);
  }
  if (anchors.clothing) {
    cnParts.push(`服饰：${anchors.clothing}`);
  }
  
  // 应用变体
  if (variation) {
    if (variation.age_description) {
      cnParts.push(`阶段特征：${variation.age_description}`);
    }
    if (variation.stage_description) {
      cnParts.push(`变体描述：${variation.stage_description}`);
    }
    if (variation.visual_prompt_zh) {
      cnParts.push(`变体服装：${variation.visual_prompt_zh}`);
    }
  }
  
  cnParts.push('三视图：正面、侧面、背面');
  
  const promptCn = cnParts.join('；');
  
  // AI翻译为英文
  let promptEn = await translateToEnglish(promptCn);
  
  // 添加角色设定图专用后缀
  const characterSheetSuffix = ', three views, front view, side view, back view, full body, white background, anime style, flat color, clean lines, masterpiece, best quality';
  promptEn += characterSheetSuffix;
  
  // 生成负面提示词
  const negativePrompt = buildNegativePrompt('character sheet, three views, face, hand');
  
  return {
    prompt: promptEn,
    negative_prompt: negativePrompt,
    size: '1344x768'
  };
}

/**
 * 编译纯文本为英文提示词（工具函数）
 * @param {string} chineseText - 中文文本
 * @returns {Promise<string>} 英文提示词
 */
async function compileTextToPrompt(chineseText) {
  return await translateToEnglish(chineseText);
}

module.exports = {
  compileImagePrompt,
  compileVideoPrompt,
  compileCharacterPrompt,
  compileTextToPrompt,
  translateToEnglish,
  buildNegativePrompt,
  resolveCharacterAnchors,
  resolveSceneAnchor
};
