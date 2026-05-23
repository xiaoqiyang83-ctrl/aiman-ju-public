/**
 * 分镜数据校验中间件 - v6.1
 * 在 generateStoryboardFromScript 返回结果前调用，进行运行时校验
 * 校验结果写入日志（console.warn），不阻断流程但记录所有问题
 * 
 * 遵循风格：var声明、无箭头函数、无模板字符串
 */

var SHOT_TYPE_MAP = {
    '远景': { promptToken: 'wide shot', durationRange: [3, 8] },
    '全景': { promptToken: 'panoramic shot', durationRange: [3, 8] },
    '中远景': { promptToken: 'medium wide shot', durationRange: [3, 6] },
    '中景': { promptToken: 'medium shot', durationRange: [2, 5] },
    '中近景': { promptToken: 'medium close-up shot', durationRange: [2, 5] },
    '近景': { promptToken: 'close-up shot', durationRange: [2, 4] },
    '特写': { promptToken: 'extreme close-up shot', durationRange: [1, 3] },
    '大特写': { promptToken: 'big extreme close-up shot', durationRange: [1, 3] }
};

var CAMERA_MOVEMENT_MAP = {
    '固定': 'static camera',
    '推镜头': 'push in',
    '拉镜头': 'pull out',
    '移镜头': 'tracking shot',
    '摇镜头': 'pan shot',
    '跟镜头': 'follow shot',
    '环绕': 'circular shot',
    '慢推': 'slow push in',
    '快速推镜': 'fast push in',
    '慢拉': 'slow pull out'
};

var FALLBACK_SHOT_TYPES = ['远景', '全景', '中景', '近景', '特写'];
var FALLBACK_MOVEMENTS = ['固定', '推镜头', '移镜头', '摇镜头'];

/**
 * 校验分镜数据的完整性、格式和合理性
 * @param {Object} data - 分镜JSON数据
 * @returns {Object} - 校验后的数据（可能包含修复）
 */
function validateStoryboard(data) {
    var warnings = [];
    
    // 深拷贝避免修改原始数据
    var result = deepClone(data);
    
    if (!result || !result.scenes) {
        console.warn('[validateStoryboard] 警告: 数据结构异常，缺少scenes');
        return result;
    }
    
    for (var si = 0; si < result.scenes.length; si++) {
        var scene = result.scenes[si];
        var sceneWarnings = [];
        
        // 检查场景基本信息
        if (!scene.title) {
            sceneWarnings.push('场景' + (si + 1) + '缺少title，使用location替代');
            scene.title = scene.location || '未命名场景';
        }
        
        if (!scene.time_of_day) {
            sceneWarnings.push('场景' + (si + 1) + '缺少time_of_day，默认设置为日内');
            scene.time_of_day = '日内';
        }
        
        if (!scene.shots || !Array.isArray(scene.shots)) {
            sceneWarnings.push('场景' + (si + 1) + '缺少shots数组或格式异常');
            continue;
        }
        
        for (var i = 0; i < scene.shots.length; i++) {
            var shot = scene.shots[i];
            var shotNum = i + 1;
            var shotWarnings = [];
            
            // 1. 字段完整性校验 - 缺失字段自动补默认值
            shotWarnings = shotWarnings.concat(validateShotFields(shot, shotNum));
            
            // 2. visual_prompt各字段类型检查
            shotWarnings = shotWarnings.concat(validateVisualPrompt(shot, shotNum));
            
            // 3. dialogue格式检查
            shotWarnings = shotWarnings.concat(validateDialogue(shot, shotNum));
            
            // 4. 台词堆叠校验
            shotWarnings = shotWarnings.concat(validateDialogueCount(shot, shotNum));
            
            // 5. duration合理性校验
            shotWarnings = shotWarnings.concat(validateDuration(shot, shotNum));
            
            // 6. compileImagePrompt结果检查（如果已生成）
            if (shot.image_prompt !== undefined) {
                shotWarnings = shotWarnings.concat(validateImagePrompt(shot, shotNum));
            }
            
            // 收集分镜警告
            if (shotWarnings.length > 0) {
                sceneWarnings.push('分镜' + shotNum + ': ' + shotWarnings.join('; '));
            }
        }
        
        // 输出场景级警告
        for (var j = 0; j < sceneWarnings.length; j++) {
            console.warn('[validateStoryboard] 警告: ' + sceneWarnings[j]);
            warnings.push(sceneWarnings[j]);
        }
    }
    
    // 输出汇总
    if (warnings.length > 0) {
        console.warn('[validateStoryboard] 共检测到' + warnings.length + '个问题，已自动修复');
    } else {
        console.log('[validateStoryboard] 校验通过，无问题');
    }
    
    return result;
}

/**
 * 深拷贝函数
 */
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

/**
 * 校验分镜必填字段，缺失则补默认值
 */
