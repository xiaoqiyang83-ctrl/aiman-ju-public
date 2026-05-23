/**
 * AIManju v7.0.6 台词系统纯函数测试
 */

var fs = require('fs');
var path = require('path');
var Module = require('module');

// Mock所有require的模块
var originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent) {
    var mockModules = [
        '../middleware/validateStoryboard',
        './storyboard-split',
        '../config/ai-providers',
        './video-provider-abstract',
        '../utils/logger'
    ];
    for (var i = 0; i < mockModules.length; i++) {
        if (request === mockModules[i] || request.indexOf(mockModules[i]) === 0) {
            return request; // 返回假路径，让后续处理
        }
    }
    return originalResolveFilename.apply(this, arguments);
};

var code = fs.readFileSync(path.join(__dirname, 'services/ai-service.js'), 'utf8');

// 去掉require调用
code = code.replace(/require\([^)]+\)/g, '({})');

var funcNames = [
    'normalizeStoryboard', 'enforceDialogueFromScript', 
    'extractAllDialoguesFromScript', 'stripDialogueMarkup',
    'extractSpeakerFromDialogue', 'calcTextOverlap',
    'findSceneHeadingLine', 'applyDialogueRules',
    'deepClone', 'enforceSceneSplit',
    'extractDialoguesFromSceneContent'
];

var exportCode = '\nmodule.exports = {\n' + 
    funcNames.map(function(n) { return '  ' + n + ': typeof ' + n + ' !== "undefined" ? ' + n + ' : null'; }).join(',\n') + 
    '\n};';

var SHOT_TYPE_MAP = {
    '大特写': 'extreme close-up', '特写': 'close-up', '近景': 'medium close-up',
    '中景': 'medium shot', '全景': 'full shot', '远景': 'wide shot',
    '大远景': 'extreme wide shot'
};
var CAMERA_MOVEMENT_MAP = {
    '固定': 'static', '推镜头': 'push in', '拉镜头': 'pull out',
    '移镜头': 'tracking', '摇镜头': 'pan', '跟镜头': 'follow',
    '环绕': 'orbit', '快速推镜': 'fast push', '慢推': 'slow push', '慢拉': 'slow pull'
};

var prefix = 'var SHOT_TYPE_MAP = ' + JSON.stringify(SHOT_TYPE_MAP) + ';\n' +
    'var CAMERA_MOVEMENT_MAP = ' + JSON.stringify(CAMERA_MOVEMENT_MAP) + ';\n' +
    'var POWER_UP_PATTERNS = [];\n' +
    'var EMOTION_SHOT_RULES = {};\n' +
    'var EMOTION_SOUND_MAP = {};\n' +
    'var CLIMAX_ANGLE_MAP = {};\n' +
    'var SHOT_SPEED_MAP = {};\n' +
    'var SHOT_LEVELS = ["大特写","特写","近景","中景","全景","远景","大远景"];\n';

var fixedCode = code
    .replace(/\bconst\s+/g, 'var ')
    .replace(/\blet\s+/g, 'var ')
    .replace(/\basync\s+function/g, 'function')
    .replace(/\bawait\s+/g, '');

var tmpFile = path.join(__dirname, '.tmp-test-ai-service.js');
fs.writeFileSync(tmpFile, prefix + '\n' + fixedCode + '\n' + exportCode);

var funcs;
try {
    funcs = require(tmpFile);
} catch(e) {
    console.log('加载出错: ' + e.message);
    console.log((e.stack || '').split('\n').slice(0, 8).join('\n'));
    process.exit(1);
} finally {
    try { fs.unlinkSync(tmpFile); } catch(e) {}
}

console.log('\n=== 已加载函数列表 ===');
Object.keys(funcs).forEach(function(k) { 
    if (funcs[k]) console.log('  ✅ ' + k);
    else console.log('  ❌ ' + k + ' (未找到)');
});

// ============ 测试用剧本 ============
var testScript = '工厂农场-走廊 日内\n走廊昏暗，墙上的荧光灯忽明忽暗。\n张扬：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核\n队员甲：老大，是他们先动的手！\n张扬：我不管谁先动的手，在菜地打架就是不对！\n\n工厂农场-温室 日内\n温室里种满了发光的变异植物，空气中弥漫着奇异的花香。\n林小鹿：哇，这些植物好漂亮！\n张扬：这些都是变异作物，能产出晶核的\n林小鹿：晶核？就是你们说的那个能源？\n张扬：对，这是我们基地的核心资源\n\n工厂农场-宿舍区 夜内\n简陋的宿舍区，几排铁架床整齐排列。\n队员乙：老大，外面有情况！\n队长：报告总部！发现不明生物接近！';

