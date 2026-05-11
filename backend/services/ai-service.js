/**
 * AI服务 - 支持多种AI后端（增强版）
 * 文心一言 / OpenAI / Claude / 硅基流动 / 智谱 等
 * 包含错误处理、重试机制、Token计算
 */

async function fetchJson(url, { method = 'POST', headers = {}, body, timeout = 300000 } = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            method,
            headers,
            body,
            signal: controller.signal
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        return { status: res.status, data };
    } finally {
        clearTimeout(t);
    }
}

// AI服务配置
const AI_CONFIG = {
    // 硅基流动配置
    'siliconflow': {
        baseURL: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
        apiKey: process.env.SILICONFLOW_API_KEY || '',
        model: process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
        timeout: 300000
    },
    // 文心一言配置
    'ernie': {
        baseURL: process.env.ERNIE_BASE_URL || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
        apiKey: process.env.ERNIE_API_KEY || '',
        secretKey: process.env.ERNIE_SECRET_KEY || '',
        model: process.env.ERNIE_MODEL || 'ernie-4.0-8k-latest',
        timeout: 300000
    },
    // OpenAI兼容配置
    'openai': {
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        timeout: 300000
    },
    // 智谱AI配置
    'zhipu': {
        baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: process.env.ZHIPU_API_KEY || '',
        model: process.env.ZHIPU_MODEL || 'glm-4-flashx',
        timeout: 300000
    },
    // 通义千问配置
    'qwen': {
        baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
        apiKey: process.env.QWEN_API_KEY || '',
        model: process.env.QWEN_MODEL || 'qwen-turbo',
        timeout: 300000
    },
    // 默认使用硅基流动
    'default': {
        baseURL: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
        timeout: 300000
    }
};

// 当前使用的provider
const CURRENT_PROVIDER = process.env.AI_PROVIDER || 'siliconflow';

function isProviderConfigured(provider) {
    const key = String(provider || '');
    const cfg = AI_CONFIG[key] || (key === 'openai-compatible' ? AI_CONFIG.default : null);
    if (!cfg) return false;
    if (key === 'ernie') return !!(cfg.apiKey && cfg.secretKey);
    return !!cfg.apiKey;
}

function resolveChatProvider() {
    const envProviderRaw = String(process.env.AI_PROVIDER || '').trim();
    const envProvider = envProviderRaw === 'openai-compatible' ? 'default' : envProviderRaw;
    if (envProvider === 'ernie' && isProviderConfigured('default')) return 'default';
    if (envProvider && isProviderConfigured(envProvider)) return envProvider;

    if (isProviderConfigured('default')) return 'default';
    if (isProviderConfigured('siliconflow')) return 'siliconflow';
    if (isProviderConfigured('openai')) return 'openai';
    return '';
}

/**
 * 检查AI服务是否配置
 */
const isConfigured = () => {
    const config = getConfig();
    if (CURRENT_PROVIDER === 'ernie') return !!(config.apiKey && config.secretKey);
    return !!config.apiKey;
};

/**
 * 获取当前provider配置
 */
const getConfig = () => {
    const key = CURRENT_PROVIDER === 'openai-compatible' ? 'default' : CURRENT_PROVIDER;
    return AI_CONFIG[key] || AI_CONFIG['default'];
};

/**
 * 获取服务状态信息
 */
const getServiceStatus = () => {
    const config = getConfig();
    return {
        provider: CURRENT_PROVIDER,
        model: config.model,
        configured: !!config.apiKey,
        baseURL: config.baseURL
    };
};

/**
 * 计算Token数量（粗略估算）
 * @param {string} text - 文本内容
 * @returns {number} - 估算的token数
 */
const estimateTokens = (text) => {
    if (!text) return 0;
    // 中文约2字符/token，英文约4字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
};

/**
 * 重试装饰器
 * @param {Function} fn - 要重试的函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 重试延迟(ms)
 */
const withRetry = async (fn, maxRetries = 3, delay = 1000) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.log(`[AI Service] 请求失败，第${i + 1}次重试...`, error?.message || error);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
    throw lastError;
};

/**
 * 文心一言access_token缓存
 */
let ernieAccessToken = null;
let ernieTokenExpireTime = 0;

/**
 * 获取文心一言access_token
 */
const getErnieAccessToken = async () => {
    const config = AI_CONFIG['ernie'];
    
    // 检查缓存是否有效（提前5分钟过期）
    if (ernieAccessToken && Date.now() < ernieTokenExpireTime - 5 * 60 * 1000) {
        console.log('[AI Service] 使用缓存的文心一言access_token');
        return ernieAccessToken;
    }
    
    console.log('[AI Service] 获取新的文心一言access_token');
    
    try {
        const url = new URL('https://aip.baidubce.com/oauth/2.0/token');
        url.search = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.apiKey,
            client_secret: config.secretKey
        }).toString();
        const response = await fetchJson(url.toString(), { method: 'POST', timeout: 30000 });
        const result = response.data;
        
        if (!result.access_token) {
            throw new Error('文心一言获取access_token失败：' + JSON.stringify(result));
        }
        
        ernieAccessToken = result.access_token;
        ernieTokenExpireTime = Date.now() + (result.expires_in * 1000);
        
        console.log('[AI Service] 文心一言access_token获取成功');
        return ernieAccessToken;
        
    } catch (error) {
        console.error('[AI Service] 文心一言获取access_token失败:', error.message);
        throw error;
    }
};