function validateShotFields(shot, shotNum) {
    var warnings = [];
    var defaults = {
        shot_number: shotNum,
        shot_type: '中景',
        camera_movement: '固定',
        camera_angle: '平视',
        duration: 3,
        emotion_cue: { primary_emotion: '', visual_mapping: '' },
        visual_prompt: {
            scene_description: '',
            lighting: '',
            color_palette: '',
            character_placement: '',
            facial_detail: '',
            composition: ''
        },
        action_prompt: { physical_action: '', micro_movement: '' },
        dialogue: '',
        narration: '',
        original_text: '',
        scene_reference: ''
    };
    
    var requiredFields = ['shot_type', 'camera_movement', 'duration', 'emotion_cue', 'visual_prompt', 'dialogue'];
    
    for (var i = 0; i < requiredFields.length; i++) {
        var field = requiredFields[i];
        if (shot[field] === undefined || shot[field] === null) {
            warnings.push('缺少字段[' + field + ']，已补默认值: ' + JSON.stringify(defaults[field]));
            shot[field] = deepClone(defaults[field]);
        }
    }
    
    // 景别有效性检查
    if (!SHOT_TYPE_MAP[shot.shot_type]) {
        warnings.push('景别[' + shot.shot_type + ']不在标准列表中，已替换为中景');
        shot.shot_type = '中景';
    }
    
    // 运镜有效性检查
    if (!CAMERA_MOVEMENT_MAP[shot.camera_movement]) {
        warnings.push('运镜[' + shot.camera_movement + ']不在标准列表中，已替换为固定');
        shot.camera_movement = '固定';
    }
    
    return warnings;
}

/**
 * 校验visual_prompt各字段类型，非字符串自动转字符串
 */
function validateVisualPrompt(shot, shotNum) {
    var warnings = [];
    var vp = shot.visual_prompt;
    
    if (!vp) {
        warnings.push('visual_prompt为空，已创建空对象');
        shot.visual_prompt = {
            scene_description: '',
            lighting: '',
            color_palette: '',
            character_placement: '',
            facial_detail: '',
            composition: ''
        };
        return warnings;
    }
    
    if (typeof vp !== 'object' || Array.isArray(vp)) {
        warnings.push('visual_prompt类型异常(' + typeof vp + ')，已转换为对象');
        shot.visual_prompt = {
            scene_description: String(vp || ''),
            lighting: '',
            color_palette: '',
            character_placement: '',
            facial_detail: '',
            composition: ''
        };
        return warnings;
    }
    
    var stringFields = ['scene_description', 'lighting', 'color_palette', 'character_placement', 'facial_detail', 'composition'];
    
    for (var i = 0; i < stringFields.length; i++) {
        var field = stringFields[i];
        var value = vp[field];
        
        if (value === undefined || value === null) {
            vp[field] = '';
            continue;
        }
        
        if (typeof value !== 'string') {
            warnings.push('visual_prompt.' + field + '类型为' + typeof value + '，已转换为字符串');
            vp[field] = String(value);
        }
    }
    
    return warnings;
}

/**
 * 校验dialogue格式，缺少@标注的自动补充为@旁白（v6.2）
 */
function validateDialogue(shot, shotNum) {
    var warnings = [];
    var dialogue = String(shot.dialogue || '').trim();
    
    if (!dialogue) {
        return warnings;  // 空台词不需要检查格式
    }
    
    // 检查是否有标注格式 @角色名：
    var atPattern = /^@[\u4e00-\u9fa5a-zA-Z0-9]+[：:]/;
    
    // v6.2：所有不以@开头的非空台词都补充@旁白
    if (!atPattern.test(dialogue)) {
        warnings.push('台词缺少@角色标注，已补充@旁白');
        shot.dialogue = '@旁白：' + dialogue;
    }
    
    return warnings;
}

/**
 * 校验台词数量，单个分镜超过2条发出警告（v6.2改为2条上限）
 */
function validateDialogueCount(shot, shotNum) {
    var warnings = [];
    var dialogue = String(shot.dialogue || '').trim();
    
    if (!dialogue) {
        return warnings;
    }
    
    // 统计台词条数（@角色名：格式）
    var matches = dialogue.match(/@[\u4e00-\u9fa5a-zA-Z0-9]+[：:]/g);
    var count = matches ? matches.length : 0;
    
    // 如果没有@标注格式，尝试用分号分隔统计
    if (count === 0 && dialogue.indexOf('；') >= 0) {
        count = dialogue.split('；').length;
    }
    
    if (count > 2) {
        warnings.push('分镜台词有' + count + '条，超过2条限制，建议拆分到多个分镜');
    }
    
    return warnings;
}

/**
 * 校验duration合理性
 */
function validateDuration(shot, shotNum) {
    var warnings = [];
    var duration = Number(shot.duration);
    
    if (isNaN(duration)) {
        warnings.push('duration为非数字，已设置为3');
        shot.duration = 3;
        return warnings;
    }
    
    if (duration < 2) {
        warnings.push('duration=' + duration + '过短（<2秒），已调整为2秒');
        shot.duration = 2;
    } else if (duration > 10) {
        warnings.push('duration=' + duration + '过长（>10秒），已调整为10秒');
        shot.duration = 10;
    }
    
    return warnings;
}

/**
 * 校验compileImagePrompt结果类型
 */
function validateImagePrompt(shot, shotNum) {
    var warnings = [];
    var imagePrompt = shot.image_prompt;
    
    if (imagePrompt === undefined || imagePrompt === null) {
        warnings.push('image_prompt为空');
        return warnings;
    }
    
    if (typeof imagePrompt !== 'string') {
        warnings.push('image_prompt类型为' + typeof imagePrompt + '，应为string，已转换为字符串');
        shot.image_prompt = String(imagePrompt);
    } else {
        // 字符串内容检查
        if (imagePrompt.indexOf('[object Object]') >= 0) {
            warnings.push('image_prompt包含[object Object]，visual_prompt被错误拼接');
        }
        
        if (imagePrompt.indexOf('[object') >= 0) {
            warnings.push('image_prompt包含异常对象字符串');
        }
        
        if (imagePrompt.length === 0) {
            warnings.push('image_prompt为空字符串');
        }
    }
    
    return warnings;
}

/**
 * 导出校验函数供ai-service.js调用
 */
module.exports = validateStoryboard;