// ============ 测试1 ============
console.log('\n=== 测试1: extractAllDialoguesFromScript ===');
var scriptDialogues = funcs.extractAllDialoguesFromScript(testScript);
console.log('提取到 ' + scriptDialogues.length + ' 条台词:');
scriptDialogues.forEach(function(d, i) {
    console.log('  [' + i + '] ' + d.speaker + '：' + d.text + ' (行号:' + d.lineIdx + ')');
});

var expectedDialogues = [
    { speaker: '张扬', text: '和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核' },
    { speaker: '队员甲', text: '老大，是他们先动的手！' },
    { speaker: '张扬', text: '我不管谁先动的手，在菜地打架就是不对！' },
    { speaker: '林小鹿', text: '哇，这些植物好漂亮！' },
    { speaker: '张扬', text: '这些都是变异作物，能产出晶核的' },
    { speaker: '林小鹿', text: '晶核？就是你们说的那个能源？' },
    { speaker: '张扬', text: '对，这是我们基地的核心资源' },
    { speaker: '队员乙', text: '老大，外面有情况！' },
    { speaker: '队长', text: '报告总部！发现不明生物接近！' }
];

var pass1 = scriptDialogues.length === expectedDialogues.length;
if (pass1) {
    for (var i = 0; i < expectedDialogues.length; i++) {
        if (scriptDialogues[i].speaker !== expectedDialogues[i].speaker || scriptDialogues[i].text !== expectedDialogues[i].text) {
            console.log('  ❌ 台词' + (i+1) + '不匹配: 期望"' + expectedDialogues[i].speaker + '：' + expectedDialogues[i].text + '" 实际"' + scriptDialogues[i].speaker + '：' + scriptDialogues[i].text + '"');
            pass1 = false;
        }
    }
}
console.log(pass1 ? '  ✅ 测试1通过' : '  ❌ 测试1失败');

// ============ 测试2 ============
console.log('\n=== 测试2: normalizeStoryboard清空所有AI返回的dialogue ===');
var fakeAiOutput = {
    scenes: [
        {
            scene_number: '1', title: '工厂农场-走廊', location: '工厂农场-走廊',
            time_of_day: '日内', episode: '1', characters: ['张扬', '队员甲'],
            content: '张扬得意地走进走廊，说这是我工厂的员工宿舍区。',
            shots: [
                {
                    shot_number: 1, shot_type: '全景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3, dialogue: '@张扬（得意）：这是我工厂的员工宿舍区。每个员工都有独立的工位和KPI考核。',
                    narration: '', original_text: '张扬得意地走进走廊',
                    visual_prompt: { lighting: '暗调', color_palette: '冷色调', character_placement: '张扬在中间', facial_detail: '得意表情', scene_description: '走廊场景', composition: '居中' },
                    action_prompt: { physical_action: '走进走廊', micro_movement: '' },
                    emotion_cue: { primary_emotion: '得意', visual_mapping: '' }
                },
                {
                    shot_number: 2, shot_type: '近景', camera_movement: '推镜头', camera_angle: '平视',
                    duration: 3, dialogue: '@队员甲：老大，我们只是玩玩！',
                    narration: '', original_text: '队员甲辩解',
                    visual_prompt: { lighting: '暗调', color_palette: '冷色调', character_placement: '队员甲在旁边', facial_detail: '紧张', scene_description: '走廊场景', composition: '侧视' },
                    action_prompt: { physical_action: '辩解', micro_movement: '' },
                    emotion_cue: { primary_emotion: '紧张', visual_mapping: '' }
                }
            ]
        },
        {
            scene_number: '2', title: '工厂农场-温室', location: '工厂农场-温室',
            time_of_day: '日内', episode: '1', characters: ['林小鹿', '张扬'],
            content: '林小鹿看到变异植物很惊讶。',
            shots: [
                {
                    shot_number: 1, shot_type: '中景', camera_movement: '移镜头', camera_angle: '平视',
                    duration: 3, dialogue: '@林小鹿：这些植物好神奇！',
                    narration: '', original_text: '林小鹿观察植物',
                    visual_prompt: { lighting: '荧光', color_palette: '暖色调', character_placement: '林小鹿在前', facial_detail: '惊讶', scene_description: '温室场景', composition: '居中' },
                    action_prompt: { physical_action: '观察植物', micro_movement: '' },
                    emotion_cue: { primary_emotion: '惊讶', visual_mapping: '' }
                },
                {
                    shot_number: 2, shot_type: '近景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3, dialogue: '@张扬：这是我们的秘密花园！',
                    narration: '', original_text: '张扬介绍',
                    visual_prompt: { lighting: '荧光', color_palette: '暖色调', character_placement: '张扬在旁', facial_detail: '得意', scene_description: '温室场景', composition: '侧视' },
                    action_prompt: { physical_action: '介绍', micro_movement: '' },
                    emotion_cue: { primary_emotion: '得意', visual_mapping: '' }
                }
            ]
        }
    ]
};

