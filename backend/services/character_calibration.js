/**
 * v5.0 角色一致性系统 - AI角色校准模块
 * 基于6层身份锚点的角色视觉一致性保证
 */

// 6层身份锚点系统Prompt模板
const CHARACTER_ANCHORS_SYSTEM_PROMPT = `你是一位专业的AI绘图角色设计师，负责为角色生成6层身份锚点，确保角色在不同场景/镜头中保持一致。

【6层身份锚点结构】
1. gender（性别特征）：描述性别特有的身体轮廓和气质
2. age（年龄特征）：描述年龄段特有的面部和体态
3. physique（体型特征）：描述身高、体型、比例
4. face（面部特征）：描述脸型、眉眼、鼻唇等关键特征
5. hair（发型发色）：描述发型、发色、头饰
6. clothing（服饰特征）：描述主要服装风格和配饰

【输出格式要求】
- 必须输出有效的JSON对象
- identity_anchors: 包含以上6层的详细描述（中文）
- negative_prompt: 列出需要避免的元素（风格、构图、质量问题）
- consistency_elements: 关键一致性元素列表

【重要原则】
1. 面部特征是最重要的锚点，必须详细描述
2. 体型描述要包含身高范围和身体比例
3. 服装描述只描述标志性服饰，不包含具体场景服装
4. negative_prompt要防止AI生成时的常见错误`;

function buildCalibrationUserPrompt(character) {
  const parts = [];
  
  if (character.name) parts.push(`角色名称：${character.name}`);
  if (character.description) parts.push(`角色描述：${character.description}`);
  if (character.appearance) parts.push(`外貌描写：${character.appearance}`);
  if (character.gender) parts.push(`性别：${character.gender}`);
  if (character.age) parts.push(`年龄：${character.age}`);
  if (character.personality) parts.push(`性格特点：${character.personality}`);
  if (character.role_desc) parts.push(`身份背景：${character.role_desc}`);
  
  return `请为以下角色生成6层身份锚点：

${parts.join('\n')}

请基于以上信息，生成详细的6层身份锚点JSON。`;
}

/**
 * AI自动填充6层身份锚点
 * @param {Object} character - 角色基本信息
 * @param {Function} generateText - AI生成文本函数
 * @returns {Object} - { identity_anchors, negative_prompt, consistency_elements }
 */
