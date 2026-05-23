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

【场景拆分规则】
- 剧本中每个场景头（如"2-1 日 内 工厂农场 - 温室"或"3-1 日 外 农场 - 菜地"）对应一个独立的scene对象
- 严禁将多个场景合并为一个scene！即使场景很短也必须独立存在
- scene_number必须与剧本场景头编号一致
- 不同场景的角色、地点、时间可能不同，必须分别列出

【台词完整性要求】
- 剧本原文中的每一句对话都必须出现在某个镜头的dialogue字段中，一句都不能漏
- 优先级：台词完整性 > 镜头数量。宁可多加镜头，也不能遗漏台词
- 空镜头（远景交代环境、转场）可以没有dialogue，但对话镜头必须包含完整台词
- 一句台词只出现在一个镜头中，不要拆分也不要重复
- **严禁将多句台词堆在一个镜头里**！每句对话必须独占一个镜头，这是硬性规则
- dialogue字段格式必须为"@角色名：台词内容"，必须标注说话人角色名
- 如果原文是"张三：你好"，dialogue必须填"@张三：你好"，不能只填"你好"

【严禁模板化输出】
- 相邻镜头的光影、色彩、构图必须不同！禁止所有镜头用相同的光影/色彩/构图
- 每个镜头必须根据该镜头的具体剧情和情绪设计独特的视觉方案
- 对话镜头：说话者和听者的光影角度不同，构图位置不同
- 动作镜头：快节奏→高对比冷色调，慢节奏→低对比暖色调
- 情绪镜头：焦虑→倾斜构图+冷蓝调，喜悦→对称构图+暖黄调
- 如果发现自己在重复使用相同的光影/色彩/构图描述，必须修改

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

【预提取台词列表】（以下台词必须完整分配到对应镜头的dialogue字段，一句不能漏，格式为@角色名：台词）
{{dialogue_list}}

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
          
          "dialogue": "角色名：台词原文（必须标注说话人，如@队长：你没事吧？对话镜头禁止留空）",
          "narration": "旁白原文（如有）",
          "scene_reference": "@场景名",
          "original_text": "对应原文片段"
        }
      ]
    }
  ]
}