var normalized = funcs.normalizeStoryboard(funcs.deepClone(fakeAiOutput));
var allDialogueEmpty = true;
var dialogueCount = 0;
for (var si = 0; si < normalized.scenes.length; si++) {
    for (var i = 0; i < normalized.scenes[si].shots.length; i++) {
        var d = String(normalized.scenes[si].shots[i].dialogue || '').trim();
        if (d) {
            allDialogueEmpty = false;
            console.log('  ❌ 场景' + (si+1) + '镜头' + (i+1) + ' dialogue未清空: ' + d.substring(0, 50));
        }
        dialogueCount++;
    }
}
console.log('  检查了 ' + dialogueCount + ' 个镜头');
console.log(allDialogueEmpty ? '  ✅ 测试2通过：所有AI dialogue已清空' : '  ❌ 测试2失败');

// ============ 测试3 ============
console.log('\n=== 测试3: enforceDialogueFromScript从剧本分配台词 ===');
var enforced = funcs.enforceDialogueFromScript(funcs.deepClone(normalized), testScript);

var dialogueResults = [];
for (var si = 0; si < enforced.scenes.length; si++) {
    for (var i = 0; i < enforced.scenes[si].shots.length; i++) {
        var d = String(enforced.scenes[si].shots[i].dialogue || '').trim();
        if (d) {
            dialogueResults.push({ scene: si, shot: i, dialogue: d });
        }
    }
}
console.log('  分配了 ' + dialogueResults.length + ' 条台词:');
dialogueResults.forEach(function(r) {
    console.log('    场景' + (r.scene+1) + '镜头' + (r.shot+1) + ': ' + r.dialogue.substring(0, 60));
});

var pass3 = true;
dialogueResults.forEach(function(r) {
    var pureText = funcs.stripDialogueMarkup(r.dialogue);
    var found = false;
    for (var di = 0; di < scriptDialogues.length; di++) {
        if (funcs.stripDialogueMarkup(scriptDialogues[di].text) === pureText) {
            found = true;
            break;
        }
    }
    if (!found) {
        console.log('  ❌ 编造台词: 场景' + (r.scene+1) + '镜头' + (r.shot+1) + ' → ' + r.dialogue);
        pass3 = false;
    }
});
console.log(pass3 ? '  ✅ 测试3通过：所有台词都来自剧本原文' : '  ❌ 测试3失败');

// ============ 测试4 ============
console.log('\n=== 测试4: 编造台词检测 ===');
var fabricatedPatterns = [
    '这是我工厂的员工宿舍区',
    '每个员工都有独立的工位',
    '我们只是玩玩',
    '这些植物好神奇',
    '秘密花园',
    '报告总部！发现携带空间异能的S级丧尸',
    '请求支援'
];
var pass4 = true;
dialogueResults.forEach(function(r) {
    fabricatedPatterns.forEach(function(pattern) {
        if (r.dialogue.indexOf(pattern) >= 0) {
            console.log('  ❌ 发现编造台词 "' + pattern + '" 在: ' + r.dialogue);
            pass4 = false;
        }
    });
});
console.log(pass4 ? '  ✅ 测试4通过：没有编造台词' : '  ❌ 测试4失败');