/**
 * 调用文心一言API
 */
const callErnieAPI = async ({ system, user, temperature, maxTokens }) => {
    const config = AI_CONFIG['ernie'];
    
    const requestFn = async () => {
        console.log('[AI Service] 使用文心一言 (ernie) provider');
        console.log('[AI Service] 模型:', config.model);
        
        // 获取access_token
        const accessToken = await getErnieAccessToken();
        
        // 构建文心一言消息格式（不支持system，合并到user）
        const messages = [];
        if (system) {
            messages.push({
                role: 'user',
                content: `【系统提示】${system}\n\n【用户请求】${user}`
            });
        } else {
            messages.push({ role: 'user', content: user });
        }
        
        const requestData = {
            messages: messages,
            temperature: Math.min(Math.max(temperature, 0.1), 1.0),
            max_output_tokens: maxTokens,
            disable_search: true,
            enable_citation: false
        };
        
        console.log('[AI Service] 请求数据:', JSON.stringify({
            messages: messages.map(m => ({
                role: m.role,
                content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
            }))
        }));
        
        // 文心一言模型到endpoint的映射
        const modelEndpoints = {
            'ernie-4.0-8k-latest': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-4.0-8k-latest',
            'ernie-4.0-turbo-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-4.0-turbo-8k',
            'ernie-3.5-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-3.5-8k',
            'ernie-3.5-128k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-3.5-128k'
        };
        
        const endpoint = modelEndpoints[config.model] || modelEndpoints['ernie-3.5-8k'];
        const url = new URL(`https://aip.baidubce.com${endpoint}`);
        url.search = new URLSearchParams({ access_token: accessToken }).toString();
        const response = await fetchJson(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
            timeout: config.timeout
        });
        const result = response.data;
        
        console.log('[AI Service] 响应状态:', response.status);
        
        if (result.error_code) {
            throw new Error(`文心一言错误 (${result.error_code}): ${result.error_msg}`);
        }
        
        if (!result.result) {
            throw new Error('文心一言响应格式错误：无返回结果');
        }
        
        const content = result.result;
        const usage = result.usage || {};
        
        return {
            success: true,
            content: content,
            model: config.model,
            usage: {
                prompt_tokens: usage.prompt_tokens || estimateTokens([system, user].filter(Boolean).join('')),
                completion_tokens: usage.completion_tokens || estimateTokens(content),
                total_tokens: usage.total_tokens || estimateTokens([system, user, content].filter(Boolean).join(''))
            }
        };
    };
    
    try {
        return await withRetry(requestFn);
    } catch (error) {
        if (error.response) {
            const { status, data } = error.response;
            console.error(`[AI Service] 文心一言HTTP错误 ${status}:`, JSON.stringify(data));
            throw new Error(`文心一言服务错误 (${status}): ${data?.error_msg || data?.message || '未知错误'}`);
        }
        console.error('[AI Service] 文心一言请求错误:', error.message);
        throw error;
    }
};

/**
 * 调用AI生成文本（统一接口）
 * @param {Object} params - 生成参数
 * @param {string} params.system - 系统提示词
 * @param {string} params.user - 用户提示词
 * @param {number} params.temperature - 温度参数 (0-2)
 * @param {number} params.maxTokens - 最大token数
 * @param {boolean} params.enableRetry - 是否启用重试
 * @returns {Promise<Object>} - 返回生成结果
 */
const generateText = async ({
    system,
    user,
    temperature = 0.7,
    maxTokens = 2000,
    enableRetry = true
}) => {
    const config = getConfig();
    
    if (!config.apiKey) {
        throw new Error('AI API未配置，请设置环境变量');
    }

    // 文心一言专用处理
    if (CURRENT_PROVIDER === 'ernie') {
        return await callErnieAPI({ system, user, temperature, maxTokens });
    }
    
    // OpenAI兼容格式处理
    const requestFn = async () => {
        console.log(`[AI Service] 使用 ${CURRENT_PROVIDER} provider`);
        console.log(`[AI Service] 模型: ${config.model}`);
        
        // 构建消息格式
        const messages = [];
        if (system) {
            messages.push({ role: 'system', content: system });
        }
        messages.push({ role: 'user', content: user });

        const requestData = {
            model: config.model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
        };

        console.log('[AI Service] 请求数据:', JSON.stringify({
            ...requestData,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
            }))
        }));

        const url = config.baseURL.replace(/\/$/, '') + '/chat/completions';
        const response = await fetchJson(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestData),
            timeout: config.timeout
        });
        const result = response.data;

        console.log('[AI Service] 响应状态:', response.status);
        
        if (!result.choices || result.choices.length === 0) {
            throw new Error('AI响应格式错误：无可用选项');
        }

        const content = result.choices[0].message.content;
        const usage = result.usage || {};

        return {
            success: true,
            content: content,
            model: result.model || config.model,
            usage: {
                prompt_tokens: usage.prompt_tokens || estimateTokens([system, user].filter(Boolean).join('')),
                completion_tokens: usage.completion_tokens || estimateTokens(content),
                total_tokens: usage.total_tokens || estimateTokens([system, user, content].filter(Boolean).join(''))
            }
        };
    };

    try {
        return enableRetry ? await withRetry(requestFn) : await requestFn();
    } catch (error) {
        console.error('[AI Service] 请求错误:', error.message);
        throw error;
    }
};

