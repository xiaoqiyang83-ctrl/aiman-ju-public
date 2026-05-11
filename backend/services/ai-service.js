/**
 * AI服务 - 支持多种AI后端（增强版）
 * 文心一言 / OpenAI / Claude / 硅基流动 / 智谱 等
 * 包含错误处理、重试机制、Token计算
 */

async function fetchJson(url, { method = 'POST', headers = {}, body, timeout = 60000 } = {}) {
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
        timeout: 60000
    },
    // 文心一言配置
    'ernie': {
        baseURL: process.env.ERNIE_BASE_URL || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
        apiKey: process.env.ERNIE_API_KEY || '',
        secretKey: process.env.ERNIE_SECRET_KEY || '',
        model: process.env.ERNIE_MODEL || 'ernie-4.0-8k-latest',
        timeout: 60000
    },
    // OpenAI兼容配置
    'openai': {
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        timeout: 60000
    },
    // 智谱AI配置
    'zhipu': {
        baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: process.env.ZHIPU_API_KEY || '',
        model: process.env.ZHIPU_MODEL || 'glm-4-flash',
        timeout: 60000
    },
    // 通义千问配置
    'qwen': {
        baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
        apiKey: process.env.QWEN_API_KEY || '',
        model: process.env.QWEN_MODEL || 'qwen-turbo',
        timeout: 60000
    },
    // 默认使用硅基流动
    'default': {
        baseURL: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
        timeout: 60000
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
            console.log(`[AI Service] 请求失败，第${i + 1}次重试...`);
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

        const url = new URL('/chat/completions', config.baseURL);
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
            response_format: { type: 'json_object' }
        };

        const url = new URL('/chat/completions', config.baseURL);
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

function extractFirstJsonObject(text) {
    const t = String(text || '');
    const fenced = t.match(/```json\s*([\s\S]*?)\s*```/i) || t.match(/```\s*([\s\S]*?)\s*```/);
    let candidate = fenced ? fenced[1] : t;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
        candidate = candidate.slice(start, end + 1);
        // 清理JSON字符串中的非法控制字符（裸换行/制表符等，保留合法转义的 \n \t \r \" \\）
        candidate = candidate.replace(/[\x00-\x1f]/g, (ch) => {
            if (ch === '\n') return '\\n';
            if (ch === '\r') return '\\r';
            if (ch === '\t') return '\\t';
            return '';
        });
        return candidate;
    }
    return '';
}

function normalizeStoryboardJson(raw) {
    const movementMap = {
        static: '固定',
        push_in: '推镜头',
        pull_back: '拉镜头',
        tracking: '移镜头',
        pan: '摇镜头'
    };
    const shotTypeMap = {
        wide: '远景',
        long_shot: '远景',
        establishing: '全景',
        full_shot: '全景',
        medium: '中景',
        medium_shot: '中景',
        close: '近景',
        close_up: '近景',
        extreme_close_up: '大特写',
        ecu: '大特写'
    };

    const obj = raw && typeof raw === 'object' ? raw : {};
    const scenes = Array.isArray(obj.scenes) ? obj.scenes : (Array.isArray(obj.data?.scenes) ? obj.data.scenes : []);
    const normScenes = scenes.map((s, idx) => {
        const shots = Array.isArray(s?.shots) ? s.shots : [];
        const normShots = shots.map((sh, j) => {
            const shot_number = Number(sh?.shot_number || sh?.number || (j + 1)) || (j + 1);
            const rawShotType = String(sh?.shot_type || sh?.shotType || '中景');
            const shot_type = shotTypeMap[rawShotType] || rawShotType;
            const rawMovement = String(sh?.camera_movement || sh?.cameraMovement || '固定');
            const camera_movement = movementMap[rawMovement] || rawMovement;
            const duration = Number(sh?.duration) || 4;
            const visual_prompt = String(sh?.visual_prompt || sh?.visualPrompt || sh?.visual_description || sh?.description || '');
            const original_text = String(sh?.original_text || sh?.originalText || sh?.text || '');
            const dialogue = String(sh?.dialogue || sh?.line || '');
            const action_description = String(sh?.action_description || sh?.actionDescription || '');
            return {
                shot_number,
                shot_type,
                camera_movement,
                duration,
                visual_prompt,
                visual_description: visual_prompt,
                original_text,
                dialogue,
                action_description
            };
        });
        return {
            episode: s?.episode ? String(s.episode) : '',
            scene_number: s?.scene_number ? String(s.scene_number) : String(idx + 1),
            title: String(s?.title || ''),
            location: String(s?.location || ''),
            time_of_day: String(s?.time_of_day || s?.timeOfDay || ''),
            characters: Array.isArray(s?.characters) ? s.characters.map(x => String(x)).filter(Boolean) : [],
            content: String(s?.content || s?.text || ''),
            shots: normShots
        };
    });
    return { scenes: normScenes };
}