// ============ 测试5 ============
console.log('\n=== 测试5: 剧本台词完整性 ===');
var allDialogueText = dialogueResults.map(function(r) { return funcs.stripDialogueMarkup(r.dialogue); }).join('|||');
var pass5 = true;
var missingCount = 0;
expectedDialogues.forEach(function(ed) {
    if (allDialogueText.indexOf(funcs.stripDialogueMarkup(ed.text)) < 0) {
        console.log('  ❌ 缺少台词: ' + ed.speaker + '：' + ed.text);
        pass5 = false;
        missingCount++;
    }
});
if (pass5) {
    console.log('  ✅ 测试5通过：所有 ' + expectedDialogues.length + ' 条剧本台词都已分配');
} else {
    console.log('  ❌ 测试5失败：缺少 ' + missingCount + ' 条台词');
}

// ============ 测试6: 台词场景分配正确性 ============
console.log('\n=== 测试6: 台词场景分配正确性 ===');
// 走廊场景应该有走廊的台词，不应该有温室的台词
var pass6 = true;
var scene1Dialogues = [];
var scene2Dialogues = [];
for (var i = 0; i < enforced.scenes[0].shots.length; i++) {
    var d = String(enforced.scenes[0].shots[i].dialogue || '').trim();
    if (d) scene1Dialogues.push(d);
}
for (var i = 0; i < enforced.scenes[1].shots.length; i++) {
    var d = String(enforced.scenes[1].shots[i].dialogue || '').trim();
    if (d) scene2Dialogues.push(d);
}

console.log('  场景1(走廊)台词: ' + scene1Dialogues.length + ' 条');
console.log('  场景2(温室)台词: ' + scene2Dialogues.length + ' 条');

// 场景1应该有张扬和队员甲的台词，不应该有林小鹿的台词
scene1Dialogues.forEach(function(d) {
    if (d.indexOf('林小鹿') >= 0) {
        console.log('  ❌ 走廊场景中有林小鹿的台词（应该在温室场景）: ' + d);
        pass6 = false;
    }
    if (d.indexOf('变异作物') >= 0 || d.indexOf('晶核') >= 0) {
        console.log('  ⚠️ 走廊场景中有温室相关台词: ' + d);
    }
});

// 场景2不应该有走廊的台词（队员甲的台词）
scene2Dialogues.forEach(function(d) {
    if (d.indexOf('队员甲') >= 0) {
        console.log('  ❌ 温室场景中有队员甲的台词（应该在走廊场景）: ' + d);
        pass6 = false;
    }
});
console.log(pass6 ? '  ✅ 测试6通过' : '  ❌ 测试6失败');