const generateTextWithProvider = async (provider, { system, user, temperature = 0.7, maxTokens = 2000, enableRetry = true }) => {
    const p = provider === 'openai-compatible' ? 'default' : String(provider || '').trim();
    const config = AI_CONFIG[p] || AI_CONFIG.default;

    if (p === 'ernie') {
        if (!(config.apiKey && config.secretKey)) throw new Error('文心一言未配置，请设置 ERNIE_API_KEY/ERNIE_SECRET_KEY');
        return await callErnieAPI({ system, user, temperature, maxTokens });
    }

    if (!config.apiKey) {
        throw new Error('AI API未配置，请设置 AI_API_KEY（OpenAI兼容）或 SILICONFLOW_API_KEY/OPENAI_API_KEY');
    }

    const requestFn = async () => {
        console.log(`[AI Service] 使用 ${p} provider`);
        console.log(`[AI Service] 模型: ${config.model}`);

        const messages = [];
        if (system) messages.push({ role: 'system', content: system });
        messages.push({ role: 'user', content: user });

        const requestData = {
            model: config.model,
            messages,
            temperature,
            max_tokens: maxTokens,
        };

        const url = config.baseURL.replace(/\/$/, '') + '/chat/completions';
        const response = await fetchJson(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestData),
            timeout: config.timeout
        });
        const result = response.data;

        if (!result?.choices || !result.choices.length) {
            console.error('[AI Service] API返回异常，完整响应:', JSON.stringify(result).slice(0, 500));
            throw new Error('AI响应格式错误：无可用选项');
        }

        const content = result.choices[0].message.content;
        const usage = result.usage || {};

        return {
            success: true,
            content,
            model: result.model || config.model,
            usage: {
                prompt_tokens: usage.prompt_tokens || estimateTokens([system, user].filter(Boolean).join('')),
                completion_tokens: usage.completion_tokens || estimateTokens(content),
                total_tokens: usage.total_tokens || estimateTokens([system, user, content].filter(Boolean).join(''))
            }
        };
    };

    return enableRetry ? await withRetry(requestFn) : await requestFn();
};

// ==================== 分镜拆分模块（v5.3 提示词编译体系）====================
// 设计参考：魔因漫创 + AI Comic Builder + 行业最佳实践
// 核心改动：
// 1. 新的system prompt让AI输出电影级专业提示词
// 2. 新的JSON结构包含visual_prompt/action_prompt/emotion_cue等结构化字段
// 3. 注入角色圣经确保跨镜头一致性

// ==================== 新的提示词模板 (v5.3) ====================

/**
 * v5.3 专业分镜系统提示词
 * 对标行业顶级工具的提示词质量
 */
const STORYBOARD_SYSTEM_PROMPT = `你是一位资深的漫剧分镜师，擅长将文学剧本转化为专业的电影级分镜脚本。

你的核心能力：
1. 剧本深度理解：不只是拆分文字，而是理解情节节奏、情绪曲线、戏剧冲突
2. 视觉语言转化：将文学描述转化为AI绘图模型可理解的专业提示词
3. 镜头语法：精通景别选择、构图法则、运镜设计、光影氛围营造
4. 色彩脚本：为每个镜头设计精确的色彩方案，包含hex色值

工作原则：
- 每个镜头必须是一个完整的视觉指令，不是文字截取
- 动作描述必须是物理级的（不说"他很难过"，而说"肩膀下沉，嘴角微颤，眼角泛红"）
- 光影必须具体到色温K值和光位
- 色彩必须精确到hex值和占比
- 构图必须指明具体法则（三分法/对角线/对称/引导线等）
- 角色用@引用标记，确保跨镜头一致性

镜头节奏规则：
- 环境交代：远景→全景→中景（缓慢推进），2-3个镜头
- 对话场景：全景(交代)→中景(A)→近景(B)→近景(A)→中景(双人)，3-5个镜头
- 动作/冲突：全景→中景→近景→特写→全景（高频切换），4-6个镜头
- 情绪特写：中景→近景→特写→大特写（递进聚焦），3-4个镜头
- 过渡/行走：全景→中景(跟拍)，2个镜头
- 关键线索：中景→特写→大特写（逐步放大），3个镜头

输出规则：
1. 严格输出JSON，不要任何解释性文字
2. 每个镜头必须有完整的visual_prompt结构
3. 禁止重复镜头
4. 禁止第二人称（你/你们），用具体角色名`;