function buildLightAndMood(timeOfDay) {
    const t = String(timeOfDay || '');
    if (t.includes('夜')) return { light: '灯光与暗部对比强，局部高光', mood: '紧张压迫，暗色氛围' };
    if (t.includes('晨') || t.includes('清晨') || t.includes('早')) return { light: '清晨侧光，空气有薄雾感', mood: '清冷但充满期待' };
    if (t.includes('午') || t.includes('日') || t.includes('日内') || t.includes('日外')) return { light: '明亮自然光，柔和阴影', mood: '真实日常但暗藏危机' };
    return { light: '自然光与环境反射光', mood: '氛围真实，情绪推进' };
}

function hasLightAndMood(text) {
    const t = String(text || '');
    return /光|灯|阴影|逆光|侧光|高光|暗部|氛围|色调|冷暖|雾|尘|烟|霓虹/.test(t);
}

function normalizeShotTypeValue(v) {
    const t = String(v || '').trim();
    if (!t) return '中景';
    const map = {
        '大远景': '远景',
        '远景': '远景',
        '全景': '全景',
        '中景': '中景',
        '近景': '近景',
        '特写': '特写',
        '大特写': '大特写',
        '极特写': '大特写'
    };
    return map[t] || t;
}

function normalizeMovementValue(v) {
    const t = String(v || '').trim();
    if (!t) return '固定';
    const map = {
        '固定': '固定',
        '推镜头': '推镜头',
        '拉镜头': '拉镜头',
        '移镜头': '移镜头',
        '摇镜头': '摇镜头',
        '推进': '推镜头',
        '拉远': '拉镜头',
        '跟拍': '移镜头',
        '摇摄': '摇镜头'
    };
    return map[t] || t;
}

function extractDialoguesFromSceneContent(content) {
    const t = String(content || '');
    const dialogues = [];
    const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
        if (/^(人物|场景|地点|时间|道具|备注|场次)[：:]/.test(line)) continue;
        if (/^(第.{1,3}集|第.{1,3}场)/.test(line)) continue;
        // 格式1: 角色：台词 / 角色: 台词 (含括号标注如"队长（惊喜）：")
        const m1 = line.match(/^(.{1,16}?)(?:\s*[（(]([^)）]+)[)）])?\s*(VO|OS)?\s*[：:]\s*(.+)$/i);
        if (m1) {
            const rhs = String(m1[4] || '').trim();
            if (rhs && rhs.length < 200) dialogues.push(rhs);
            continue;
        }
        // 格式2: 【角色】台词
        const m2 = line.match(/^【(.{1,16}?)】\s*(.+)$/);
        if (m2) {
            const rhs = String(m2[2] || '').trim();
            if (rhs && rhs.length < 200) dialogues.push(rhs);
            continue;
        }
        // 格式3: 角色名 台词（2个以上空格分隔）
        const m3 = line.match(/^([\u4e00-\u9fa5]{1,8})\s{2,}(.+)$/);
        if (m3 && !/^(旁白|画外音|动作|场景|说明)/.test(m3[1])) {
            const rhs = String(m3[2] || '').trim();
            if (rhs && rhs.length < 200 && /[\u4e00-\u9fa5]/.test(rhs)) dialogues.push(rhs);
            continue;
        }
    }
    if (dialogues.length) return dialogues;
    // Fallback: extract from Chinese/English quotes
    const quotes = String(t || '').match(/“([^”]+)”|「([^」]+)」|"([^"]+)"|‘([^’]+)’/g) || [];
    for (const q of quotes) {
        const inner = q.replace(/^[\"“「‘]/, '').replace(/[\"”」’]$/, '').trim();
        if (inner && inner.length >= 2 && inner.length < 200) dialogues.push(inner);
    }
    return dialogues;
}

function extractSpeakersFromSceneContent(content) {
    const t = String(content || '');
    const speakers = [];
    const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
        if (/^人物[：:]/.test(line)) continue;
        const m = line.match(/^(.{1,16}?)(?:\s*\(([^)]+)\))?\s*(VO|OS)?\s*[：:]\s*(.+)$/i);
        if (!m) continue;
        const left = String(m[1] || '').trim();
        if (!left) continue;
        if (/旁白/.test(left)) continue;
        speakers.push(left);
    }
    return [...new Set(speakers)].slice(0, 6);
}