async function calibrateCharacterAnchors(character, generateText) {
  if (!generateText || typeof generateText !== 'function') {
    throw new Error('需要提供generateText函数');
  }

  const systemPrompt = CHARACTER_ANCHORS_SYSTEM_PROMPT;
  const userPrompt = buildCalibrationUserPrompt(character);

  try {
    const result = await generateText({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3,
      maxTokens: 2000
    });

    // 解析JSON响应
    const content = result.content || result;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('AI返回内容中未找到有效的JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // 标准化输出结构
    return {
      identity_anchors: {
        gender: parsed.identity_anchors?.gender || '',
        age: parsed.identity_anchors?.age || '',
        physique: parsed.identity_anchors?.physique || '',
        face: parsed.identity_anchors?.face || '',
        hair: parsed.identity_anchors?.hair || '',
        clothing: parsed.identity_anchors?.clothing || ''
      },
      negative_prompt: {
        style: parsed.negative_prompt?.style || '避免卡通风格、避免写实照片风格',
        composition: parsed.negative_prompt?.composition || '避免正面大头照、避免遮挡面部',
        quality: parsed.negative_prompt?.quality || '避免模糊、避免畸形、避免多余手指'
      },
      consistency_elements: parsed.consistency_elements || {
        key_features: [],
        avoid_conflicts: []
      }
    };
  } catch (error) {
    console.error('[Character Calibration] 校准失败:', error);
    throw error;
  }
}

/**
 * 编译角色视觉提示词
 * 从6层身份锚点编译成英文视觉描述
 * @param {Object} character - 角色完整信息（包含identity_anchors）
 * @param {Object} variation - 可选的变体信息
 * @returns {Object} - { visual_prompt_en, visual_prompt_zh }
 */
function compileCharacterPrompt(character, variation) {
  const anchors = character.identity_anchors || {};
  const negativePrompt = character.negative_prompt || {};
  
  // 中文描述构建
  const zhParts = [];
  
  // 基础身份描述
  if (anchors.gender) zhParts.push(`性别特征：${anchors.gender}`);
  if (anchors.age) zhParts.push(`年龄特征：${anchors.age}`);
  if (anchors.physique) zhParts.push(`体型特征：${anchors.physique}`);
  if (anchors.face) zhParts.push(`面部特征：${anchors.face}`);
  if (anchors.hair) zhParts.push(`发型发色：${anchors.hair}`);
  if (anchors.clothing) zhParts.push(`服饰特征：${anchors.clothing}`);
  
  // 应用变体（如果有）
  if (variation) {
    if (variation.age_description) zhParts.push(`阶段特征：${variation.age_description}`);
    if (variation.stage_description) zhParts.push(`变体描述：${variation.stage_description}`);
    if (variation.visual_prompt_zh) zhParts.push(`变体服装：${variation.visual_prompt_zh}`);
  }
  
  const visualPromptZh = zhParts.join('；') + '。';

  // 英文提示词编译
  const enParts = [];
  
  // 性别和年龄
  if (anchors.gender) {
    enParts.push(translateToEnglish(anchors.gender, 'gender'));
  }
  if (anchors.age) {
    enParts.push(translateToEnglish(anchors.age, 'age'));
  }
  
  // 体型
  if (anchors.physique) {
    enParts.push(translateToEnglish(anchors.physique, 'physique'));
  }
  
  // 面部（最重要）
  if (anchors.face) {
    enParts.push(translateToEnglish(anchors.face, 'face'));
  }
  
  // 发型
  if (anchors.hair) {
    enParts.push(translateToEnglish(anchors.hair, 'hair'));
  }
  
  // 服饰
  if (anchors.clothing) {
    enParts.push(translateToEnglish(anchors.clothing, 'clothing'));
  }
  
  // 变体处理
  if (variation) {
    if (variation.age_description) {
      enParts.push(translateToEnglish(variation.age_description, 'stage'));
    }
    if (variation.stage_description) {
      enParts.push(translateToEnglish(variation.stage_description, 'stage'));
    }
    if (variation.visual_prompt && !variation.visual_prompt_zh) {
      enParts.push(variation.visual_prompt);
    }
  }
  
  // 组装英文提示词
  let visualPromptEn = enParts.join(', ');
  
  // 添加一致性质量词
  visualPromptEn += ', high quality, detailed face, consistent character, anime style';
  
  // 添加负面提示词
  const negativeParts = [];
  if (negativePrompt.style) negativeParts.push(negativePrompt.style);
  if (negativePrompt.composition) negativeParts.push(negativePrompt.composition);
  if (negativePrompt.quality) negativeParts.push(negativePrompt.quality);
  
  const negativePromptEn = negativeParts.length > 0 
    ? 'Negative: ' + negativeParts.join(', ') 
    : '';

  return {
    visual_prompt_en: visualPromptEn,
    visual_prompt_zh: visualPromptZh,
    negative_prompt_en: negativePromptEn
  };
}

// 中文到英文的简单翻译映射
function translateToEnglish(text, type) {
  if (!text) return '';
  
  // 常见翻译映射
  const translations = {
    // 性别
    '男性': 'male',
    '女性': 'female',
    '中性': 'androgynous',
    // 年龄
    '少年': 'young teenager, 14-16 years old',
    '青年': 'young adult, 20-30 years old',
    '中年': 'middle-aged, 40-50 years old',
    '老年': 'elderly, 70+ years old',
    // 体型
    '高大': 'tall',
    '矮小': 'short',
    '修长': 'slim and tall',
    '健壮': 'athletic and muscular',
    '丰满': 'voluptuous',
    '瘦削': 'thin and lean',
    // 发型
    '短发': 'short hair',
    '长发': 'long hair',
    '卷发': 'curly hair',
    '直发': 'straight hair',
    '马尾': 'ponytail',
    '刘海': 'bangs',
    // 服装
    '校服': 'school uniform',
    '西装': 'suit',
    '和服': 'kimono',
    '汉服': 'hanfu',
    '休闲装': 'casual clothes',
    '正装': 'formal wear',
  };
  
  let result = text;
  for (const [cn, en] of Object.entries(translations)) {
    result = result.replace(new RegExp(cn, 'g'), en);
  }
  
  // 如果没有匹配，返回原始文本（保持原样）
  return result;
}

module.exports = {
  calibrateCharacterAnchors,
  compileCharacterPrompt,
  CHARACTER_ANCHORS_SYSTEM_PROMPT
};