const STORYBOARD_USER_TEMPLATE = `请将以下剧本拆分为结构化JSON。

【角色圣经】（拆分时必须使用@引用标记角色）
{{character_bible}}

【剧本标题】
{{title}}

【剧本原文】
{{content}}

【输出格式】
{
  "scenes": [
    {
      "episode": "集号",
      "scene_number": "场号",
      "title": "场景名称",
      "location": "具体地点",
      "time_of_day": "日内/夜内/日外/夜外/黄昏/黎明",
      "characters": ["出场角色名"],
      "content": "该场景原文",
      "shots": [
        {
          "shot_number": 1,
          "shot_type": "远景/全景/中景/近景/特写/大特写",
          "camera_angle": "平视/俯视/仰视/侧视",
          "camera_movement": "固定/推镜头/拉镜头/移镜头/摇镜头/跟镜头/环绕",
          "duration": 3,
          
          "visual_prompt": {
            "lighting": "光影描述（含色温如3200K）和光位",
            "color_palette": "主色XX% #HEX，辅色XX% #HEX，点缀色XX% #HEX",
            "character_placement": "@角色名 位置和朝向",
            "facial_detail": "具体面部表情细节",
            "scene_description": "环境细节描述",
            "composition": "构图法则（三分法/对角线/对称/引导线等）"
          },
          
          "action_prompt": {
            "physical_action": "物理级动作描述（精确到关节运动）",
            "micro_movement": "微动作细节"
          },
          
          "emotion_cue": {
            "primary_emotion": "主要情绪",
            "visual_mapping": "视觉映射方案"
          },
          
          "dialogue": "该镜头台词（无则空字符串）",
          "narration": "旁白（如有）",
          "scene_reference": "@场景名",
          "original_text": "对应原文片段"
        }
      ]
    }
  ]
}

【强制约束】
- 每个场景至少3个镜头，对话场景每句台词占一个镜头
- 景别必须有变化，不要全是特写或全是远景
- visual_prompt的lighting必须写具体色温如"黄昏侧逆光，色温3200K，金色光晕"
- visual_prompt的color_palette必须包含hex色值如"#E8913A"
- visual_prompt的composition必须指明构图法则如"三分法构图，人物位于右侧交叉点"
- action_prompt必须是物理级描述，如"修长的手指缓慢攥紧衣角，指节发白"
- 角色必须用@引用标记，如@林川、@苏晚
- 场景用@引用标记，如@废弃车站`;

// ==================== 摄影预设映射表 ====================

const SHOT_TYPE_MAP = {
    '远景': { en: 'Wide Shot', promptToken: 'wide shot, establishing shot, distant view' },
    '全景': { en: 'Long Shot', promptToken: 'long shot, full body visible' },
    '中远景': { en: 'Medium Long Shot', promptToken: 'medium long shot, knee level' },
    '中景': { en: 'Medium Shot', promptToken: 'medium shot, waist level' },
    '中近景': { en: 'Medium Close-Up', promptToken: 'medium close-up, chest level' },
    '近景': { en: 'Close-Up', promptToken: 'close-up, face and shoulders' },
    '特写': { en: 'Close-Up', promptToken: 'extreme close-up, face detail' },
    '大特写': { en: 'Extreme Close-Up', promptToken: 'extreme close-up, specific detail' },
    '主观': { en: 'POV Shot', promptToken: 'point of view shot, first person' }
};

const CAMERA_MOVEMENT_MAP = {
    '固定': 'static camera, locked',
    '推镜头': 'slow dolly in, camera pushes forward',
    '拉镜头': 'slow dolly out, camera pulls back',
    '移镜头': 'lateral tracking shot, camera moves sideways',
    '摇镜头': 'panning shot, camera rotates horizontally',
    '跟镜头': 'tracking shot, camera follows subject',
    '升降镜头': 'crane shot, vertical movement',
    '环绕': 'orbit shot, camera circles around subject'
};

const TIME_OF_DAY_MAP = {
    '日内': { light: 'indoor natural light through windows', mood: 'warm and clear' },
    '夜内': { light: 'indoor warm artificial light, lamp or overhead', mood: 'intimate or tense' },
    '日外': { light: 'bright natural sunlight', mood: 'open and clear' },
    '夜外': { light: 'moonlight or street lamps, cold tones', mood: 'mysterious or lonely' },
    '黄昏': { light: 'golden hour, warm orange sunset', mood: 'melancholic or romantic' },
    '黎明': { light: 'soft dawn light, pale blue and gold', mood: 'hopeful or quiet' }
};

// ==================== 三层提示词编译器 ====================

/**
 * 编译首帧提示词（用于生成静态图片）
 */
function compileImagePrompt(shot, scene, characters) {
    characters = characters || [];
    var parts = [];
    
    var shotTypeInfo = SHOT_TYPE_MAP[shot.shot_type] || SHOT_TYPE_MAP['中景'];
    parts.push(shotTypeInfo.promptToken);
    
    if (characters.length > 0) {
        parts.push(characters.map(function(c) { return c.visualTraits || c.name; }).join(', '));
    }
    
    if (shot.visual_prompt) {
        parts.push(shot.visual_prompt);
    }
    
    var timeInfo = TIME_OF_DAY_MAP[scene.time_of_day] || TIME_OF_DAY_MAP['日内'];
    parts.push(timeInfo.light + ', ' + timeInfo.mood);
    
    parts.push('high quality, detailed, cinematic composition');
    
    return parts.filter(Boolean).join(', ');
}

/**
 * 编译视频提示词（用于生成动态视频）
 */
function compileVideoPrompt(shot, scene, characters) {
    characters = characters || [];
    var parts = [];
    
    if (shot.action_description) {
        parts.push(shot.action_description);
    }
    
    var movementToken = CAMERA_MOVEMENT_MAP[shot.camera_movement] || 'static camera';
    parts.push(movementToken);
    
    var timeInfo = TIME_OF_DAY_MAP[scene.time_of_day] || TIME_OF_DAY_MAP['日内'];
    parts.push(timeInfo.mood + ' atmosphere');
    
    if (shot.dialogue && shot.dialogue.trim()) {
        parts.push('character speaking with lip sync');
    }
    
    return parts.filter(Boolean).join(', ');
}

/**
 * 编译尾帧提示词（仅在大位移/变身/转场时需要）
 */