function enforceShotAndMovementVariation(shots, { time_of_day, location, characters }) {
    const list = Array.isArray(shots) ? shots.map(s => ({ ...s })) : [];
    if (!list.length) return list;

    const shotPattern = ['远景', '全景', '中景', '近景', '特写'];
    const movePattern = ['固定', '推镜头', '移镜头', '摇镜头', '拉镜头'];
    const shotTypes = list.map(s => normalizeShotTypeValue(s.shot_type));
    const movements = list.map(s => normalizeMovementValue(s.camera_movement));
    const uniqueShot = new Set(shotTypes.filter(Boolean));
    const uniqueMove = new Set(movements.filter(Boolean));

    for (let i = 0; i < list.length; i++) {
        if (uniqueShot.size <= 2) list[i].shot_type = shotPattern[i % shotPattern.length];
        else list[i].shot_type = normalizeShotTypeValue(list[i].shot_type);

        if (uniqueMove.size <= 1) list[i].camera_movement = movePattern[i % movePattern.length];
        else list[i].camera_movement = normalizeMovementValue(list[i].camera_movement);

        if (i > 0 && list[i].shot_type === list[i - 1].shot_type) {
            list[i].shot_type = shotPattern[(i + 1) % shotPattern.length];
        }
        if (i > 0 && list[i].camera_movement === list[i - 1].camera_movement) {
            list[i].camera_movement = movePattern[(i + 1) % movePattern.length];
        }

        const prompt = String(list[i].visual_prompt || list[i].visual_description || '').trim();
        const safePrompt = (() => {
            if (!/[你您]/.test(prompt)) return prompt;
            const replacement =
                (Array.isArray(characters) && characters.filter(Boolean)[0]) ||
                String(location || '').trim() ||
                '角色';
            return prompt
                .replace(/和你们/g, `和${replacement}`)
                .replace(/和你/g, `和${replacement}`)
                .replace(/与你们/g, `与${replacement}`)
                .replace(/与你/g, `与${replacement}`)
                .replace(/你们/g, replacement)
                .replace(/你/g, replacement)
                .replace(/您/g, replacement);
        })();

        if (!hasLightAndMood(safePrompt)) {
            const lm = buildLightAndMood(time_of_day);
            const loc = String(location || '').trim();
            const chars = Array.isArray(characters) ? characters.filter(Boolean) : [];
            const hasChar = chars.length ? chars.some(c => safePrompt.includes(String(c))) : false;
            const suffix = `，光影：${lm.light}，氛围：${lm.mood}${loc ? `，地点：${loc}` : ''}${chars.length && !hasChar ? `，人物：${chars.join('、')}` : ''}`;
            list[i].visual_prompt = `${safePrompt || '画面描述'}${suffix}`;
            list[i].visual_description = list[i].visual_prompt;
        } else if (safePrompt !== prompt) {
            list[i].visual_prompt = safePrompt;
            list[i].visual_description = safePrompt;
        }
    }
    return list;
}

