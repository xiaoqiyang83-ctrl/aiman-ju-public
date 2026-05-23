/**
 * AI服务 - 支持多种AI后端（增强版）
 * 文心一言 / OpenAI / Claude / 硅基流动 / 智谱 等
 * 包含错误处理、重试机制、Token计算
 */

// v6.1 引入分镜校验中间件
var validateStoryboard = require('../middleware/validateStoryboard');

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
4. 禁止第二人称（你/你们），用具体角色名

【台词规则 - 强制执行，违反即错误】
1. 每句台词必须以@角色名开头，格式：@角色名：台词内容。绝对不允许只写台词不标注说话人。
2. 同一组对话（角色间连续对话）必须放在同一个分镜中，不得拆到两个分镜。
3. 每个分镜最多2条台词，超过2条必须拆分为多个分镜。
4. 禁止在最后几个分镜堆叠大量台词收尾。

正确示例：
- dialogue: "@队长：啊！你到底是什么人？"
- dialogue: "@张扬：哼，不过如此\n@队长：怎么可能！"

错误示例（绝对禁止）：
- dialogue: "啊！队长" ← 缺少说话人
- dialogue: "你到底是什么人？；他竟然能驱使S级丧尸！；哼，美" ← 多人多句堆叠

【台词完整性要求】
- 剧本原文中的每一句对话都必须出现在某个镜头的dialogue字段中，一句都不能漏
- 优先级：台词完整性 > 镜头数量。宁可多加镜头，也不能遗漏台词
- 空镜头（远景交代环境、转场）可以没有dialogue，但对话镜头必须包含完整台词
- 一句台词只出现在一个镜头中，不要拆分也不要重复
- **严禁将多句台词堆在一个镜头里**！每句对话必须独占一个镜头，这是硬性规则
- dialogue字段格式必须为"@角色名：台词内容"，必须标注说话人角色名
- 如果原文是"张三：你好"，dialogue必须填"@张三：你好"，不能只填"你好"`;

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
 * v6.1: 从visual_prompt结构化字段编译完整英文提示词，解决图片和描述不一致的问题
 */
function compileImagePrompt(shot, scene, characters) {
    characters = characters || [];
    var parts = [];
    
    // 1. 景别
    var shotTypeInfo = SHOT_TYPE_MAP[shot.shot_type] || SHOT_TYPE_MAP['中景'];
    parts.push(shotTypeInfo.promptToken);
    
    // 2. 角色视觉特征
    if (characters.length > 0) {
        var charDescs = [];
        for (var ci = 0; ci < characters.length; ci++) {
            var c = characters[ci];
            if (c.visualTraits) {
                charDescs.push(c.visualTraits);
            } else if (c.name) {
                charDescs.push(c.name);
            }
        }
        if (charDescs.length > 0) {
            parts.push(charDescs.join(', '));
        }
    }
    
    // 3. 从visual_prompt结构化字段提取（核心修复）
    var vp = shot.visual_prompt;
    if (vp && typeof vp === 'object') {
        if (vp.scene_description) parts.push(vp.scene_description);
        if (vp.lighting) parts.push(vp.lighting);
        if (vp.color_palette) parts.push(vp.color_palette);
        if (vp.character_placement) parts.push(vp.character_placement);
        if (vp.facial_detail) parts.push(vp.facial_detail);
        if (vp.composition) parts.push(vp.composition);
    } else if (vp && typeof vp === 'string' && vp.trim()) {
        parts.push(vp);
    }
    
    // 4. 动作提示词
    var ap = shot.action_prompt;
    if (ap && typeof ap === 'object' && ap.physical_action) {
        parts.push(ap.physical_action);
    }
    
    // 5. 情绪提示词
    var ec = shot.emotion_cue;
    if (ec && typeof ec === 'object') {
        if (ec.primary_emotion) parts.push(ec.primary_emotion + ' mood');
        if (ec.visual_mapping) parts.push(ec.visual_mapping);
    }
    
    // 6. 时间/光线
    var timeInfo = TIME_OF_DAY_MAP[scene.time_of_day] || TIME_OF_DAY_MAP['日内'];
    parts.push(timeInfo.light + ', ' + timeInfo.mood);
    
    // 7. 画质标签
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
            
            // v7.0 初始化新字段默认值
            if (!shot.emotion) {
                shot.emotion = {
                    type: shot.emotion_cue && shot.emotion_cue.primary_emotion || '',
                    score: 5
                };
            }
            if (!shot.climax) {
                shot.climax = {
                    type: '',
                    score: 0,
                    level: '普通'
                };
            }
            if (!shot.retention) {
                shot.retention = {
                    score: 7,
                    risk: 'low'
                };
            }
            if (!shot.shot) {
                shot.shot = {
                    type: shot.shot_type,
                    angle: shot.camera_angle
                };
            }
            if (!shot.camera) {
                shot.camera = {
                    movement: shot.camera_movement,
                    speed: 'normal'
                };
            }
            if (!shot.lighting) {
                shot.lighting = {
                    color: shot.visual_prompt && shot.visual_prompt.lighting || ''
                };
            }
            if (!shot.sound) {
                shot.sound = {
                    effect: ''
                };
            }
        }
    }
    
    // 台词兜底：如果AI没给dialogue，从场景原文提取并分配
    for (var si = 0; si < data.scenes.length; si++) {
        var scene = data.scenes[si];
        if (!Array.isArray(scene.shots) || !scene.shots.length) continue;
        
        var nonEmptyCount = scene.shots.filter(function(s) { return String(s.dialogue || '').trim(); }).length;
        // 如果所有镜头都没台词，尝试从场景原文提取
        if (nonEmptyCount === 0 && scene.content) {
            var dialogues = extractDialoguesFromSceneContent(scene.content);
            if (dialogues.length > 0) {
                var dIdx = 0;
                for (var i = 0; i < scene.shots.length; i++) {
                    if (!String(scene.shots[i].dialogue || '').trim() && dIdx < dialogues.length) {
                        scene.shots[i].dialogue = dialogues[dIdx];
                        dIdx++;
                    }
                    // 同时补original_text
                    if (!String(scene.shots[i].original_text || '').trim()) {
                        scene.shots[i].original_text = scene.shots[i].dialogue || scene.content;
                    }
                }
                // 多余台词追加到最后一个镜头
                while (dIdx < dialogues.length) {
                    var lastShot = scene.shots[scene.shots.length - 1];
                    if (lastShot) {
                        lastShot.dialogue = lastShot.dialogue ? lastShot.dialogue + '；' + dialogues[dIdx] : dialogues[dIdx];
                    }
                    dIdx++;
                }
            } else {
                // 从每个镜头的original_text里提取引号台词
                for (var i = 0; i < scene.shots.length; i++) {
                    var orig = String(scene.shots[i].original_text || '').trim();
                    if (!orig) {
                        scene.shots[i].original_text = scene.content;
                        orig = scene.content;
                    }
                    var quotedMatch = String(orig).match(/"([^"]+)"|「([^」]+)」|"([^"]+)"/);
                    if (quotedMatch) {
                        scene.shots[i].dialogue = (quotedMatch[1] || quotedMatch[2] || quotedMatch[3] || '').trim();
                    }
                    if (!scene.shots[i].dialogue) {
                        var colonMatch = String(orig).match(/[\u4e00-\u9fa5]{1,8}[：:]\s*(.+)$/);
                        if (colonMatch) scene.shots[i].dialogue = String(colonMatch[1] || '').trim();
                    }
                }
            }
        }
    }
    
    return data;
}

/**
 * 从场景原文提取台词
 */
function extractDialoguesFromSceneContent(content) {
    var t = String(content || '');
    var dialogues = [];
    var lines = t.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        if (/^(人物|场景|地点|时间|道具|备注|场次)[：:]/.test(line)) continue;
        if (/^(第.{1,3}集|第.{1,3}场)/.test(line)) continue;
        // 格式1: 角色：台词
        var m1 = line.match(/^(.{1,16}?)(?:\s*[（(]([^)）]+)[)）])?\s*(VO|OS)?\s*[：:]\s*(.+)$/i);
        if (m1) {
            var rhs = String(m1[4] || '').trim();
            if (rhs && rhs.length < 200) { dialogues.push(rhs); continue; }
        }
        // 格式2: 【角色】台词
        var m2 = line.match(/^【(.{1,16}?)】\s*(.+)$/);
        if (m2) {
            var rhs2 = String(m2[2] || '').trim();
            if (rhs2 && rhs2.length < 200) { dialogues.push(rhs2); continue; }
        }
    }
    if (dialogues.length) return dialogues;
    // Fallback: 从引号提取
    var quotes = String(t || '').match(/"([^"]+)"|「([^」]+)」|"([^"]+)"|'([^']+)'/g) || [];
    for (var qi = 0; qi < quotes.length; qi++) {
        var inner = quotes[qi].replace(/^[""「']/, '').replace(/[""」']$/, '').trim();
        if (inner && inner.length >= 2 && inner.length < 200) dialogues.push(inner);
    }
    return dialogues;
}

// ==================== Director Rule Engine（导演规则引擎）====================

/**
 * 导演规则引擎 - 对LLM输出的分镜JSON进行确定性修正
 * 解决LLM常见问题：全给中景、爽点不强化、情绪和镜头不匹配等
 */

var EMOTION_SHOT_RULES = {
    '愤怒': { shot_type: ['特写', '大特写'], camera_movement: '推镜头', light: '高对比红/橙色' },
    '绝望': { shot_type: ['远景', '全景'], camera_movement: '拉镜头', light: '冷蓝色低对比' },
    '震惊': { shot_type: ['近景', '特写'], camera_movement: '快速推镜', light: '高对比' },
    '恐惧': { shot_type: ['近景'], camera_movement: '推镜头', light: '暗调冷色' },
    '悲伤': { shot_type: ['中景', '远景'], camera_movement: '慢拉', light: '低对比冷蓝' },
    '喜悦': { shot_type: ['中景', '近景'], camera_movement: '轻推', light: '暖色高调' },
    '压迫': { shot_type: ['特写'], camera_movement: '慢推', light: '暗调' }
};

// v7.0 爽点检测补全：8种爽点 + 评分系统 + 综合评分算法
var POWER_UP_PATTERNS = [
    { name: '觉醒', score: 10, keywords: ['抬头', '睁眼', '站起来', '站起', '觉醒', '苏醒', '力量觉醒', '潜能爆发', '血脉觉醒'],
      overrides: { shot_type: '大特写', camera_angle: '仰视', camera_movement: '慢推', duration: 4 }, weight: 2 },
    { name: '反杀', score: 9, keywords: ['一刀', '击败', '赢了', '反杀', '斩', '杀', '击溃', '打败', '致命一击', '逆转'],
      overrides: { shot_type: '特写', camera_movement: '跟镜头', duration: 2 }, weight: 1.5 },
    { name: '打脸', score: 8, keywords: ['哼', '冷笑', '你算什么', '不过如此', '不值一提', '可笑', '不自量力', '打脸', '啪啪'],
      overrides: { shot_type: '大特写', camera_angle: '仰视', duration: 3 }, weight: 1.2 },
    { name: '压迫', score: 7, keywords: ['气息', '压迫', '跪下', '颤抖', '跪', '臣服', '恐惧', '战栗', '窒息', '威压'],
      overrides: { shot_type: '特写', camera_movement: '推镜头', duration: 3 }, weight: 1 },
    { name: '羞辱', score: 7, keywords: ['羞辱', '践踏', '蝼蚁', '垃圾', '废物', '不配', '低级', '可笑', '愚昧', '侮辱'],
      overrides: { shot_type: '特写', camera_angle: '俯视', camera_movement: '固定', duration: 3 }, weight: 1.3 },
    { name: '装逼', score: 6, keywords: ['慢慢', '淡然', '无所谓', '轻轻', '随意', '微笑', '淡淡', '平静', '淡定', '轻描淡写'],
      overrides: { shot_type: '近景', camera_angle: '侧视', camera_movement: '环绕', duration: 4 }, weight: 0.8 },
    { name: '绝望', score: 5, keywords: ['绝望', '无力', '崩塌', '破碎', '崩溃', '希望破灭', '心死', '万念俱灰', '心碎'],
      overrides: { shot_type: '远景', camera_angle: '俯视', camera_movement: '拉镜头', duration: 4 }, weight: 0.5 },
    { name: '爆发', score: 8, keywords: ['爆发', '释放', '能量', '轰鸣', '炸裂', '燃烧', '沸腾', '力量爆发'],
      overrides: { shot_type: '大特写', camera_angle: '仰视', camera_movement: '快速推镜', duration: 3 }, weight: 1.8 }
];

// v7.0 爽点等级计算
function calculateClimaxLevel(totalScore) {
    if (totalScore >= 9) return '爆点';
    if (totalScore >= 7) return '高潮';
    if (totalScore >= 4) return '有爽点';
    return '普通';
}

// v7.0 计算爽点综合评分
function calculatePowerUpScore(shots) {
    var scoreMap = {};
    for (var i = 0; i < POWER_UP_PATTERNS.length; i++) {
        var pattern = POWER_UP_PATTERNS[i];
        scoreMap[pattern.name] = { score: 0, weight: pattern.weight };
    }
    
    // 统计每个爽点类型出现的次数和最高分数
    for (var j = 0; j < shots.length; j++) {
        var shot = shots[j];
        var powerUp = detectPowerUp(shot);
        if (powerUp) {
            if (!scoreMap[powerUp.name]) {
                scoreMap[powerUp.name] = { score: 0, weight: powerUp.weight || 1 };
            }
            // 使用该爽点的最高分
            if (powerUp.score > scoreMap[powerUp.name].score) {
                scoreMap[powerUp.name].score = powerUp.score;
            }
        }
    }
    
    // 计算加权总分
    var totalScore = 0;
    var details = [];
    for (var name in scoreMap) {
        if (scoreMap[name].score > 0) {
            var weightedScore = scoreMap[name].score * scoreMap[name].weight;
            totalScore += weightedScore;
            details.push({ type: name, score: scoreMap[name].score, weighted: weightedScore.toFixed(1) });
        }
    }
    
    return {
        total: Math.round(totalScore * 10) / 10,
        level: calculateClimaxLevel(totalScore),
        details: details
    };
}

var SHOT_LEVELS = ['远景', '全景', '中远景', '中景', '中近景', '近景', '特写', '大特写'];

function getShotLevelIndex(shotType) {
    var idx = SHOT_LEVELS.indexOf(shotType);
    return idx >= 0 ? idx : 4;
}

function adjustShotLevel(currentType, direction) {
    var idx = getShotLevelIndex(currentType);
    var newIdx = idx + direction;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= SHOT_LEVELS.length) newIdx = SHOT_LEVELS.length - 1;
    return SHOT_LEVELS[newIdx];
}

/**
 * v6.2 台词后处理规则引擎
 * 在applyDirectorEngine执行完毕后应用，处理LLM输出不规范的台词
 * 包含：补全说话人标注、合并断裂对话、拆分堆叠台词、描述多样性、去重
 */
function applyDialogueRules(data) {
    console.log('[Dialogue Rules] 开始执行台词后处理...');
    var processed = deepClone(data);
    if (!processed || !Array.isArray(processed.scenes)) {
        console.log('[Dialogue Rules] 无有效scenes数据，跳过');
        return processed;
    }
    
    for (var si = 0; si < processed.scenes.length; si++) {
        var scene = processed.scenes[si];
        if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
            continue;
        }
        
        // 规则a：补全说话人标注
        applySpeakerAnnotation(processed.scenes[si]);
        
        // 规则c：拆分堆叠台词（先执行，因为拆分会增加shot数量）
        splitStackedDialogues(processed.scenes[si]);
        
        // 规则b：合并断裂对话（在拆分之后执行）
        mergeBrokenDialogues(processed.scenes[si]);
        
        // 规则d：台词去重（确保同一分镜内没有重复台词）
        deduplicateDialogues(processed.scenes[si]);
    }
    
    console.log('[Dialogue Rules] 台词后处理执行完毕');
    return processed;
}

/**
 * 规则a：补全说话人标注
 * v6.2.1修复：支持多种台词格式，自动识别说话人
 * 格式1：已经@开头 → 保持不变
 * 格式2：角色名（情绪）：台词 → 转换为@角色名：台词
 * 格式3：角色名：台词 → 转换为@角色名：台词
 * 格式4：角色名/角色名（情绪）：台词 → 取第一个角色名，转换为@角色名：台词
 * 防止双重标注：如果台词已包含@角色名格式，不在外面再包@旁白
 */
function applySpeakerAnnotation(scene) {
    var shots = scene.shots;
    for (var i = 0; i < shots.length; i++) {
        var shot = shots[i];
        var dialogue = String(shot.dialogue || '').trim();
        
        // 如果台词为空，跳过
        if (!dialogue) {
            continue;
        }
        
        // 如果已经以@开头（已正确标注），跳过
        if (dialogue.indexOf('@') === 0) {
            continue;
        }
        
        // 尝试解析台词格式并转换
        var parsedDialogue = parseDialogueFormat(dialogue, shot, scene, i);
        if (parsedDialogue) {
            shot.dialogue = parsedDialogue;
        } else {
            // 无法解析，从上下文推断
            var inferredSpeaker = inferSpeakerFromContext(shot, scene, i);
            if (inferredSpeaker) {
                console.log('[Dialogue Rules] 补全说话人: ' + dialogue + ' -> @' + inferredSpeaker + '：' + dialogue);
                shot.dialogue = '@' + inferredSpeaker + '：' + dialogue;
            } else {
                console.log('[Dialogue Rules] 未能推断说话人，标注为旁白: ' + dialogue);
                shot.dialogue = '@旁白：' + dialogue;
            }
        }
    }
}

/**
 * 解析单行台词，返回格式化的@角色名：台词
 * 返回null表示解析失败
 */
function parseSingleLine(line) {
    line = line.trim();
    if (!line) return null;
    
    // 如果已经是@开头的格式，直接返回
    if (line.indexOf('@') === 0) return line;
    
    // 格式A: "角色OS：台词" 或 "角色 OS：台词" → 旁白
    var osPattern = line.match(/^(.+?)\s*OS[：:]/);
    if (osPattern) {
        var osContent = line.substring(line.indexOf('OS') + 2).replace(/^[：:]\s*/, '');
        return '@旁白：' + osContent.trim();
    }
    
    // 找到普通对话的冒号位置
    var colonPos = line.indexOf('：');
    if (colonPos < 0) colonPos = line.indexOf(':');
    if (colonPos < 0) return null;
    
    var beforeColon = line.substring(0, colonPos);
    var afterColon = line.substring(colonPos + 1).trim();
    
    // 格式B: "角色名/角色名" → 取第一个
    // 例如："队员甲/乙（惊愕）：啊！队长" → "@队员甲：啊！队长"
    if (beforeColon.indexOf('/') > 0) {
        var firstSpeaker = beforeColon.split('/')[0].trim();
        // 去除情绪标注
        firstSpeaker = firstSpeaker.replace(/[（(][^）)]+[）)]$/, '');
        return '@' + firstSpeaker + '：' + afterColon;
    }
    
    // 格式C: "角色名（情绪）" → 去除情绪
    // 例如："队长（震惊）：你到底是什么人？" → "@队长：你到底是什么人？"
    var emotionMatch = beforeColon.match(/^(.+?)[（(].+?[）)]$/);
    if (emotionMatch) {
        return '@' + emotionMatch[1].trim() + '：' + afterColon;
    }
    
    // 格式D: 普通角色名
    if (beforeColon && beforeColon !== '旁白' && beforeColon.trim().length > 0) {
        return '@' + beforeColon.trim() + '：' + afterColon;
    }
    
    return null;
}

/**
 * 解析台词格式并转换为标准格式@角色名：台词
 * 支持多行对话，逐行解析
 * 返回null表示解析失败，需要从上下文推断
 */
function parseDialogueFormat(dialogue, shot, scene, shotIndex) {
    if (!dialogue || !dialogue.trim()) return null;
    
    // 按换行符拆分多行对话
    var lines = dialogue.split(/\n/);
    
    if (lines.length === 1) {
        // 单行对话，直接解析
        var result = parseSingleLine(lines[0]);
        if (result) {
            console.log('[Dialogue Rules] 解析台词: ' + dialogue + ' -> ' + result);
        }
        return result;
    }
    
    // 多行对话，逐行解析后重新拼接
    var parsedLines = [];
    for (var i = 0; i < lines.length; i++) {
        var parsed = parseSingleLine(lines[i]);
        if (parsed) {
            console.log('[Dialogue Rules] 解析台词(行' + (i+1) + '): ' + lines[i] + ' -> ' + parsed);
            parsedLines.push(parsed);
        } else {
            // 解析失败的行，保留原样
            parsedLines.push(lines[i]);
        }
    }
    
    return parsedLines.join('\n');
}

/**
 * 从shot的description和上下文推断说话人
 */
function inferSpeakerFromContext(shot, scene, shotIndex) {
    // 1. 优先从visual_prompt.character_placement中提取角色
    var vp = shot.visual_prompt || {};
    var characterPlacement = String(vp.character_placement || '');
    var match = characterPlacement.match(/@([\u4e00-\u9fa5a-zA-Z0-9]+)/);
    if (match) {
        return match[1];
    }
    
    // 2. 从visual_prompt.scene_description中提取角色
    var sceneDesc = String(vp.scene_description || '');
    match = sceneDesc.match(/@([\u4e00-\u9fa5a-zA5a-z0-9]+)/);
    if (match) {
        return match[1];
    }
    
    // 3. 从original_text中提取角色
    var originalText = String(shot.original_text || '');
    match = originalText.match(/@([\u4e00-\u9fa5a-zA-Z0-9]+)/);
    if (match) {
        return match[1];
    }
    
    // 4. 从action_prompt中提取角色
    var actionPrompt = shot.action_prompt || {};
    var physicalAction = String(actionPrompt.physical_action || '');
    match = physicalAction.match(/@([\u4e00-\u9fa5a-zA-Z0-9]+)/);
    if (match) {
        return match[1];
    }
    
    // 5. 从scene.characters中取第一个角色
    var sceneChars = String(scene.characters || '');
    var chars = sceneChars.split(/[,，、]/).filter(function(c) { return c.trim(); });
    if (chars.length > 0) {
        return chars[0].trim();
    }
    
    // 6. 向前查找相邻shot中的说话人
    for (var j = shotIndex - 1; j >= 0; j--) {
        var prevShot = scene.shots[j];
        var prevDialogue = String(prevShot.dialogue || '').trim();
        var prevMatch = prevDialogue.match(/^@([\u4e00-\u9fa5a-zA-Z0-9]+)[：:]/);
        if (prevMatch) {
            return prevMatch[1];
        }
    }
    
    // 7. 向后查找相邻shot中的说话人
    for (var j = shotIndex + 1; j < scene.shots.length; j++) {
        var nextShot = scene.shots[j];
        var nextDialogue = String(nextShot.dialogue || '').trim();
        var nextMatch = nextDialogue.match(/^@([\u4e00-\u9fa5a-zA-Z0-9]+)[：:]/);
        if (nextMatch) {
            return nextMatch[1];
        }
    }
    
    return null;
}

/**
 * 规则c：拆分堆叠台词
 * 如果dialogue包含超过2条台词（用\n或；分隔），拆分为多个shot
 */
function splitStackedDialogues(scene) {
    var shots = scene.shots;
    var newShots = [];
    
    for (var i = 0; i < shots.length; i++) {
        var shot = shots[i];
        var dialogue = String(shot.dialogue || '').trim();
        
        if (!dialogue) {
            newShots.push(shot);
            continue;
        }
        
        // 解析台词：支持\n和；分隔
        var lines = dialogue.split(/\n|；/).map(function(d) { return d.trim(); }).filter(function(d) { return d; });
        
        // 计算实际台词条数（以@开头或能识别出说话人的）
        var validLines = lines.filter(function(d) {
            return d.indexOf('@') === 0 || /^[^\@]+[：:]/.test(d);
        });
        
        if (validLines.length <= 2) {
            newShots.push(shot);
            continue;
        }
        
        console.log('[Dialogue Rules] 检测到堆叠台词，分镜' + (i + 1) + '有' + validLines.length + '条，开始拆分');
        
        // 拆分：每2条一组
        for (var j = 0; j < validLines.length; j += 2) {
            var groupLines = validLines.slice(j, j + 2);
            var newDialogue = groupLines.join('\n');
            
            // 复制shot的其他属性
            var newShot = deepClone(shot);
            newShot.dialogue = newDialogue;
            newShot.shot_number = newShots.length + 1;
            
            // duration平均分配，但不超过8秒
            var avgDuration = Math.min(8, Math.max(2, Math.ceil(shot.duration / Math.ceil(validLines.length / 2))));
            newShot.duration = avgDuration;
            
            newShots.push(newShot);
            console.log('[Dialogue Rules] 拆分后台词: ' + newDialogue.substring(0, 50));
        }
    }
    
    scene.shots = newShots;
}

/**
 * 规则b：合并断裂对话
 * 如果两个相邻shot的dialogue都是1条，且场景描述高度相似、动作连贯，则合并
 */
function mergeBrokenDialogues(scene) {
    var shots = scene.shots;
    var i = 0;
    
    while (i < shots.length - 1) {
        var currentShot = shots[i];
        var nextShot = shots[i + 1];
        
        var currentDialogue = String(currentShot.dialogue || '').trim();
        var nextDialogue = String(nextShot.dialogue || '').trim();
        
        // 如果当前没有台词，不合并
        if (!currentDialogue) {
            i++;
            continue;
        }
        
        // 如果下一个有台词但当前没有，不合并
        if (!nextDialogue) {
            i++;
            continue;
        }
        
        // 统计台词条数
        var currentLines = currentDialogue.split(/\n|；/).filter(function(d) { return d.trim(); });
        var nextLines = nextDialogue.split(/\n|；/).filter(function(d) { return d.trim(); });
        
        // 如果任一shot有超过1条台词，不合并
        if (currentLines.length > 1 || nextLines.length > 1) {
            i++;
            continue;
        }
        
        // 检查场景描述是否高度相似
        var currentVp = currentShot.visual_prompt || {};
        var nextVp = nextShot.visual_prompt || {};
        var currentDesc = String(currentVp.scene_description || '').toLowerCase();
        var nextDesc = String(nextVp.scene_description || '').toLowerCase();
        
        // 计算相似度：检查关键角色和动作词是否相同
        var similar = areScenesSimilar(currentShot, nextShot);
        
        if (similar) {
            console.log('[Dialogue Rules] 合并断裂对话: 分镜' + (i + 1) + ' + ' + (i + 2));
            
            // 合并台词
            currentShot.dialogue = currentDialogue + '\n' + nextDialogue;
            
            // duration取两者之和但不超过8秒
            var combinedDuration = Math.min(8, currentShot.duration + nextShot.duration);
            currentShot.duration = combinedDuration;
            
            // 删除下一个shot
            shots.splice(i + 1, 1);
            
            // 重新编号
            for (var j = 0; j < shots.length; j++) {
                shots[j].shot_number = j + 1;
            }
            
            // 不递增i，因为可能需要继续合并
        } else {
            i++;
        }
    }
}

/**
 * 规则d：台词去重
 * 确保同一分镜内没有重复台词
 * 合并断裂对话时，检查两个shot的dialogue是否完全相同，相同则不合并
 * 最终输出前，对每个shot的dialogue按行去重
 */
function deduplicateDialogues(scene) {
    var shots = scene.shots;
    var i = 0;
    
    // 步骤1：合并断裂对话时检查台词是否完全相同
    while (i < shots.length - 1) {
        var currentShot = shots[i];
        var nextShot = shots[i + 1];
        
        var currentDialogue = String(currentShot.dialogue || '').trim();
        var nextDialogue = String(nextShot.dialogue || '').trim();
        
        // 如果两个台词完全相同，不合并
        if (currentDialogue && nextDialogue && currentDialogue === nextDialogue) {
            console.log('[Dialogue Rules] 跳过合并：分镜' + (i + 1) + '和' + (i + 2) + '台词完全相同');
            i++;
            continue;
        }
        
        i++;
    }
    
    // 步骤2：对每个shot的dialogue按行去重
    for (var j = 0; j < shots.length; j++) {
        var shot = shots[j];
        var dialogue = String(shot.dialogue || '').trim();
        
        if (!dialogue) continue;
        
        // 按行分割台词
        var lines = dialogue.split(/\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
        
        // 去重：保留唯一行
        var seen = {};
        var uniqueLines = [];
        var hasDuplicate = false;
        
        for (var k = 0; k < lines.length; k++) {
            if (seen[lines[k]]) {
                hasDuplicate = true;
                console.log('[Dialogue Rules] 去除重复台词: ' + lines[k]);
            } else {
                seen[lines[k]] = true;
                uniqueLines.push(lines[k]);
            }
        }
        
        if (hasDuplicate) {
            shot.dialogue = uniqueLines.join('\n');
        }
    }
}

/**
 * 检查两个shot的场景是否高度相似（用于判断是否应该合并）
 * 注意：连续对话场景角色可能不同，但只要场景关键词重叠就可以合并
 */
function areScenesSimilar(shot1, shot2) {
    var vp1 = shot1.visual_prompt || {};
    var vp2 = shot2.visual_prompt || {};
    
    // 检查scene_description是否有共同的关键词
    var desc1 = String(vp1.scene_description || '');
    var desc2 = String(vp2.scene_description || '');
    
    // 移除标点符号，转小写
    var normDesc1 = desc1.replace(/[，。！？、：；""''【】]/g, '').toLowerCase();
    var normDesc2 = desc2.replace(/[，。！？、：；""''【】]/g, '').toLowerCase();
    
    // 如果任一描述为空，不合并
    if (!normDesc1 || !normDesc2) {
        return false;
    }
    
    // 检查关键词重叠
    var keywords1 = normDesc1.split(/\s+/).filter(function(k) { return k.length >= 2; });
    var keywords2 = normDesc2.split(/\s+/).filter(function(k) { return k.length >= 2; });
    
    var overlap = 0;
    for (var i = 0; i < keywords1.length; i++) {
        if (keywords2.indexOf(keywords1[i]) >= 0) {
            overlap++;
        }
    }
    
    // 如果有超过50%的关键词重叠，认为场景相似（对于对话场景，允许不同角色）
    var threshold = Math.min(keywords1.length, keywords2.length) * 0.5;
    return overlap >= threshold && overlap >= 1;
}

function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        var arr = [];
        for (var i = 0; i < obj.length; i++) arr.push(deepClone(obj[i]));
        return arr;
    }
    var copy = {};
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; k++) copy[keys[k]] = deepClone(obj[keys[k]]);
    return copy;
}

// v7.0 增强版爽点检测，返回带评分的爽点对象
function detectPowerUp(shot) {
    var text = '';
    if (shot.dialogue) text += shot.dialogue;
    if (shot.original_text) text += shot.original_text;
    if (shot.action_prompt && shot.action_prompt.physical_action) text += shot.action_prompt.physical_action;
    text = String(text).toLowerCase();
    
    var matchedPattern = null;
    var matchedKeyword = '';
    
    for (var i = 0; i < POWER_UP_PATTERNS.length; i++) {
        var pattern = POWER_UP_PATTERNS[i];
        for (var j = 0; j < pattern.keywords.length; j++) {
            if (text.indexOf(pattern.keywords[j]) >= 0) {
                // 返回带有分数的模式对象（使用全局 POWER_UP_PATTERNS 中的分数）
                matchedPattern = {
                    name: pattern.name,
                    score: pattern.score || 5,
                    weight: pattern.weight || 1,
                    keywords: pattern.keywords,
                    overrides: pattern.overrides
                };
                matchedKeyword = pattern.keywords[j];
                break;
            }
        }
        if (matchedPattern) break;
    }
    
    if (matchedPattern) {
        console.log('[Director Engine] 检测到爽点: ' + matchedPattern.name + ' (分数:' + matchedPattern.score + ', 关键词: ' + matchedKeyword + ')');
        return matchedPattern;
    }
    return null;
}

// v7.0 音效推荐映射
var EMOTION_SOUND_MAP = {
    '愤怒': ['heartbeat', 'drum'],
    '战斗': ['heartbeat', 'drum', 'sword'],
    '绝望': ['wind', 'silence', 'heartbeat'],
    '爽点高潮': ['impact', 'bass_drop'],
    '压迫': ['low_hum', 'tension'],
    '装逼': ['sparkle', 'whoosh'],
    '悲伤': ['sad_music', 'wind'],
    '震惊': ['impact', 'surprise'],
    '喜悦': ['uplift', 'sparkle'],
    '恐惧': ['low_hum', 'tension'],
    '紧张': ['heartbeat', 'tension'],
    '觉醒': ['impact', 'power_surge'],
    '反杀': ['impact', 'bass_drop'],
    '打脸': ['slap', 'impact'],
    '爆发': ['explosion', 'power_surge']
};

// v7.0 爽点镜头角度推荐
var CLIMAX_ANGLE_MAP = {
    '打脸': '仰视',
    '压迫': '俯视',
    '装逼': '平视偏仰',
    '绝望': '俯视',
    '觉醒': '仰视',
    '反杀': '仰视',
    '爆发': '仰视',
    '羞辱': '俯视'
};

// v7.0 切镜速度映射
var SHOT_SPEED_MAP = {
    'fast': ['战斗', '爽点高潮', '爆发', '反杀', '打脸'],
    'normal': ['喜悦', '悲伤', '震惊', '愤怒', '恐惧'],
    'slow': ['绝望', '压迫', '装逼', '羞辱']
};

// v7.0 增强版情绪映射：添加音效、角度、切镜速度（前置定义，供applyDirectorEngine使用）
function applyEnhancedEmotionMapping(shot, powerUp) {
    // 如果有爽点，优先使用爽点角度
    if (powerUp && CLIMAX_ANGLE_MAP[powerUp.name]) {
        var recommendedAngle = CLIMAX_ANGLE_MAP[powerUp.name];
        if (!shot.camera_angle || shot.camera_angle === '平视') {
            console.log('[Director Engine] 爽点角度推荐: ' + powerUp.name + ' → ' + recommendedAngle);
            shot.camera_angle = recommendedAngle;
        }
        // 添加爽点音效
        if (shot.sound) {
            shot.sound.effect = EMOTION_SOUND_MAP[powerUp.name + '高潮'] || EMOTION_SOUND_MAP[powerUp.name] || 'impact';
        }
    }
    
    var emotion = shot.emotion_cue && shot.emotion_cue.primary_emotion;
    if (!emotion) return;
    
    // 添加情绪音效
    if (EMOTION_SOUND_MAP[emotion]) {
        if (!shot.sound) shot.sound = {};
        if (!shot.sound.effect) {
            shot.sound.effect = EMOTION_SOUND_MAP[emotion][0];
            console.log('[Director Engine] 情绪音效推荐: ' + emotion + ' → ' + shot.sound.effect);
        }
    }
    
    // 添加切镜速度
    var speed = 'normal';
    for (var category in SHOT_SPEED_MAP) {
        if (SHOT_SPEED_MAP[category].indexOf(emotion) >= 0) {
            speed = category;
            break;
        }
    }
    shot.camera_speed = speed;
}

function applyEmotionMapping(shot) {
    var emotion = shot.emotion_cue && shot.emotion_cue.primary_emotion;
    if (!emotion) return;
    var rule = EMOTION_SHOT_RULES[emotion];
    if (!rule) return;
    if (rule.shot_type.indexOf(shot.shot_type) < 0) {
        var targetShot = rule.shot_type[Math.floor(Math.random() * rule.shot_type.length)];
        console.log('[Director Engine] 情绪映射: ' + emotion + ' → ' + targetShot);
        shot.shot_type = targetShot;
    }
    if (rule.camera_movement && (!shot.camera_movement || shot.camera_movement === '固定')) {
        console.log('[Director Engine] 情绪运镜映射: ' + emotion + ' → ' + rule.camera_movement);
        shot.camera_movement = rule.camera_movement;
    }
    if (rule.light && shot.visual_prompt) {
        var currentLight = shot.visual_prompt.lighting || '';
        if (!currentLight || currentLight === '自然光' || currentLight === '室内光') {
            console.log('[Director Engine] 情绪灯光映射: ' + emotion + ' → ' + rule.light);
            shot.visual_prompt.lighting = rule.light;
        }
    }
}

// v7.0 节奏检测引擎
function applyPaceDetection(shots) {
    var result = {
        pace: 'normal',
        risk: 'none',
        problems: [],
        retention_score: 7,
        drop_risk: 'low'
    };
    
    if (!shots || shots.length === 0) return result;
    
    var risk = 0;
    var boringScore = 0;
    var fatigue = 0;
    
    // 1. 高潮间隔检测：超过15秒（累计duration）没有高潮 → risk += 3
    var climaxInterval = 0;
    var hasClimax = false;
    for (var i = 0; i < shots.length; i++) {
        var shot = shots[i];
        climaxInterval += shot.duration || 3;
        if (detectPowerUp(shot)) {
            hasClimax = true;
            climaxInterval = 0;
        }
        if (climaxInterval > 15) {
            risk += 3;
            result.problems.push('15秒无高潮');
            climaxInterval = 0;
            console.log('[Pace Detection] 高潮间隔过大 (位置:' + (i+1) + ')');
        }
    }
    
    // 2. 冲突频率检测：前3秒（前几个shot的累计duration）必须有爽点或冲突
    var conflictCount = 0;
    var firstThreeSeconds = 0;
    for (var j = 0; j < shots.length && firstThreeSeconds < 3; j++) {
        var s = shots[j];
        firstThreeSeconds += s.duration || 3;
        if (detectPowerUp(s) || (s.emotion_cue && ['愤怒', '恐惧', '震惊'].indexOf(s.emotion_cue.primary_emotion) >= 0)) {
            conflictCount++;
        }
    }
    if (conflictCount === 0) {
        risk += 2;
        result.problems.push('前3秒无冲突');
        console.log('[Pace Detection] 前3秒无冲突');
    }
    
    // 3. 对话长度检测：连续对白超过80字 → boring_score += 2
    var currentDialogueLength = 0;
    var consecutiveDialogueShots = 0;
    for (var k = 0; k < shots.length; k++) {
        var dialogue = String(shots[k].dialogue || '').replace(/@[\u4e00-\u9fa5a-zA-Z0-9]+[：:]/g, '').length;
        if (dialogue > 0) {
            currentDialogueLength += dialogue;
            consecutiveDialogueShots++;
            if (currentDialogueLength > 80) {
                boringScore += 2;
                result.problems.push('对话过长');
                console.log('[Pace Detection] 连续对话过长 (' + consecutiveDialogueShots + '个镜头)');
                currentDialogueLength = 0;
                consecutiveDialogueShots = 0;
            }
        } else {
            currentDialogueLength = 0;
            consecutiveDialogueShots = 0;
        }
    }
    
    // 4. 情绪平缓检测：连续5个镜头情绪一致 → fatigue += 3
    var consecutiveEmotions = 1;
    for (var m = 1; m < shots.length; m++) {
        var prevEmotion = shots[m-1].emotion_cue && shots[m-1].emotion_cue.primary_emotion;
        var currEmotion = shots[m].emotion_cue && shots[m].emotion_cue.primary_emotion;
        if (prevEmotion && currEmotion && prevEmotion === currEmotion) {
            consecutiveEmotions++;
            if (consecutiveEmotions >= 5) {
                fatigue += 3;
                result.problems.push('情绪疲劳');
                console.log('[Pace Detection] 情绪疲劳 (连续' + consecutiveEmotions + '个镜头)');
                consecutiveEmotions = 1;
            }
        } else {
            consecutiveEmotions = 1;
        }
    }
    
    // 计算节奏速度
    var totalDuration = 0;
    for (var n = 0; n < shots.length; n++) {
        totalDuration += shots[n].duration || 3;
    }
    var avgShotDuration = totalDuration / shots.length;
    if (avgShotDuration > 4) {
        result.pace = 'slow';
    } else if (avgShotDuration < 2.5) {
        result.pace = 'fast';
    }
    
    // 计算风险等级
    if (risk >= 6 || fatigue >= 6) {
        result.risk = 'high';
        result.drop_risk = 'high';
        result.retention_score = Math.max(1, result.retention_score - 4);
    } else if (risk >= 3 || fatigue >= 3 || boringScore >= 4) {
        result.risk = 'medium';
        result.drop_risk = 'medium';
        result.retention_score = Math.max(1, result.retention_score - 2);
    } else if (risk > 0 || boringScore > 0) {
        result.risk = 'low';
        result.drop_risk = 'low';
    }
    
    // 减去无聊分数的影响
    result.retention_score = Math.max(1, result.retention_score - Math.floor(boringScore / 2));
    
    console.log('[Pace Detection] 结果: pace=' + result.pace + ', risk=' + result.risk + ', retention=' + result.retention_score);
    return result;
}

// v7.0 留存优化
function applyRetentionOptimization(shots, paceResult) {
    if (!shots || shots.length === 0) return;
    
    console.log('[Retention] 开始留存优化...');
    
    // 1. 拖沓修复：检测到"对话过长"时，在长对话中间插入反应镜头
    var dialogueCount = 0;
    var dialogueStartIndex = -1;
    for (var i = 0; i < shots.length; i++) {
        var dialogue = String(shots[i].dialogue || '');
        if (dialogue.length > 40) {
            if (dialogueStartIndex === -1) {
                dialogueStartIndex = i;
            }
            dialogueCount++;
        } else {
            if (dialogueCount >= 2) {
                // 在中间插入反应镜头
                var insertIndex = dialogueStartIndex + Math.floor(dialogueCount / 2);
                var reactionShot = createReactionShot(shots[dialogueStartIndex]);
                shots.splice(insertIndex, 0, reactionShot);
                console.log('[Retention] 拖沓修复：在位置' + (insertIndex+1) + '插入反应镜头');
                i++;
            }
            dialogueCount = 0;
            dialogueStartIndex = -1;
        }
    }
    
    // 2. 高潮间隔修复：检测到"15秒无高潮"时，对平淡shot添加情绪强化
    if (paceResult.problems.indexOf('15秒无高潮') >= 0) {
        var climaxInterval = 0;
        var lastClimaxIndex = -1;
        for (var j = 0; j < shots.length; j++) {
            climaxInterval += shots[j].duration || 3;
            if (detectPowerUp(shots[j])) {
                lastClimaxIndex = j;
                climaxInterval = 0;
            }
            if (climaxInterval > 12 && lastClimaxIndex >= 0) {
                // 强化中间平淡镜头
                if (!shots[j].emotion_cue || !shots[j].emotion_cue.primary_emotion) {
                    shots[j].emotion_cue = { primary_emotion: '紧张', visual_mapping: '高对比' };
                    shots[j].camera_movement = '推镜头';
                    console.log('[Retention] 高潮间隔修复：强化位置' + (j+1) + '的情绪');
                }
            }
        }
    }
    
    // 3. 情绪疲劳修复：检测到"5个镜头情绪一致"时，强制切换情绪
    if (paceResult.problems.indexOf('情绪疲劳') >= 0) {
        var consecutiveCount = 1;
        var emotionShots = [];
        for (var k = 1; k < shots.length; k++) {
            var prevE = shots[k-1].emotion_cue && shots[k-1].emotion_cue.primary_emotion;
            var currE = shots[k].emotion_cue && shots[k].emotion_cue.primary_emotion;
            if (prevE && currE && prevE === currE) {
                consecutiveCount++;
                emotionShots.push(k);
            } else {
                consecutiveCount = 1;
                emotionShots = [];
            }
            if (consecutiveCount >= 4) {
                // 强制改变第4个镜头的情绪
                var changeIndex = emotionShots[emotionShots.length - 1];
                var originalEmotion = shots[changeIndex].emotion_cue.primary_emotion;
                var alternateEmotions = ['震惊', '愤怒', '喜悦', '恐惧'];
                var newEmotion = alternateEmotions[Math.floor(Math.random() * alternateEmotions.length)];
                if (alternateEmotions.indexOf(originalEmotion) < 0) {
                    newEmotion = alternateEmotions[0];
                }
                shots[changeIndex].emotion_cue.primary_emotion = newEmotion;
                console.log('[Retention] 情绪疲劳修复：强制切换位置' + (changeIndex+1) + '的情绪 ' + originalEmotion + ' → ' + newEmotion);
                consecutiveCount = 1;
                emotionShots = [];
            }
        }
    }
    
    console.log('[Retention] 留存优化完成');
}

// v7.0 创建反应镜头
function createReactionShot(baseShot) {
    return {
        shot_number: 0,
        shot_type: '特写',
        camera_angle: '平视',
        camera_movement: '固定',
        duration: 1,
        emotion_cue: { primary_emotion: '震惊', visual_mapping: '高对比' },
        visual_prompt: {
            scene_description: '反应镜头',
            lighting: baseShot.visual_prompt && baseShot.visual_prompt.lighting || '自然光',
            color_palette: baseShot.visual_prompt && baseShot.visual_prompt.color_palette || '',
            character_placement: '',
            facial_detail: '震惊表情',
            composition: ''
        },
        action_prompt: { physical_action: '', micro_movement: '' },
        dialogue: '',
        narration: '',
        original_text: '',
        scene_reference: ''
    };
}

// v7.0 增强版爽点强化：添加评分和climax信息
function applyPowerUpEnhancement(shot, totalClimaxScore) {
    var powerUp = detectPowerUp(shot);
    if (!powerUp) return;
    var overrides = powerUp.overrides;
    if (overrides.shot_type) {
        console.log('[Director Engine] 爽点强化: ' + powerUp.name + ' → ' + overrides.shot_type);
        shot.shot_type = overrides.shot_type;
    }
    if (overrides.camera_angle) shot.camera_angle = overrides.camera_angle;
    if (overrides.camera_movement) shot.camera_movement = overrides.camera_movement;
    if (overrides.duration) shot.duration = overrides.duration;
    
    // v7.0 添加爽点评分信息
    shot.climax = {
        type: powerUp.name,
        score: powerUp.score,
        level: totalClimaxScore ? calculateClimaxLevel(totalClimaxScore) : '有爽点'
    };
}

function fixShotTypeDiversity(shots) {
    if (!shots || shots.length < 3) return;
    var shotTypes = [];
    for (var i = 0; i < shots.length; i++) shotTypes.push(shots[i].shot_type);
    for (var i = 0; i < shots.length - 2; i++) {
        if (shotTypes[i] === shotTypes[i + 1] && shotTypes[i + 1] === shotTypes[i + 2]) {
            console.log('[Director Engine] 检测到连续3个相同景别: ' + shotTypes[i] + ' (位置: ' + (i+1) + '-' + (i+3) + ')');
            var currentType = shots[i + 1].shot_type;
            var midIdx = getShotLevelIndex(currentType);
            var direction = (midIdx <= 3) ? 1 : -1;
            shots[i + 1].shot_type = adjustShotLevel(currentType, direction);
            console.log('[Director Engine] 强制升降景别: ' + currentType + ' → ' + shots[i + 1].shot_type);
            shotTypes[i + 1] = shots[i + 1].shot_type;
        }
    }
    var hasExtreme = false;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].shot_type === '特写' || shots[i].shot_type === '大特写') { hasExtreme = true; break; }
    }
    if (!hasExtreme && shots.length > 0) {
        var maxEmotionIdx = 0;
        var maxEmotionScore = 0;
        for (var i = 0; i < shots.length; i++) {
            var emotion = shots[i].emotion_cue && shots[i].emotion_cue.primary_emotion;
            var score = emotion ? 1 : 0;
            if (score > maxEmotionScore) { maxEmotionScore = score; maxEmotionIdx = i; }
        }
        console.log('[Director Engine] scene缺少特写，为emotion最强shot添加特写');
        shots[maxEmotionIdx].shot_type = '特写';
    }
    var hasWide = false;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].shot_type === '远景' || shots[i].shot_type === '全景') { hasWide = true; break; }
    }
    if (!hasWide && shots.length > 0) {
        console.log('[Director Engine] scene缺少远景/全景，将第一个shot改为远景');
        shots[0].shot_type = '远景';
    }
}

function fixCameraMovementDiversity(shots) {
    if (!shots || shots.length < 3) return;
    var movements = [];
    for (var i = 0; i < shots.length; i++) movements.push(shots[i].camera_movement);
    for (var i = 0; i < shots.length - 2; i++) {
        if (movements[i] === movements[i + 1] && movements[i + 1] === movements[i + 2]) {
            console.log('[Director Engine] 检测到连续3个相同运镜: ' + movements[i] + ' (位置: ' + (i+1) + '-' + (i+3) + ')');
            var alternatives = ['推镜头', '移镜头', '摇镜头', '跟镜头'];
            var currentMov = shots[i + 1].camera_movement;
            var newMov = currentMov;
            for (var j = 0; j < alternatives.length; j++) {
                if (alternatives[j] !== currentMov) { newMov = alternatives[j]; break; }
            }
            shots[i + 1].camera_movement = newMov;
            console.log('[Director Engine] 强制改变运镜: ' + currentMov + ' → ' + newMov);
            movements[i + 1] = newMov;
        }
    }
    var allFixed = true;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].camera_movement !== '固定') { allFixed = false; break; }
    }
    if (allFixed && shots.length >= 2) {
        console.log('[Director Engine] scene全是固定镜头，修改部分为推镜头/移镜头');
        var modified = 0;
        for (var i = 1; i < shots.length && modified < 2; i += 2) {
            if (shots[i].camera_movement === '固定') {
                shots[i].camera_movement = (modified % 2 === 0) ? '推镜头' : '移镜头';
                modified++;
            }
        }
    }
}

/**
 * v6.2.1 规则：描述多样性检查
 * 遍历同一scene内的所有shots
 * 如果连续2个shot的scene_description完全相同，为后一个shot添加差异化描述
 * 差异化方式：在description前追加动作描述（从action_prompt提取）
 */
function applyDescriptionDiversity(scene) {
    var shots = scene.shots;
    if (!shots || shots.length < 2) return;
    
    console.log('[Director Engine] 执行描述多样性检查，共 ' + shots.length + ' 个分镜');
    
    for (var i = 1; i < shots.length; i++) {
        var currentShot = shots[i];
        var prevShot = shots[i - 1];
        
        var currentVp = currentShot.visual_prompt || {};
        var prevVp = prevShot.visual_prompt || {};
        
        var currentDesc = String(currentVp.scene_description || '').trim();
        var prevDesc = String(prevVp.scene_description || '').trim();
        
        // 检查scene_description是否完全相同
        if (currentDesc && prevDesc && currentDesc === prevDesc) {
            console.log('[Director Engine] 检测到连续相同描述: 分镜' + i + ' 与 分镜' + (i + 1) + ' - "' + currentDesc + '"');
            
            // 从action_prompt提取动作描述
            var currentAction = '';
            if (currentShot.action_prompt && currentShot.action_prompt.physical_action) {
                currentAction = String(currentShot.action_prompt.physical_action).trim();
            }
            
            if (currentAction) {
                // 追加动作描述到scene_description前面
                currentVp.scene_description = currentAction + '，' + currentDesc;
                console.log('[Director Engine] 添加动作差异化: "' + currentAction + '，' + currentDesc + '"');
            } else {
                // 如果没有动作描述，尝试从original_text提取
                var originalText = String(currentShot.original_text || '').trim();
                if (originalText) {
                    // 截取前20个字符作为补充描述
                    var shortAction = originalText.substring(0, Math.min(20, originalText.length));
                    currentVp.scene_description = shortAction + '，' + currentDesc;
                    console.log('[Director Engine] 从original_text添加差异化: "' + shortAction + '，' + currentDesc + '"');
                }
            }
        }
        
        // 检查character_placement是否完全相同
        var currentCharPlacement = String(currentVp.character_placement || '').trim();
        var prevCharPlacement = String(prevVp.character_placement || '').trim();
        
        if (currentCharPlacement && prevCharPlacement && currentCharPlacement === prevCharPlacement) {
            console.log('[Director Engine] 检测到连续相同角色位置: 分镜' + i + ' 与 分镜' + (i + 1));
            
            // 添加景别信息作为区分
            var currentShotType = currentShot.shot_type || '';
            if (currentShotType) {
                currentVp.character_placement = currentShotType + '镜头视角，' + currentCharPlacement;
            }
        }
    }
}

function fixDurationReasonableness(shot, shotType) {
    var duration = shot.duration;
    var emotion = shot.emotion_cue && shot.emotion_cue.primary_emotion;
    var isDialogue = shot.dialogue && shot.dialogue.trim().length > 0;
    var isAction = shot.action_prompt && (
        shot.action_prompt.physical_action.indexOf('动') >= 0 ||
        shot.action_prompt.physical_action.indexOf('走') >= 0 ||
        shot.action_prompt.physical_action.indexOf('跑') >= 0 ||
        shot.action_prompt.physical_action.indexOf('打') >= 0
    );
    var isEmotionCloseUp = (shotType === '特写' || shotType === '大特写' || shotType === '近景') && emotion;
    var isWideEstablishing = shotType === '远景' || shotType === '全景';
    var minDur, maxDur;
    if (isDialogue) { minDur = 2; maxDur = 4; }
    else if (isAction) { minDur = 1; maxDur = 3; }
    else if (isEmotionCloseUp) { minDur = 3; maxDur = 5; }
    else if (isWideEstablishing) { minDur = 3; maxDur = 5; }
    else { minDur = 2; maxDur = 4; }
    if (duration < minDur) {
        console.log('[Director Engine] duration过短: ' + duration + ' → ' + minDur);
        shot.duration = minDur;
    } else if (duration > maxDur) {
        console.log('[Director Engine] duration过长: ' + duration + ' → ' + maxDur);
        shot.duration = maxDur;
    }
}

/**
 * 主入口：应用导演规则引擎
 */
// v7.0 导演规则引擎（增强版）
function applyDirectorEngine(data) {
    console.log('[Director Engine] 开始执行导演规则引擎 v7.0...');
    var processed = deepClone(data);
    if (!processed || !Array.isArray(processed.scenes)) {
        console.log('[Director Engine] 无有效scenes数据，跳过');
        return processed;
    }
    for (var si = 0; si < processed.scenes.length; si++) {
        var scene = processed.scenes[si];
        console.log('[Director Engine] 处理场景 ' + (si + 1) + ': ' + scene.title);
        if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
            console.log('[Director Engine] 场景 ' + (si + 1) + ' 无shots，跳过');
            continue;
        }
        
        // v7.0 第一步：计算爽点综合评分
        var climaxScore = calculatePowerUpScore(scene.shots);
        console.log('[Director Engine] 爽点评分: ' + climaxScore.total + ' (' + climaxScore.level + ')');
        
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            var powerUp = detectPowerUp(shot);
            applyPowerUpEnhancement(shot, climaxScore.total);
            if (!powerUp) {
                applyEmotionMapping(shot);
                // v7.0 增强情绪映射：添加音效、角度
                applyEnhancedEmotionMapping(shot, null);
            } else {
                // v7.0 爽点场景应用增强情绪映射
                applyEnhancedEmotionMapping(shot, powerUp);
            }
            fixDurationReasonableness(shot, shot.shot_type);
        }
        fixShotTypeDiversity(scene.shots);
        fixCameraMovementDiversity(scene.shots);
        applyDescriptionDiversity(scene);
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            if (detectPowerUp(shot)) applyPowerUpEnhancement(shot, climaxScore.total);
        }
        
        // v7.0 第二步：节奏检测
        var paceResult = applyPaceDetection(scene.shots);
        scene.pace_analysis = paceResult;
        
        // v7.0 第三步：留存优化
        applyRetentionOptimization(scene.shots, paceResult);
        
        // v7.0 第四步：计算每个shot的retention分数
        for (var j = 0; j < scene.shots.length; j++) {
            var shot = scene.shots[j];
            if (!shot.retention) shot.retention = {};
            shot.retention.score = paceResult.retention_score;
            shot.retention.risk = paceResult.drop_risk;
        }
        
        console.log('[Director Engine] 场景 ' + (si + 1) + ' 处理完成，共 ' + scene.shots.length + ' 个shots');
    }
    // v6.2 台词后处理：在其他规则执行完毕后应用
    processed = applyDialogueRules(processed);
    console.log('[Director Engine] 导演规则引擎 v7.0 执行完毕');
    return processed;
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
    // 应用导演规则引擎进行确定性修正
    normalized = applyDirectorEngine(normalized);
    var compiled = compilePromptsForStoryboard(normalized);
    
    if (!compiled.scenes.length) {
        throw new Error('AI返回JSON缺少有效场景');
    }
    
    // v6.1 运行时校验：在返回结果前调用校验中间件
    compiled = validateStoryboard(compiled);
    
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
    applyDirectorEngine,
    applyDialogueRules,
    // v7.0 新增导出
    calculatePowerUpScore,
    detectPowerUp,
    applyPowerUpEnhancement,
    applyPaceDetection,
    applyRetentionOptimization,
    calculateClimaxLevel,
    SHOT_TYPE_MAP,
    CAMERA_MOVEMENT_MAP,
    TIME_OF_DAY_MAP,
    STORYBOARD_SYSTEM_PROMPT,
    STORYBOARD_USER_TEMPLATE,
    POWER_UP_PATTERNS,
    EMOTION_SOUND_MAP,
    CLIMAX_ANGLE_MAP,
    SHOT_SPEED_MAP
};

// ==================== v5.0 角色一致性系统 ====================

const { calibrateCharacterAnchors, compileCharacterPrompt } = require('./character_calibration');

module.exports = {
    ...module.exports,
    // v5.0 角色校准
    calibrateCharacterAnchors,
    compileCharacterPrompt
};