function compileEndFramePrompt(shot, scene) {
    if (!shot.needs_end_frame) return null;
    
    var parts = [];
    var shotTypeInfo = SHOT_TYPE_MAP[shot.shot_type] || SHOT_TYPE_MAP['中景'];
    parts.push(shotTypeInfo.promptToken);
    
    if (shot.visual_prompt) {
        parts.push(shot.visual_prompt);
    }
    
    var timeInfo = TIME_OF_DAY_MAP[scene.time_of_day] || TIME_OF_DAY_MAP['日内'];
    parts.push(timeInfo.light + ', ' + timeInfo.mood);
    
    return parts.filter(Boolean).join(', ');
}

// ==================== 模板引擎 ====================

function interpolateTemplate(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
        return variables[key] !== undefined ? String(variables[key]) : '';
    });
}

// ==================== JSON提取与解析 ====================

function extractFirstJsonObject(text) {
    if (!text) return null;
    var cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    var firstBrace = cleaned.indexOf('{');
    var lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    
    var jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    jsonStr = jsonStr.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    
    return jsonStr;
}

function parseJsonWithFallback(jsonText) {
    if (!jsonText) throw new Error('AI返回内容无法解析为JSON');

    // 第一次：直接解析
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.log('[AI Service] 首次JSON解析失败，尝试修复...');
    }

    // 第二次：清理控制字符
    try {
        var cleaned = jsonText.replace(/[\x00-\x1f]/g, ' ');
        return JSON.parse(cleaned);
    } catch (e) {
        console.log('[AI Service] 二次清理后仍失败，尝试补括号修复...');
    }

    // 第三次：清理尾逗号 + 补括号
    try {
        var fixed = jsonText.replace(/,(\s*[}\]])/g, '$1');
        var openBraces = (fixed.match(/{/g) || []).length;
        var closeBraces = (fixed.match(/}/g) || []).length;
        while (closeBraces < openBraces) { fixed += '}'; closeBraces++; }
        var openBrackets = (fixed.match(/\[/g) || []).length;
        var closeBrackets = (fixed.match(/]/g) || []).length;
        while (closeBrackets < openBrackets) { fixed += ']'; closeBrackets++; }
        return JSON.parse(fixed);
    } catch (e) {
        console.log('[AI Service] 补括号修复失败，尝试智能截断...');
    }

    // 第四次：智能截断修复
    try {
        var truncated = repairTruncatedJson(jsonText);
        if (truncated) return truncated;
    } catch (e) {
        console.log('[AI Service] 智能截断修复失败');
    }

    console.error('[AI Service] JSON全部修复尝试失败，原始内容前300字符:', jsonText.slice(0, 300));
    throw new Error('AI返回JSON解析失败（输出可能被截断，可尝试缩短剧本或分段拆分）');
}

/**
 * 智能截断修复：JSON被截断时，回退到最后一个完整对象，补齐闭合
 */
function repairTruncatedJson(jsonText) {
    if (!jsonText) return null;

    // 压缩空白方便定位
    var compressed = jsonText.replace(/\s+/g, ' ').trim();

    // 策略1：找最后一个完整shot对象
    var lastShotEnd = findLastCompleteObject(compressed, ['shot_number', 'dialogue']);
    if (lastShotEnd > 0) {
        var repaired = compressed.substring(0, lastShotEnd + 1);
        repaired = repaired.replace(/,\s*$/, '');
        repaired += ']}]}';
        repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
        try {
            var result = JSON.parse(repaired);
            if (result.scenes && result.scenes[0] && result.scenes[0].shots && result.scenes[0].shots.length > 0) {
                console.log('[AI Service] 智能截断修复成功（镜头级别），保留了' + result.scenes[0].shots.length + '个镜头');
                return result;
            }
        } catch (e) {
            console.log('[AI Service] 镜头级截断修复失败，尝试暴力回退...');
        }
    }

    // 策略2：暴力回退——从后往前找}逐个尝试截断+补闭合
    for (var i = compressed.length - 1; i >= Math.max(0, compressed.length - 10000); i--) {
        if (compressed[i] === '}') {
            var candidate = compressed.substring(0, i + 1);
            candidate = candidate.replace(/,\s*$/, '');
            var ob = (candidate.match(/{/g) || []).length;
            var cb = (candidate.match(/}/g) || []).length;
            var obr = (candidate.match(/\[/g) || []).length;
            var cbr = (candidate.match(/]/g) || []).length;
            while (cbr < obr) { candidate += ']'; cbr++; }
            while (cb < ob) { candidate += '}'; cb++; }
            candidate = candidate.replace(/,(\s*[}\]])/g, '$1');
            try {
                var result2 = JSON.parse(candidate);
                if (result2.scenes && result2.scenes.length > 0 && result2.scenes[0].shots && result2.scenes[0].shots.length > 0) {
                    console.log('[AI Service] 暴力回退修复成功，保留了' + result2.scenes.length + '个场景');
                    return result2;
                }
            } catch (e) {
                // 继续尝试
            }
        }
    }

    return null;
}

/**
 * 从压缩文本中找最后一个包含指定字段的完整JSON对象的结束位置
 */
function findLastCompleteObject(text, requiredFields) {
    for (var i = text.length - 1; i >= 0; i--) {
        if (text[i] === '}') {
            var checkRange = text.substring(Math.max(0, i - 3000), i + 1);
            var allFound = true;
            for (var f = 0; f < requiredFields.length; f++) {
                if (checkRange.indexOf('"' + requiredFields[f] + '"') < 0) {
                    allFound = false;
                    break;
                }
            }
            if (allFound) return i;
        }
    }
    return -1;
}