function assignDialoguesToShots(scene, shots) {
    const list = Array.isArray(shots) ? shots.map(s => ({ ...s })) : [];
    if (!list.length) return list;
    const extracted = extractDialoguesFromSceneContent(scene?.content || '');
    const speakers = extractSpeakersFromSceneContent(scene?.content || '');
    const nonEmptyDialogueCount = list.filter(s => String(s.dialogue || '').trim()).length;
    // If model already assigned dialogues well, trust it
    if (nonEmptyDialogueCount >= extracted.length && nonEmptyDialogueCount > 0) return list;
    if (!extracted.length && nonEmptyDialogueCount) return list;

    if (!extracted.length) {
        // Try to extract from original_text of each shot
        for (let i = 0; i < list.length; i++) {
            const orig = String(list[i].original_text || '').trim();
            if (!orig) list[i].original_text = String(scene?.content || '').trim();
            if (!String(list[i].dialogue || '').trim()) {
                // Try extracting from quotes in original_text
                const quotedMatch = String(orig).match(/“([^”]+)”|「([^」]+)」|"([^"]+)"/);
                if (quotedMatch) {
                    const d = (quotedMatch[1] || quotedMatch[2] || quotedMatch[3] || '').trim();
                    if (d) list[i].dialogue = d;
                }
                // Try 角色：台词 in original_text
                if (!list[i].dialogue) {
                    const colonMatch = String(orig).match(/[\u4e00-\u9fa5]{1,8}[：:]\s*(.+)$/);
                    if (colonMatch) list[i].dialogue = String(colonMatch[1] || '').trim();
                }
                if (!list[i].dialogue) {
                    list[i].dialogue = '';
                    list[i].action_description = list[i].action_description || orig || '';
                }
            }
        }
        return list;
    }

    // Distribute extracted dialogues to shots that don't have one
    let dIdx = 0;
    for (let i = 0; i < list.length; i++) {
        if (!String(list[i].dialogue || '').trim() && dIdx < extracted.length) {
            list[i].dialogue = extracted[dIdx] || '';
            dIdx++;
        }
        if (!String(list[i].original_text || '').trim()) {
            list[i].original_text = String(list[i].dialogue || scene?.content || '').trim();
        }
        if (!String(list[i].action_description || '').trim()) {
            const orig = String(list[i].original_text || '').trim();
            list[i].action_description = orig.replace(/“[^”]+”|「[^」]+」|"([^"]+)"/g, '').trim();
        }
    }
    // If more dialogues than shots, append to last shot
    while (dIdx < extracted.length) {
        const lastShot = list[list.length - 1];
        if (lastShot) {
            lastShot.dialogue = lastShot.dialogue ? lastShot.dialogue + '\uFF1B' + extracted[dIdx] : extracted[dIdx];
        }
        dIdx++;
    }

    const anyDialogue = list.some(s => String(s.dialogue || '').trim());
    if (!anyDialogue && extracted.length) {
        list[0].dialogue = extracted[0] || '';
    }
    return list;
}
function ensureDialogueCoverage(scene, shots) {
    const list = Array.isArray(shots) ? shots.map(s => ({ ...s })) : [];
    const extracted = extractDialoguesFromSceneContent(scene?.content || '');
    if (extracted.length < 2) return list;

    const speakers = extractSpeakersFromSceneContent(scene?.content || '');
    const location = String(scene?.location || scene?.title || '').trim();
    const lm = buildLightAndMood(scene?.time_of_day || scene?.timeOfDay || '');

    const existing = new Set(list.map(s => String(s.dialogue || '').trim()).filter(Boolean));
    for (const d of extracted) {
        const dt = String(d || '').trim();
        if (!dt) continue;
        if (existing.has(dt)) continue;
        const shot_number = list.length + 1;
        const shot_type = normalizeShotTypeValue(['中景', '近景', '特写'][shot_number % 3]);
        const camera_movement = normalizeMovementValue(['固定', '推镜头', '移镜头'][shot_number % 3]);
        const speaker = speakers[shot_number % Math.max(1, speakers.length)] || speakers[0] || '';
        const base = `${shot_type}，${location || '室内'}，${speaker ? `${speaker}说话，` : ''}对白清晰，表情和语气可见`;
        const visual_prompt = `${base}，光影：${lm.light}，氛围：${lm.mood}`;
        list.push({
            shot_number,
            shot_type,
            camera_movement,
            duration: 3,
            visual_prompt,
            visual_description: visual_prompt,
            original_text: dt,
            dialogue: dt,
            action_description: ''
        });
        existing.add(dt);
    }

    if (list.length < 5 && (speakers.length || location)) {
        const establish = {
            shot_number: 0,
            shot_type: '远景',
            camera_movement: '摇镜头',
            duration: 4,
            visual_prompt: `远景，${location || '地点'}整体空间与环境信息，人物关系站位清晰，光影：${lm.light}，氛围：${lm.mood}`,
            visual_description: '',
            original_text: String(scene?.content || '').split('\n').slice(0, 3).join('\n').trim(),
            dialogue: '',
            action_description: '交代场景与人物关系'
        };
        establish.visual_description = establish.visual_prompt;
        list.unshift(establish);

        const closing = {
            shot_number: 0,
            shot_type: '特写',
            camera_movement: '推镜头',
            duration: 4,
            visual_prompt: `特写，${speakers[0] ? `${speakers[0]}的眼神与微表情` : '人物的眼神与微表情'}，情绪收束，光影：${lm.light}，氛围：${lm.mood}`,
            visual_description: '',
            original_text: String(scene?.content || '').split('\n').slice(-3).join('\n').trim(),
            dialogue: '',
            action_description: '收束情绪与悬念'
        };
        closing.visual_description = closing.visual_prompt;
        list.push(closing);
    }

    return list;
}