// ============ 总结 ============
console.log('\n============================');
console.log('测试1 (extractAllDialoguesFromScript): ' + (pass1 ? '✅' : '❌'));
console.log('测试2 (normalizeStoryboard清空dialogue): ' + (allDialogueEmpty ? '✅' : '❌'));
console.log('测试3 (enforceDialogueFromScript分配台词): ' + (pass3 ? '✅' : '❌'));
console.log('测试4 (编造台词检测): ' + (pass4 ? '✅' : '❌'));
console.log('测试5 (剧本台词完整性): ' + (pass5 ? '✅' : '❌'));
console.log('测试6 (台词场景分配正确性): ' + (pass6 ? '✅' : '❌'));
var allPass = pass1 && allDialogueEmpty && pass3 && pass4 && pass5 && pass6;
console.log('\n总体结果: ' + (allPass ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(allPass ? 0 : 1);

// ============ 补充测试7: 完整3场景测试 ============
console.log('\n=== 测试7: 完整3场景+场景拆分 ===');
var fakeAiOutput3 = {
    scenes: [
        {
            scene_number: '1', title: '工厂农场-走廊', location: '工厂农场-走廊',
            time_of_day: '日内', episode: '1', characters: ['张扬', '队员甲'],
            content: '张扬得意地走进走廊',
            shots: [
                {
                    shot_number: 1, shot_type: '全景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3, dialogue: '@张扬（得意）：这是我工厂的员工宿舍区。每个员工都有独立的工位和KPI考核。',
                    narration: '', original_text: '张扬得意地走进走廊',
                    visual_prompt: { lighting: '暗调', color_palette: '冷色调', character_placement: '张扬在中间', facial_detail: '得意表情', scene_description: '走廊场景', composition: '居中' },
                    action_prompt: { physical_action: '走进走廊', micro_movement: '' },
                    emotion_cue: { primary_emotion: '得意', visual_mapping: '' }
                },
                {
                    shot_number: 2, shot_type: '近景', camera_movement: '推镜头', camera_angle: '平视',
                    duration: 3, dialogue: '@队员甲：报告总部！发现携带空间异能的S级丧尸！请求支援！',
                    narration: '', original_text: '队员甲紧张',
                    visual_prompt: { lighting: '暗调', color_palette: '冷色调', character_placement: '队员甲在旁边', facial_detail: '紧张', scene_description: '走廊场景', composition: '侧视' },
                    action_prompt: { physical_action: '紧张', micro_movement: '' },
                    emotion_cue: { primary_emotion: '紧张', visual_mapping: '' }
                }
            ]
        },
        {
            scene_number: '2', title: '工厂农场-温室', location: '工厂农场-温室',
            time_of_day: '日内', episode: '1', characters: ['林小鹿', '张扬'],
            content: '林小鹿看到变异植物很惊讶',
            shots: [
                {
                    shot_number: 1, shot_type: '中景', camera_movement: '移镜头', camera_angle: '平视',
                    duration: 3, dialogue: '@林小鹿：这些植物好神奇！',
                    narration: '', original_text: '林小鹿观察植物',
                    visual_prompt: { lighting: '荧光', color_palette: '暖色调', character_placement: '林小鹿在前', facial_detail: '惊讶', scene_description: '温室场景', composition: '居中' },
                    action_prompt: { physical_action: '观察植物', micro_movement: '' },
                    emotion_cue: { primary_emotion: '惊讶', visual_mapping: '' }
                }
            ]
        },
        {
            scene_number: '3', title: '工厂农场-宿舍区', location: '工厂农场-宿舍区',
            time_of_day: '夜内', episode: '1', characters: ['队员乙', '队长'],
            content: '简陋的宿舍区',
            shots: [
                {
                    shot_number: 1, shot_type: '全景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3, dialogue: '@队长：报告总部！发现携带空间异能的S级丧尸！请求支援！',
                    narration: '', original_text: '队长报告',
                    visual_prompt: { lighting: '暗调', color_palette: '冷色调', character_placement: '队长在中间', facial_detail: '紧张', scene_description: '宿舍区场景', composition: '居中' },
                    action_prompt: { physical_action: '报告', micro_movement: '' },
                    emotion_cue: { primary_emotion: '紧张', visual_mapping: '' }
                }
            ]
        }
    ]
};

var normalized3 = funcs.normalizeStoryboard(funcs.deepClone(fakeAiOutput3));
var enforced3 = funcs.enforceDialogueFromScript(funcs.deepClone(normalized3), testScript);

console.log('  分配结果:');
var pass7 = true;
for (var si = 0; si < enforced3.scenes.length; si++) {
    var scene = enforced3.scenes[si];
    console.log('  场景' + (si+1) + ': ' + scene.title);
    for (var i = 0; i < scene.shots.length; i++) {
        var d = String(scene.shots[i].dialogue || '').trim();
        console.log('    镜头' + (i+1) + ': ' + (d || '(空)'));
        // 检查是否有编造台词
        var fabricatedPatterns7 = ['这是我工厂的员工宿舍区', '每个员工都有独立的工位', '这些植物好神奇', '秘密花园', '发现携带空间异能的S级丧尸', '请求支援'];
        fabricatedPatterns7.forEach(function(p) {
            if (d.indexOf(p) >= 0) {
                console.log('    ❌ 编造台词: ' + p);
                pass7 = false;
            }
        });
    }
}

// 验证宿舍区台词在宿舍区场景
var scene3Dialogues = [];
for (var i = 0; i < enforced3.scenes[2].shots.length; i++) {
    var d = String(enforced3.scenes[2].shots[i].dialogue || '').trim();
    if (d) scene3Dialogues.push(d);
}
var hasDormitoryDialogue = scene3Dialogues.some(function(d) { return d.indexOf('队员乙') >= 0 || d.indexOf('队长') >= 0; });
if (!hasDormitoryDialogue) {
    console.log('  ⚠️ 宿舍区场景中没有宿舍区台词（可能行号匹配问题）');
}
console.log(pass7 ? '  ✅ 测试7通过' : '  ❌ 测试7失败');