// ==================== 数据标准化 (v5.3 增强版) ====================

function normalizeStoryboard(data) {
    if (!data || !Array.isArray(data.scenes)) {
        throw new Error('AI返回JSON缺少scenes数组');
    }
    
    var validShotTypes = new Set(Object.keys(SHOT_TYPE_MAP));
    var validMovements = new Set(Object.keys(CAMERA_MOVEMENT_MAP));
    var validCameraAngles = new Set(['平视', '俯视', '仰视', '侧视', '斜视']);
    var fallbackShotTypes = ['远景', '全景', '中景', '近景', '特写', '大特写'];
    var fallbackMovements = ['固定', '推镜头', '移镜头', '摇镜头', '跟镜头'];
    var fallbackCameraAngles = ['平视', '俯视', '仰视', '侧视'];
    
    for (var si = 0; si < data.scenes.length; si++) {
        var scene = data.scenes[si];
        scene.episode = String(scene.episode || '1');
        scene.scene_number = String(scene.scene_number || '1');
        scene.title = String(scene.title || scene.location || '未命名场景');
        scene.location = String(scene.location || scene.title || '未命名地点');
        scene.time_of_day = String(scene.time_of_day || '日内');
        scene.characters = Array.isArray(scene.characters) ? scene.characters.map(String) : [];
        scene.content = String(scene.content || '');
        
        if (!Array.isArray(scene.shots)) scene.shots = [];
        
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            shot.shot_number = i + 1;
            
            // 景别标准化
            if (!validShotTypes.has(shot.shot_type)) {
                shot.shot_type = fallbackShotTypes[i % fallbackShotTypes.length];
            }
            
            // 运镜标准化
            if (!validMovements.has(shot.camera_movement)) {
                shot.camera_movement = fallbackMovements[i % fallbackMovements.length];
            }
            
            // 摄影角度标准化 (v5.3新增)
            if (!validCameraAngles.has(shot.camera_angle)) {
                shot.camera_angle = fallbackCameraAngles[i % fallbackCameraAngles.length];
            }
            
            shot.duration = Number(shot.duration) || 3;
            shot.original_text = String(shot.original_text || '').trim();
            shot.dialogue = String(shot.dialogue || '').trim();
            shot.narration = String(shot.narration || '').trim();
            shot.scene_reference = String(shot.scene_reference || '').trim();
            
            // v5.3: 处理visual_prompt结构
            if (typeof shot.visual_prompt === 'object' && shot.visual_prompt !== null) {
                // 已经是结构化对象，保持原样
                shot.visual_prompt = {
                    lighting: String(shot.visual_prompt.lighting || '').trim(),
                    color_palette: String(shot.visual_prompt.color_palette || '').trim(),
                    character_placement: String(shot.visual_prompt.character_placement || '').trim(),
                    facial_detail: String(shot.visual_prompt.facial_detail || '').trim(),
                    scene_description: String(shot.visual_prompt.scene_description || '').trim(),
                    composition: String(shot.visual_prompt.composition || '').trim()
                };
            } else {
                // 旧格式兼容：将字符串转为结构化对象
                var oldPrompt = String(shot.visual_prompt || shot.visual_description || '').trim();
                shot.visual_prompt = {
                    lighting: oldPrompt || '',
                    color_palette: '',
                    character_placement: '',
                    facial_detail: '',
                    scene_description: oldPrompt,
                    composition: ''
                };
            }
            
            // v5.3: 处理action_prompt结构
            if (typeof shot.action_prompt === 'object' && shot.action_prompt !== null) {
                shot.action_prompt = {
                    physical_action: String(shot.action_prompt.physical_action || '').trim(),
                    micro_movement: String(shot.action_prompt.micro_movement || '').trim()
                };
            } else {
                // 旧格式兼容
                var oldAction = String(shot.action_prompt || shot.action_description || '').trim();
                shot.action_prompt = {
                    physical_action: oldAction,
                    micro_movement: ''
                };
            }
            
            // v5.3: 处理emotion_cue结构
            if (typeof shot.emotion_cue === 'object' && shot.emotion_cue !== null) {
                shot.emotion_cue = {
                    primary_emotion: String(shot.emotion_cue.primary_emotion || '').trim(),
                    visual_mapping: String(shot.emotion_cue.visual_mapping || '').trim()
                };
            } else {
                shot.emotion_cue = {
                    primary_emotion: '',
                    visual_mapping: ''
                };
            }
            
            // 为兼容前端，生成综合description
            shot.description = shot.visual_prompt.scene_description || shot.visual_prompt.lighting || '';
            shot.action_description = shot.action_prompt.physical_action;
        }
    }
    
    return data;
}

/**
 * 为每个shot编译三层提示词
 */
function compilePromptsForStoryboard(data, characters) {
    characters = characters || [];
    if (!data || !data.scenes) return data;
    
    for (var si = 0; si < data.scenes.length; si++) {
        var scene = data.scenes[si];
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            shot.image_prompt = compileImagePrompt(shot, scene, characters);
            shot.image_prompt_zh = shot.visual_prompt;
            shot.video_prompt = compileVideoPrompt(shot, scene, characters);
            shot.video_prompt_zh = shot.action_description;
            
            shot.needs_end_frame = /变身|变形|大幅|飞跃|奔跑|冲出|转场/.test(
                shot.action_description + shot.visual_prompt
            );
            
            if (shot.needs_end_frame) {
                shot.end_frame_prompt = compileEndFramePrompt(shot, scene);
                shot.end_frame_prompt_zh = '';
            }
        }
    }
    
    return data;
}