function dedupeAndRenumberShots(shots) {
    const list = Array.isArray(shots) ? shots.map(s => ({ ...s })) : [];
    const seen = new Set();
    const out = [];
    for (const sh of list) {
        const prompt = String(sh.visual_prompt || '').trim();
        const basePrompt = prompt.replace(/，光影：.*$/, '').trim();
        const dialogue = String(sh.dialogue || '').trim();
        const originalText = String(sh.original_text || '').trim();
        const key = [dialogue, originalText, basePrompt].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(sh);
    }
    for (let i = 0; i < out.length; i++) out[i].shot_number = i + 1;
    return out;
}

function postProcessStoryboard(normalized) {
    const scenes = Array.isArray(normalized?.scenes) ? normalized.scenes : [];
    const processed = scenes.map((scene) => {
        const shots0 = Array.isArray(scene?.shots) ? scene.shots : [];
        const shots1 = enforceShotAndMovementVariation(shots0, { time_of_day: scene.time_of_day, location: scene.location, characters: scene.characters });
        const shots2 = assignDialoguesToShots(scene, shots1);
        const shots3 = ensureDialogueCoverage(scene, shots2);
        const shots4 = enforceShotAndMovementVariation(shots3, { time_of_day: scene.time_of_day, location: scene.location, characters: scene.characters });
        const shots5 = dedupeAndRenumberShots(shots4);
        return { ...scene, shots: shots5 };
    });
    return { scenes: processed };
}