【强制约束】
- 每个场景至少3个镜头，对话场景每句台词占一个镜头
- dialogue字段必须从剧本原文中提取角色台词并标注说话人！格式为"@角色名：台词"，原文有对话时禁止留空
- 如果原文是"张三：你好"，则dialogue填"@张三：你好"，必须标注说话人
- 景别必须有变化，不要全是特写或全是远景
- lighting每个镜头必须不同！根据剧情写：如"逆光剪影4500K" "顶光压迫感5500K" "侧逆光暖橙3200K"
- color_palette每个镜头必须不同！如紧张用"#2C3E50 #E74C3C" 悲伤用"#34495E #5DADE2" 温暖用"#F39C12 #E74C3C"
- composition每个镜头必须不同！交替使用：三分法左交叉点/对角线/中心对称/引导线/黄金螺旋
- action_prompt必须是物理级描述，如"修长的手指缓慢攥紧衣角，指节发白"
- 角色必须用@引用标记，如@林川、@苏晚
- 场景用@引用标记，如@废弃车站
- 禁止所有镜头用相同的lighting/color_palette/composition，违者视为严重错误`;

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
        // 场景描述（最重要，放在前面）
        if (vp.scene_description) {
            parts.push(vp.scene_description);
        }
        // 光影
        if (vp.lighting) {
            parts.push(vp.lighting);
        }
        // 色彩
        if (vp.color_palette) {
            parts.push(vp.color_palette);
        }
        // 角色位置/动作
        if (vp.character_placement) {
            parts.push(vp.character_placement);
        }
        // 面部细节
        if (vp.facial_detail) {
            parts.push(vp.facial_detail);
        }
        // 构图
        if (vp.composition) {
            parts.push(vp.composition);
        }
    } else if (vp && typeof vp === 'string' && vp.trim()) {
        // 兼容旧格式：直接是字符串
        parts.push(vp);
    }
    
    // 4. 动作提示词
    var ap = shot.action_prompt;
    if (ap && typeof ap === 'object') {
        if (ap.physical_action) {
            parts.push(ap.physical_action);
        }
    }
    
    // 5. 情绪提示词
    var ec = shot.emotion_cue;
    if (ec && typeof ec === 'object') {
        if (ec.primary_emotion) {
            parts.push(ec.primary_emotion + ' mood');
        }
        if (ec.visual_mapping) {
            parts.push(ec.visual_mapping);
        }
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

// ==================== 剧本预解析 - 台词提取 ====================

/**
 * 剧本预解析：从原文中提取台词列表
 * 参考：魔因漫创 episode-parser.ts 的规则解析思路
 * 台词格式：角色名：台词内容 或 角色名:台词内容
 * 跳过：△开头的舞台指示、【字幕】、空行
 */
function preParseScript(content) {
    var dialogues = [];
    if (!content) return dialogues;
    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        // 跳过空行
        if (!line) continue;
        // 跳过舞台指示（△开头）
        if (line.charAt(0) === '△') continue;
        // 跳过字幕/转场
        if (/^【/.test(line)) continue;
        // 跳过场景头（如 "1-1 日 内 地点" 或 "场景1" 等）
        if (/^\d+-\d+\s/.test(line)) continue;
        if (/^场景\d+/.test(line)) continue;
        // 跳过 "人物：" 行
        if (/^人物[：:]/.test(line)) continue;
        // 跳过纯环境描写（太长的行，不像台词）
        if (line.length > 80) continue;
        
        // 匹配台词格式：角色名：台词 或 角色名:台词
        // 角色名1-8个中文字符，冒号后是台词内容
        var match = line.match(/^([\u4e00-\u9fa5A-Za-z0-9·]{1,8})[：:]\s*(.+)$/);
        if (match) {
            var charName = match[1].trim();
            var dialogueText = match[2].trim();
            // 排除明显的非台词行
            var nonDialoguePatterns = /^(第[一二三四五六七八九十\d]+集|大纲|人物小传|场景|时间|地点|氛围|视觉|标签|备注)/;
            if (nonDialoguePatterns.test(charName)) continue;
            if (dialogueText.length === 0) continue;
            dialogues.push({
                character: charName,
                text: dialogueText,
                lineIndex: i
            });
        }
    }
    return dialogues;
}

/**
 * 自动补全台词：检查预提取的台词是否都被分配到镜头，遗漏的自动补上
 */
function autoFillDialogue(normalized, dialogueList) {
    if (!dialogueList || dialogueList.length === 0) return normalized;
    
    // Step 1: 收集已有dialogue中出现的台词文本
    var assignedTexts = [];
    for (var si = 0; si < normalized.scenes.length; si++) {
        var scene = normalized.scenes[si];
        for (var shi = 0; shi < scene.shots.length; shi++) {
            var shot = scene.shots[shi];
            if (shot.dialogue && shot.dialogue.trim()) {
                assignedTexts.push(shot.dialogue.trim());
            }
            // 如果dialogue为空但original_text包含台词格式，自动提取
            if (!shot.dialogue || !shot.dialogue.trim()) {
                var origMatch = (shot.original_text || '').match(/([^：:\n]{1,8})[：:]\s*(.+)/);
                if (origMatch) {
                    shot.dialogue = '@' + origMatch[1].trim() + '：' + origMatch[2].trim();
                    assignedTexts.push(shot.dialogue);
                }
            }
        }
    }
    
    // Step 2: 检查遗漏的台词
    var missingDialogues = [];
    for (var di = 0; di < dialogueList.length; di++) {
        var d = dialogueList[di];
        var found = false;
        for (var ai = 0; ai < assignedTexts.length; ai++) {
            // 检查台词文本是否出现在已分配的dialogue中
            if (assignedTexts[ai].indexOf(d.text) !== -1) {
                found = true;
                break;
            }
        }
        if (!found) {
            missingDialogues.push(d);
        }
    }
    
    if (missingDialogues.length === 0) return normalized;
    
    console.log('[AI Service] 发现遗漏台词 ' + missingDialogues.length + ' 条，自动补全');
    
    // Step 3: 为遗漏的台词匹配场景并追加镜头
    for (var mi = 0; mi < missingDialogues.length; mi++) {
        var missing = missingDialogues[mi];
        
        // 优先匹配content中包含该台词原文的场景
        var targetScene = null;
        for (var sIdx = 0; sIdx < normalized.scenes.length; sIdx++) {
            var scene = normalized.scenes[sIdx];
            if (scene.content && scene.content.indexOf(missing.text) !== -1) {
                targetScene = scene;
                break;
            }
        }
        // 如果content中没有，按角色名匹配最后一个包含该角色的场景
        if (!targetScene) {
            for (var sIdx2 = normalized.scenes.length - 1; sIdx2 >= 0; sIdx2--) {
                var scene2 = normalized.scenes[sIdx2];
                if (scene2.characters.indexOf(missing.character) !== -1 || 
                    (scene2.content && scene2.content.indexOf(missing.character) !== -1)) {
                    targetScene = scene2;
                    break;
                }
            }
        }
        
        if (targetScene) {
            // 从已有镜头复用光影和色调描述
            var refLighting = '';
            var refPalette = '';
            for (var ri = 0; ri < targetScene.shots.length; ri++) {
                var refShot = targetScene.shots[ri];
                if (refShot.visual_prompt) {
                    if (refShot.visual_prompt.lighting && !refLighting) refLighting = refShot.visual_prompt.lighting;
                    if (refShot.visual_prompt.color_palette && !refPalette) refPalette = refShot.visual_prompt.color_palette;
                }
                if (refLighting && refPalette) break;
            }
            var sceneDesc = (targetScene.title || '') + '，' + missing.character + '说话';
            // 在该场景末尾追加一个近景镜头
            var newShot = {
                shot_number: targetScene.shots.length + 1,
                shot_type: '近景',
                camera_angle: '平视',
                camera_movement: '固定',
                duration: 3,
                dialogue: '@' + missing.character + '：' + missing.text,
                narration: '',
                scene_reference: '@' + (targetScene.title || ''),
                original_text: missing.character + '：' + missing.text,
                visual_prompt: {
                    lighting: refLighting || '自然光',
                    color_palette: refPalette || '',
                    character_placement: '@' + missing.character + ' 画面中央',
                    facial_detail: '',
                    scene_description: sceneDesc,
                    composition: '居中构图'
                },
                action_prompt: {
                    physical_action: '',
                    micro_movement: ''
                },
                emotion_cue: {
                    primary_emotion: '',
                    visual_mapping: ''
                }
            };
            targetScene.shots.push(newShot);
            console.log('[AI Service] 补全台词: @' + missing.character + '：' + missing.text.substring(0, 20));
        } else {
            console.log('[AI Service] 无法匹配场景，遗漏台词: @' + missing.character + '：' + missing.text.substring(0, 20));
        }
    }
    
    return normalized;
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

// ==================== Director Rule Engine（导演规则引擎）====================

/**
 * 导演规则引擎 - 对LLM输出的分镜JSON进行确定性修正
 * 解决LLM常见问题：全给中景、爽点不强化、情绪和镜头不匹配等
 */

/**
 * 情绪→镜头映射规则表
 * 愤怒 → 特写/大特写, 推镜头, 高对比红/橙色
 * 绝望 → 远景/全景, 拉镜头, 冷蓝色低对比
 * 震惊 → 近景/特写, 快速推镜, 高对比
 * 恐惧 → 近景, 推镜头, 暗调冷色
 * 悲伤 → 中景/远景, 慢拉, 低对比冷蓝
 * 喜悦 → 中景/近景, 轻推, 暖色高调
 * 压迫 → 特写, 慢推, 暗调
 */
var EMOTION_SHOT_RULES = {
    '愤怒': {
        shot_type: ['特写', '大特写'],
        camera_movement: '推镜头',
        light: '高对比红/橙色'
    },
    '绝望': {
        shot_type: ['远景', '全景'],
        camera_movement: '拉镜头',
        light: '冷蓝色低对比'
    },
    '震惊': {
        shot_type: ['近景', '特写'],
        camera_movement: '快速推镜',
        light: '高对比'
    },
    '恐惧': {
        shot_type: ['近景'],
        camera_movement: '推镜头',
        light: '暗调冷色'
    },
    '悲伤': {
        shot_type: ['中景', '远景'],
        camera_movement: '慢拉',
        light: '低对比冷蓝'
    },
    '喜悦': {
        shot_type: ['中景', '近景'],
        camera_movement: '轻推',
        light: '暖色高调'
    },
    '压迫': {
        shot_type: ['特写'],
        camera_movement: '慢推',
        light: '暗调'
    }
};

/**
 * 爽点检测关键词模式
 * 觉醒（抬头/睁眼/站起来/站起/觉醒/苏醒）→ 大特写, 仰视, 慢推, duration: 4
 * 反杀（一刀/击败/赢了/反杀/斩/杀）→ 特写, 跟镜头, duration: 2
 * 打脸（哼/冷笑/你算什么/不过如此/不值一提）→ 大特写, 仰视, duration: 3
 * 威压（气息/压迫/跪下/颤抖/跪/臣服）→ 特写, 推镜头, duration: 3
 * 装逼（慢慢/淡然/无所谓/轻轻/随意/微笑）→ 近景, 侧视, 环绕, duration: 4
 */
var POWER_UP_PATTERNS = [
    {
        name: '觉醒',
        keywords: ['抬头', '睁眼', '站起来', '站起', '觉醒', '苏醒', '爆发', '力量觉醒'],
        overrides: {
            shot_type: '大特写',
            camera_angle: '仰视',
            camera_movement: '慢推',
            duration: 4
        }
    },
    {
        name: '反杀',
        keywords: ['一刀', '击败', '赢了', '反杀', '斩', '杀', '击溃', '打败'],
        overrides: {
            shot_type: '特写',
            camera_movement: '跟镜头',
            duration: 2
        }
    },
    {
        name: '打脸',
        keywords: ['哼', '冷笑', '你算什么', '不过如此', '不值一提', '可笑', '不自量力'],
        overrides: {
            shot_type: '大特写',
            camera_angle: '仰视',
            duration: 3
        }
    },
    {
        name: '威压',
        keywords: ['气息', '压迫', '跪下', '颤抖', '跪', '臣服', '恐惧', '战栗'],
        overrides: {
            shot_type: '特写',
            camera_movement: '推镜头',
            duration: 3
        }
    },
    {
        name: '装逼',
        keywords: ['慢慢', '淡然', '无所谓', '轻轻', '随意', '微笑', '淡淡', '平静'],
        overrides: {
            shot_type: '近景',
            camera_angle: '侧视',
            camera_movement: '环绕',
            duration: 4
        }
    }
];

/**
 * 景别等级表（从远到近）
 */
var SHOT_LEVELS = ['远景', '全景', '中远景', '中景', '中近景', '近景', '特写', '大特写'];

/**
 * 获取景别等级索引
 */
function getShotLevelIndex(shotType) {
    var idx = SHOT_LEVELS.indexOf(shotType);
    return idx >= 0 ? idx : 4; // 默认返回中景的索引
}

/**
 * 升降景别（指定shot_type）
 * @param {string} currentType - 当前景别
 * @param {number} direction - 1=升级（更近）, -1=降级（更远）
 */
function adjustShotLevel(currentType, direction) {
    var idx = getShotLevelIndex(currentType);
    var newIdx = idx + direction;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= SHOT_LEVELS.length) newIdx = SHOT_LEVELS.length - 1;
    return SHOT_LEVELS[newIdx];
}

/**
 * 深拷贝对象（用于避免修改原始数据）
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        var arr = [];
        for (var i = 0; i < obj.length; i++) {
            arr.push(deepClone(obj[i]));
        }
        return arr;
    }
    var copy = {};
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; k++) {
        copy[keys[k]] = deepClone(obj[keys[k]]);
    }
    return copy;
}

/**
 * 检测爽点关键词
 * @param {Object} shot - 镜头对象
 * @returns {Object|null} - 命中的爽点模式或null
 */
function detectPowerUp(shot) {
    var text = '';
    if (shot.dialogue) text += shot.dialogue;
    if (shot.original_text) text += shot.original_text;
    if (shot.action_prompt && shot.action_prompt.physical_action) {
        text += shot.action_prompt.physical_action;
    }
    
    text = String(text).toLowerCase();
    
    for (var i = 0; i < POWER_UP_PATTERNS.length; i++) {
        var pattern = POWER_UP_PATTERNS[i];
        for (var j = 0; j < pattern.keywords.length; j++) {
            if (text.indexOf(pattern.keywords[j]) >= 0) {
                console.log('[Director Engine] 检测到爽点: ' + pattern.name + ' (关键词: ' + pattern.keywords[j] + ')');
                return pattern;
            }
        }
    }
    return null;
}

/**
 * 应用情绪→镜头映射规则
 * @param {Object} shot - 镜头对象
 */
function applyEmotionMapping(shot) {
    var emotion = shot.emotion_cue && shot.emotion_cue.primary_emotion;
    if (!emotion) return;
    
    var rule = EMOTION_SHOT_RULES[emotion];
    if (!rule) return;
    
    // 如果当前不是目标景别，进行映射
    if (rule.shot_type.indexOf(shot.shot_type) < 0) {
        // 随机选择一个目标景别
        var targetShot = rule.shot_type[Math.floor(Math.random() * rule.shot_type.length)];
        console.log('[Director Engine] 情绪映射: ' + emotion + ' → ' + targetShot);
        shot.shot_type = targetShot;
    }
    
    // 映射运镜（覆盖"固定"这种无意义的默认值）
    if (rule.camera_movement && (!shot.camera_movement || shot.camera_movement === '固定')) {
        console.log('[Director Engine] 情绪运镜映射: ' + emotion + ' → ' + rule.camera_movement);
        shot.camera_movement = rule.camera_movement;
    }
    
    // 映射灯光（覆盖空值或过于笼统的描述）
    if (rule.light && shot.visual_prompt) {
        var currentLight = shot.visual_prompt.lighting || '';
        if (!currentLight || currentLight === '自然光' || currentLight === '室内光') {
            console.log('[Director Engine] 情绪灯光映射: ' + emotion + ' → ' + rule.light);
            shot.visual_prompt.lighting = rule.light;
        }
    }
}

/**
 * 应用爽点强化规则（优先级高于情绪映射）
 * @param {Object} shot - 镜头对象
 */
function applyPowerUpEnhancement(shot) {
    var powerUp = detectPowerUp(shot);
    if (!powerUp) return;
    
    var overrides = powerUp.overrides;
    if (overrides.shot_type) {
        console.log('[Director Engine] 爽点强化: ' + powerUp.name + ' → ' + overrides.shot_type);
        shot.shot_type = overrides.shot_type;
    }
    if (overrides.camera_angle) {
        shot.camera_angle = overrides.camera_angle;
    }
    if (overrides.camera_movement) {
        shot.camera_movement = overrides.camera_movement;
    }
    if (overrides.duration) {
        shot.duration = overrides.duration;
    }
}

/**
 * 检查并修正景别多样性
 * @param {Array} shots - 镜头数组
 */
function fixShotTypeDiversity(shots) {
    if (!shots || shots.length < 3) return;
    
    var shotTypes = [];
    for (var i = 0; i < shots.length; i++) {
        shotTypes.push(shots[i].shot_type);
    }
    
    // 检查连续3个相同景别
    for (var i = 0; i < shots.length - 2; i++) {
        if (shotTypes[i] === shotTypes[i + 1] && shotTypes[i + 1] === shotTypes[i + 2]) {
            console.log('[Director Engine] 检测到连续3个相同景别: ' + shotTypes[i] + ' (位置: ' + (i+1) + '-' + (i+3) + ')');
            // 升降第2个镜头
            var currentType = shots[i + 1].shot_type;
            var midIdx = getShotLevelIndex(currentType);
            var direction = (midIdx <= 3) ? 1 : -1; // 前半部分升，后半部分降
            shots[i + 1].shot_type = adjustShotLevel(currentType, direction);
            console.log('[Director Engine] 强制升降景别: ' + currentType + ' → ' + shots[i + 1].shot_type);
            shotTypes[i + 1] = shots[i + 1].shot_type;
        }
    }
    
    // 检查整个scene是否有特写/大特写
    var hasExtreme = false;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].shot_type === '特写' || shots[i].shot_type === '大特写') {
            hasExtreme = true;
            break;
        }
    }
    
    if (!hasExtreme && shots.length > 0) {
        // 找到emotion强度最高的shot
        var maxEmotionIdx = 0;
        var maxEmotionScore = 0;
        for (var i = 0; i < shots.length; i++) {
            var emotion = shots[i].emotion_cue && shots[i].emotion_cue.primary_emotion;
            var score = emotion ? 1 : 0; // 简化评分
            if (score > maxEmotionScore) {
                maxEmotionScore = score;
                maxEmotionIdx = i;
            }
        }
        console.log('[Director Engine] scene缺少特写，为emotion最强shot添加特写');
        shots[maxEmotionIdx].shot_type = '特写';
    }
    
    // 检查整个scene是否有远景/全景
    var hasWide = false;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].shot_type === '远景' || shots[i].shot_type === '全景') {
            hasWide = true;
            break;
        }
    }
    
    if (!hasWide && shots.length > 0) {
        console.log('[Director Engine] scene缺少远景/全景，将第一个shot改为远景');
        shots[0].shot_type = '远景';
    }
}

/**
 * 检查并修正运镜多样性
 * @param {Array} shots - 镜头数组
 */
function fixCameraMovementDiversity(shots) {
    if (!shots || shots.length < 3) return;
    
    var movements = [];
    for (var i = 0; i < shots.length; i++) {
        movements.push(shots[i].camera_movement);
    }
    
    // 检查连续3个相同运镜
    for (var i = 0; i < shots.length - 2; i++) {
        if (movements[i] === movements[i + 1] && movements[i + 1] === movements[i + 2]) {
            console.log('[Director Engine] 检测到连续3个相同运镜: ' + movements[i] + ' (位置: ' + (i+1) + '-' + (i+3) + ')');
            // 改为其他运镜
            var alternatives = ['推镜头', '移镜头', '摇镜头', '跟镜头'];
            var currentMov = shots[i + 1].camera_movement;
            var newMov = currentMov;
            for (var j = 0; j < alternatives.length; j++) {
                if (alternatives[j] !== currentMov) {
                    newMov = alternatives[j];
                    break;
                }
            }
            shots[i + 1].camera_movement = newMov;
            console.log('[Director Engine] 强制改变运镜: ' + currentMov + ' → ' + newMov);
            movements[i + 1] = newMov;
        }
    }
    
    // 检查整个scene是否全是固定镜头
    var allFixed = true;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].camera_movement !== '固定') {
            allFixed = false;
            break;
        }
    }
    
    if (allFixed && shots.length >= 2) {
        console.log('[Director Engine] scene全是固定镜头，修改部分为推镜头/移镜头');
        // 至少修改2个为动态运镜
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
 * 检查并修正duration合理性
 * @param {Object} shot - 镜头对象
 * @param {string} shotType - 镜头类型
 */
function fixDurationReasonableness(shot, shotType) {
    var duration = shot.duration;
    var emotion = shot.emotion_cue && shot.emotion_cue.primary_emotion;
    
    // 对话镜头：2-4秒
    var isDialogue = shot.dialogue && shot.dialogue.trim().length > 0;
    // 动作镜头：1-3秒
    var isAction = shot.action_prompt && (
        shot.action_prompt.physical_action.indexOf('动') >= 0 ||
        shot.action_prompt.physical_action.indexOf('走') >= 0 ||
        shot.action_prompt.physical_action.indexOf('跑') >= 0 ||
        shot.action_prompt.physical_action.indexOf('打') >= 0
    );
    // 情绪特写：3-5秒
    var isEmotionCloseUp = (shotType === '特写' || shotType === '大特写' || shotType === '近景') && emotion;
    // 远景交代：3-5秒
    var isWideEstablishing = shotType === '远景' || shotType === '全景';
    
    var minDur, maxDur;
    if (isDialogue) {
        minDur = 2; maxDur = 4;
    } else if (isAction) {
        minDur = 1; maxDur = 3;
    } else if (isEmotionCloseUp) {
        minDur = 3; maxDur = 5;
    } else if (isWideEstablishing) {
        minDur = 3; maxDur = 5;
    } else {
        // 默认值
        minDur = 2; maxDur = 4;
    }
    
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
 * @param {Object} data - 归一化后的分镜数据
 * @returns {Object} - 修正后的分镜数据
 */
function applyDirectorEngine(data) {
    console.log('[Director Engine] 开始执行导演规则引擎...');
    
    // 深拷贝，避免修改原始数据
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
        
        // 第一步：逐个shot应用规则
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            
            // 1.1 先检测爽点（优先级最高）
            applyPowerUpEnhancement(shot);
            
            // 1.2 如果没有命中爽点，应用情绪映射
            if (!detectPowerUp(shot)) {
                applyEmotionMapping(shot);
            }
            
            // 1.3 修正duration合理性
            fixDurationReasonableness(shot, shot.shot_type);
        }
        
        // 第二步：场景级别的多样性修正
        fixShotTypeDiversity(scene.shots);
        fixCameraMovementDiversity(scene.shots);
        
        // 第三步：爽点优先级确保（场景级别修正后重新应用爽点强化）
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            if (detectPowerUp(shot)) {
                applyPowerUpEnhancement(shot);
            }
        }
        
        console.log('[Director Engine] 场景 ' + (si + 1) + ' 处理完成，共 ' + scene.shots.length + ' 个shots');
    }
    
    console.log('[Director Engine] 导演规则引擎执行完毕');
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
    
    // 预提取台词列表
    var dialogueList = preParseScript(scriptContent);
    var dialogueListStr = '';
    if (dialogueList.length > 0) {
        dialogueListStr = dialogueList.map(function(d, i) {
            return (i+1) + '. @' + d.character + '：' + d.text;
        }).join('\n');
    }
    console.log('[AI Service] 预提取台词数量:', dialogueList.length);
    
    var systemPrompt = STORYBOARD_SYSTEM_PROMPT;
    var userPrompt = interpolateTemplate(STORYBOARD_USER_TEMPLATE, {
        title: scriptTitle || '未命名剧本',
        content: scriptContent,
        character_bible: characterBible || '（暂无角色信息）',
        dialogue_list: dialogueListStr
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
    // 自动补全遗漏的台词
    normalized = autoFillDialogue(normalized, dialogueList);
    // 应用导演规则引擎进行确定性修正
    normalized = applyDirectorEngine(normalized);
    // 调试日志：检查每个镜头的dialogue输出
    normalized.scenes.forEach(function(s, si) {
        s.shots.forEach(function(sh, shi) {
            console.log('[AI Service] 场景' + (si+1) + ' 镜头' + (shi+1) + ' dialogue=' + JSON.stringify(sh.dialogue) + ' narration=' + JSON.stringify(sh.narration));
        });
    });
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
    applyDirectorEngine,
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