// ==================== 主函数 ====================

/**
 * 从剧本生成分镜（v5.3 增强版）
 * @param {Object} params - 包含title, content, character_bible
 */
async function generateStoryboardFromScript(params) {
    var title = params.title;
    var content = params.content;
    var characterBible = params.character_bible || '';
    var scriptTitle = String(title || '').trim();
    var scriptContent = String(content || '').trim();
    
    if (!scriptContent) {
        throw new Error('剧本内容为空');
    }
    
    var provider = resolveChatProvider();
    if (!provider) {
        throw new Error('未配置可用的大模型接口。请在 backend/.env 按 backend/.env.example 添加：AI_PROVIDER=openai-compatible、AI_API_KEY、AI_BASE_URL、AI_MODEL（推荐），然后重试上传。');
    }
    
    var systemPrompt = STORYBOARD_SYSTEM_PROMPT;
    var userPrompt = interpolateTemplate(STORYBOARD_USER_TEMPLATE, {
        title: scriptTitle || '未命名剧本',
        content: scriptContent,
        character_bible: characterBible || '（暂无角色信息）'
    });
    
    var result;
    try {
        result = await generateTextWithProvider(provider, {
            system: systemPrompt,
            user: userPrompt,
            temperature: 0.2,
            maxTokens: 16000,
            enableRetry: true
        });
    } catch (e) {
        var msg = String(e && e.message || '');
        if (provider === 'ernie' && /client_id|client id|invalid|无效/i.test(msg)) {
            throw new Error('文心一言鉴权失败（client_id 无效）。请在 backend/.env 配置可用的 OpenAI兼容接口：AI_API_KEY / AI_BASE_URL / AI_MODEL（或配置 SILICONFLOW_API_KEY），然后重试上传。');
        }
        throw e;
    }
    
    var jsonText = extractFirstJsonObject(result.content);
    var parsed = parseJsonWithFallback(jsonText);
    var normalized = normalizeStoryboard(parsed);
    var compiled = compilePromptsForStoryboard(normalized);
    
    if (!compiled.scenes.length) {
        throw new Error('AI返回JSON缺少有效场景');
    }
    
    return {
        success: true,
        provider: provider,
        model: result.model,
        usage: result.usage,
        data: compiled
    };
}

const generateScript = async (params) => {
    const {
        genre = '原创',
        theme,
        protagonist,
        supporting,
        setting = '现代都市',
        conflict,
        style = '自然',
        duration = 5
    } = params;

    // 构建剧本生成提示词
    const systemPrompt = `你是一位专业的漫剧剧本作家，擅长创作富有戏剧性的短剧剧本。
请根据用户的需求生成完整的漫剧剧本。
剧本格式要求：
1. 使用Markdown格式
2. 包含场景描述（用**场景：**标记）
3. 角色对话使用【角色名】：格式
4. 旁白使用旁白：格式
5. 包含动作/表情时使用（动作）格式
6. 剧本时长约${duration}分钟，约800-1500字`;

    const userPrompt = `请创作一个${genre}题材的漫剧剧本，具体要求如下：

【剧本题材】${genre}
【剧本主题】${theme || '一个关于成长和选择的故事'}
【主角设定】${protagonist || '一个普通的年轻人'}
【配角设定】${supporting || '主角的朋友或家人'}
【故事背景】${setting}
【主要冲突】${conflict || '主角面临的选择和挑战'}
【剧本风格】${style}
【预估时长】约${duration}分钟

请生成一个结构完整、有戏剧冲突的剧本，包含：
- 开场（建立场景和人物）
- 发展（冲突出现）
- 高潮（矛盾激化）
- 结局（解决或留下悬念）

请确保：
1. 对话自然生动，符合角色性格
2. 场景描写简洁有力
3. 有明确的情节推进
4. 适合制作成短视频`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.8,
        maxTokens: 3000
    });

    // 计算字数（去除Markdown格式符号）
    const wordCount = result.content.replace(/[#*\[\]【】]/g, '').length;

    return {
        success: true,
        content: result.content,
        word_count: wordCount,
        tokens: result.usage.total_tokens
    };
};

/**
 * 续写剧本
 * @param {string} currentScript - 当前剧本内容
 * @param {string} characters - 角色设定
 * @param {string} continueHint - 续写提示
 */
const continueScript = async (currentScript, characters, continueHint) => {
    const systemPrompt = `你是一位专业的漫剧剧本作家，擅长续写故事。
请在保持原有风格和角色的基础上，继续发展剧情。
续写时要注意：
1. 保持剧情连贯性
2. 保持角色性格一致
3. 可以增加新的冲突或转折
4. 控制续写长度适中`;
    
    const userPrompt = `请续写以下漫剧剧本：

【当前剧本】
${currentScript}

【角色设定】
${characters || '主角和配角'}

【续写提示】
${continueHint || '继续发展剧情，保持原有风格'}`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.8,
        maxTokens: 2000
    });

    return {
        success: true,
        content: result.content,
        tokens: result.usage.total_tokens
    };
};

/**
 * 生成角色对话
 * @param {Object} params - 对话参数
 */