async function generateStoryboardFromScript({ title, content }) {
    const scriptTitle = String(title || '').trim();
    const scriptContent = String(content || '').trim();
    const provider = resolveChatProvider();
    if (!provider) {
        throw new Error('未配置可用的大模型接口。请在 backend/.env 按 backend/.env.example 添加：AI_PROVIDER=openai-compatible、AI_API_KEY、AI_BASE_URL、AI_MODEL（推荐），然后重试上传。');
    }

        const system = `你是资深漫剧导演+分镜师。把用户提供的漫剧剧本原文拆成场景列表+每场景镜头列表。你只输出JSON，不要任何解释。

【关键规则】
1. dialogue字段最重要：每句台词/旁白都必须写入对应镜头的dialogue字段，绝对不能留空。纯动作镜头dialogue写空字符串""。
2. 景别必须有变化：远景→全景→中景→近景→特写交替使用，不要全是特写或全景。
3. 运镜必须有变化：固定/推镜头/拉镜头/移镜头/摇镜头交替使用，不要全是固定。
4. visual_prompt必须具体可拍：必须包含地点+人物名+具体动作+表情情绪+光影+氛围，不要写模板化描述。
5. 禁止第二人称：visual_prompt中不允许出现"你/你们/和你"等词，必须用具体角色名。
6. 禁止重复镜头。

【范例】
输入剧本片段：
农场-温室，日外。队长看着枯萎的番茄，队员甲跑来。
队长：完了，这批番茄全完了。
队员甲：队长！北边发现了活株！
队长（惊喜）：真的？快带我去！

输出JSON：
{
  "scenes": [{
    "episode": "1",
    "scene_number": "1",
    "title": "农场-温室",
    "location": "农场-温室内部",
    "time_of_day": "日外",
    "characters": ["队长", "队员甲"],
    "content": "农场-温室，日外。队长看着枯萎的番茄，队员甲跑来。\n队长：完了，这批番茄全完了。\n队员甲：队长！北边发现了活株！\n队长（惊喜）：真的？快带我去！",
    "shots": [
      {"shot_number":1,"shot_type":"全景","camera_movement":"摇镜头","duration":4,"visual_prompt":"全景，农场温室内部，枯萎番茄藤蔓蔓延整个画面，队长站在田垄间低头审视，光影：顶棚透过的强光照射枯叶，氛围：压抑绝望","original_text":"农场-温室，日外。队长看着枯萎的番茄","dialogue":"","action_description":"队长审视枯萎番茄"},
      {"shot_number":2,"shot_type":"近景","camera_movement":"推镜头","duration":3,"visual_prompt":"近景，队长面部特写，眉头紧锁眼神沮丧，手中枯叶掉落，光影：侧面强光勾勒面部轮廓，氛围：沉重无奈","original_text":"队长：完了，这批番茄全完了。","dialogue":"完了，这批番茄全完了。","action_description":"队长沮丧地说"},
      {"shot_number":3,"shot_type":"中景","camera_movement":"移镜头","duration":3,"visual_prompt":"中景，队员甲从远处跑来，喘着气表情激动，背景温室门框，光影：逆光剪影效果，氛围：紧张转期待","original_text":"队员甲跑来\n队员甲：队长！北边发现了活株！","dialogue":"队长！北边发现了活株！","action_description":"队员甲跑来报告"},
      {"shot_number":4,"shot_type":"特写","camera_movement":"固定","duration":3,"visual_prompt":"特写，队长眼睛瞬间睁大，瞳孔中映出队员甲的身影，嘴角微扬，光影：眼神中映出希望之光，氛围：惊喜爆发","original_text":"队长（惊喜）：真的？快带我去！","dialogue":"真的？快带我去！","action_description":"队长惊喜反应"},
      {"shot_number":5,"shot_type":"远景","camera_movement":"拉镜头","duration":4,"visual_prompt":"远景，两人一前一后奔出温室大门，奔向远方的北面田野，光影：阳光洒在奔跑的身影上，氛围：充满希望与紧迫感","original_text":"队长和队员甲奔向北面","dialogue":"","action_description":"两人奔出温室"}
    ]
  }]
}

注意：上面范例中有2个镜头dialogue为空（纯动作镜头），3个镜头有台词。每个有台词的镜头，dialogue都写入了台词内容。这就是你要遵循的格式。`;

    const user = `请严格参照上面的范例格式，把下面剧本拆成JSON。特别注意：每句台词必须写入对应镜头的dialogue字段，不能留空！

【剧本标题】${scriptTitle}

【剧本原文】
${scriptContent}`;

    let result;
    try {
        result = await generateTextWithProvider(provider, { system, user, temperature: 0.3, maxTokens: 8000, enableRetry: true });
    } catch (e) {
        const msg = String(e?.message || '');
        if (provider === 'ernie' && /client_id|client id|invalid|无效/i.test(msg)) {
            throw new Error('文心一言鉴权失败（client_id 无效）。请在 backend/.env 配置可用的 OpenAI兼容接口：AI_API_KEY / AI_BASE_URL / AI_MODEL（或配置 SILICONFLOW_API_KEY），然后重试上传。');
        }
        throw e;
    }

    let jsonText = extractFirstJsonObject(result.content);
    if (!jsonText) throw new Error('AI返回内容无法解析为JSON');

    // 二次清理：确保没有残留的控制字符
    jsonText = jsonText.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (e) {
        // 最后一次尝试：暴力清理所有控制字符（包括换行符）
        try {
            const cleaned = jsonText.replace(/[\x00-\x1f]/g, ' ');
            parsed = JSON.parse(cleaned);
            console.log('[AI Service] JSON解析通过（二次清理后）');
        } catch (e2) {
            console.error('[AI Service] JSON原始内容前200字符:', jsonText.slice(0, 200));
            throw new Error('AI返回JSON解析失败: ' + e.message);
        }
    }

    const normalized = normalizeStoryboardJson(parsed);
    const processed = postProcessStoryboard(normalized);
    if (!processed.scenes.length) throw new Error('AI返回JSON缺少 scenes');
    return { success: true, provider, model: result.model, usage: result.usage, data: processed };
}

/**
 * 生成漫剧剧本
 * @param {Object} params - 剧本参数
 * @returns {Promise<Object>} - 返回剧本内容
 */
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
    postProcessStoryboard,
    generateScript,
    continueScript,
    generateDialogue,
    generateSceneDescription,
    generateTitle,
    batchGenerate,
    generateCoverPrompt,
    AI_CONFIG,
    CURRENT_PROVIDER
};