const generateDialogue = async ({ characters, prompt, emotion }) => {
    const systemPrompt = `你是一位专业的剧本对话作家，擅长创作生动的角色对话。
请生成符合要求的角色对话，注意：
1. 对话自然流畅
2. 符合角色性格
3. 有情感张力
4. 可以加入动作描写`;
    
    const userPrompt = `请生成一段角色对话：

【角色】
${characters}

【对话主题】
${prompt || '日常对话'}

【情感基调】
${emotion || '自然'}

要求：约200-400字`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.8,
        maxTokens: 1500
    });

    return {
        success: true,
        content: result.content,
        tokens: result.usage.total_tokens
    };
};

/**
 * 生成场景描述
 * @param {Object} params - 场景参数
 */
const generateSceneDescription = async ({ setting, atmosphere }) => {
    const systemPrompt = `你是一位专业的剧本场景描写作家，擅长创作富有画面感的场景描述。
请从光线、色彩、声音、氛围等角度进行描写，让读者能够"看见"这个场景。`;
    
    const userPrompt = `请描述一个场景：

【场景地点】
${setting || '一个普通的地方'}

【氛围要求】
${atmosphere || '自然'}

请从光线、色彩、声音、氛围等角度进行描写，约100-200字。`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.7,
        maxTokens: 800
    });

    return {
        success: true,
        content: result.content,
        tokens: result.usage.total_tokens
    };
};

/**
 * 生成标题
 * @param {Object} params - 标题参数
 */
const generateTitle = async ({ script, genre, theme, style }) => {
    const systemPrompt = `你是一位专业的营销文案专家，擅长为短视频/漫剧创作吸引人的标题。
请生成5-10个有吸引力的标题，这些标题应该：
1. 简洁有力，能在3秒内抓住注意力
2. 引发好奇或共鸣
3. 适合短视频平台传播
4. 可以使用疑问句、反问句、数字、悬念等技巧`;
    
    const userPrompt = `请为以下漫剧内容生成吸引人的标题：

【剧本内容】
${script ? script.substring(0, 500) : ''}

【题材类型】
${genre || '通用'}

【主题】
${theme || '未指定'}

【风格】
${style || '自然'}

请生成5-10个标题，每个标题不超过20个字，按吸引力排序。`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.9,
        maxTokens: 1000
    });

    // 解析标题列表
    const titles = result.content
        .split(/[\n\r]/)
        .map(line => line.replace(/^\d+[.、)]\s*/, '').trim())
        .filter(line => line.length > 0 && line.length <= 20);

    return {
        success: true,
        titles: titles.slice(0, 10),
        tokens: result.usage.total_tokens
    };
};

/**
 * 批量生成内容（用于营销物料）
 * @param {Object} params - 生成参数
 */
const batchGenerate = async ({ type, content, count = 3, style }) => {
    const systemPrompt = `你是一位专业的营销内容创作者，擅长批量生成营销物料。
请根据要求批量生成内容，保证质量和多样性。`;
    
    const userPrompt = `请生成${count}个${type || '标题'}，要求：
- 每个都要有吸引力
- 风格：${style || '自然'}
- 内容相关：${content || '无'}
- 多样性：避免重复

请直接输出内容，每行一个，不要编号。`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.9,
        maxTokens: 1500
    });

    const items = result.content
        .split(/[\n\r]/)
        .map(line => line.replace(/^\d+[.、)]\s*/, '').trim())
        .filter(line => line.length > 0);

    return {
        success: true,
        items: items.slice(0, count),
        tokens: result.usage.total_tokens
    };
};

/**
 * 生成封面描述词（用于AI绘图）
 * @param {Object} params - 封面参数
 */
const generateCoverPrompt = async ({ title, genre, style, mood }) => {
    const systemPrompt = `你是一位专业的AI绘图提示词工程师，擅长为各种场景生成精准的绘图提示词。
请生成适合AI绘图工具使用的英文提示词。`;
    
    const userPrompt = `请为以下漫剧封面生成AI绘图提示词：

【标题】
${title || '漫剧封面'}

【题材】
${genre || '通用'}

【风格】
${style || '现代简约'}

【情绪氛围】
${mood || '神秘'}

请生成：
1. 英文提示词（用于AI绘图）
2. 中文描述（用于参考）

格式：
[英文提示词]: ...
[中文描述]: ...`;

    const result = await generateText({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.8,
        maxTokens: 1000
    });

    return {
        success: true,
        content: result.content,
        tokens: result.usage.total_tokens
    };
};

module.exports = {
    isConfigured,
    getConfig,
    getServiceStatus,
    estimateTokens,
    generateText,
    generateStoryboardFromScript,
    generateScript,
    continueScript,
    generateDialogue,
    generateSceneDescription,
    generateTitle,
    batchGenerate,
    generateCoverPrompt,
    AI_CONFIG,
    CURRENT_PROVIDER,
    compileImagePrompt,
    compileVideoPrompt,
    compileEndFramePrompt,
    interpolateTemplate,
    extractFirstJsonObject,
    parseJsonWithFallback,
    normalizeStoryboard,
    compilePromptsForStoryboard,
    SHOT_TYPE_MAP,
    CAMERA_MOVEMENT_MAP,
    TIME_OF_DAY_MAP,
    STORYBOARD_SYSTEM_PROMPT,
    STORYBOARD_USER_TEMPLATE
};

// ==================== v5.0 角色一致性系统 ====================

const { calibrateCharacterAnchors, compileCharacterPrompt } = require('./character_calibration');

module.exports = {
    ...module.exports,
    // v5.0 角色校准
    calibrateCharacterAnchors,
    compileCharacterPrompt
};
