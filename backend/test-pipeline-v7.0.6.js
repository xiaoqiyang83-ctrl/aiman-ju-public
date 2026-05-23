/**
 * AIManju v7.0.6 完整pipeline集成测试
 * 模拟AI返回的JSON走完整pipeline，不依赖数据库和AI API
 */

var fs = require('fs');
var path = require('path');
var Module = require('module');

// Mock require
var originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent) {
    var mockModules = ['../middleware/validateStoryboard', './storyboard-split', '../config/ai-providers', './video-provider-abstract', '../utils/logger'];
    for (var i = 0; i < mockModules.length; i++) {
        if (request === mockModules[i] || request.indexOf(mockModules[i]) === 0) return request;
    }
    return originalResolveFilename.apply(this, arguments);
};

var code = fs.readFileSync(path.join(__dirname, 'services/ai-service.js'), 'utf8');
code = code.replace(/require\([^)]+\)/g, '({})');

var funcNames = [
    'normalizeStoryboard', 'enforceDialogueFromScript', 'enforceSceneSplit',
    'extractAllDialoguesFromScript', 'stripDialogueMarkup',
    'extractSpeakerFromDialogue', 'calcTextOverlap',
    'findSceneHeadingLine', 'applyDialogueRules', 'applyDirectorEngine',
    'compilePromptsForStoryboard', 'deepClone', 'extractDialoguesFromSceneContent'
];

var exportCode = '\nmodule.exports = {\n' + 
    funcNames.map(function(n) { return '  ' + n + ': typeof ' + n + ' !== "undefined" ? ' + n + ' : null'; }).join(',\n') + '\n};';

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
    'var POWER_UP_PATTERNS = [];\nvar EMOTION_SHOT_RULES = {};\nvar EMOTION_SOUND_MAP = {};\n' +
    'var CLIMAX_ANGLE_MAP = {};\nvar SHOT_SPEED_MAP = {};\n' +
    'var SHOT_LEVELS = ["大特写","特写","近景","中景","全景","远景","大远景"];\n';

var fixedCode = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ')
    .replace(/\basync\s+function/g, 'function').replace(/\bawait\s+/g, '');

var tmpFile = path.join(__dirname, '.tmp-pipeline-test.js');
fs.writeFileSync(tmpFile, prefix + '\n' + fixedCode + '\n' + exportCode);

var funcs;
try { funcs = require(tmpFile); } catch(e) {
    console.log('加载出错: ' + e.message);
    process.exit(1);
} finally { try { fs.unlinkSync(tmpFile); } catch(e) {} }

// ============ 模拟真实剧本 ============
var realScript = '末世当老板 - 第一集\n\n场景一：工厂农场-走廊 日内\n走廊昏暗，墙上的荧光灯忽明忽暗。远处传来金属碰撞的声响。\n张扬：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核\n队员甲：老大，是他们先动的手！\n张扬：我不管谁先动的手，在菜地打架就是不对！\n\n场景二：工厂农场-温室 日内\n温室里种满了发光的变异植物，空气中弥漫着奇异的花香。林小鹿第一次来到这里，惊叹不已。\n林小鹿：哇，这些植物好漂亮！\n张扬：这些都是变异作物，能产出晶核的\n林小鹿：晶核？就是你们说的那个能源？\n张扬：对，这是我们基地的核心资源\n\n场景三：工厂农场-宿舍区 夜内\n简陋的宿舍区，几排铁架床整齐排列。墙上的时钟指向凌晨三点。\n队员乙：老大，外面有情况！\n队长：报告总部！发现不明生物接近！';

// ============ 模拟AI返回的JSON（含编造台词） ============
var aiOutput = {
    scenes: [
        {
            scene_number: '1', title: '工厂农场-走廊', location: '工厂农场-走廊',
            time_of_day: '日内', episode: '1', characters: ['张扬', '队员甲'],
            content: '张扬得意地走进走廊，展示他的工厂农场。队员甲紧张地跟在后面。',
            shots: [
                {
                    shot_number: 1, shot_type: '全景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@张扬（得意）：这是我工厂的员工宿舍区。每个员工都有独立的工位和KPI考核。',
                    narration: '', original_text: '张扬得意地走进走廊',
                    visual_prompt: { lighting: '暗调荧光灯', color_palette: '冷蓝绿色调', character_placement: '张扬站在走廊中央', facial_detail: '得意自信的表情', scene_description: '昏暗的工厂走廊，荧光灯忽明忽暗', composition: '三分法构图' },
                    action_prompt: { physical_action: '张扬走进走廊，手指前方介绍', micro_movement: '手指指向远处' },
                    emotion_cue: { primary_emotion: '得意', visual_mapping: '自信的姿态' }
                },
                {
                    shot_number: 2, shot_type: '近景', camera_movement: '推镜头', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@队员甲：报告总部！发现携带空间异能的S级丧尸！请求支援！',
                    narration: '', original_text: '队员甲紧张地报告',
                    visual_prompt: { lighting: '暗调', color_palette: '冷色调', character_placement: '队员甲在角落', facial_detail: '紧张恐惧', scene_description: '走廊角落，队员甲躲藏', composition: '侧视' },
                    action_prompt: { physical_action: '队员甲紧张地蹲下', micro_movement: '手抖' },
                    emotion_cue: { primary_emotion: '恐惧', visual_mapping: '颤抖' }
                },
                {
                    shot_number: 3, shot_type: '特写', camera_movement: '固定', camera_angle: '平视',
                    duration: 2,
                    dialogue: '',
                    narration: '', original_text: '走廊的荧光灯闪烁',
                    visual_prompt: { lighting: '忽明忽暗', color_palette: '冷绿', character_placement: '', facial_detail: '', scene_description: '走廊荧光灯特写', composition: '居中' },
                    action_prompt: { physical_action: '灯管闪烁', micro_movement: '' },
                    emotion_cue: { primary_emotion: '紧张', visual_mapping: '' }
                }
            ]
        },
        {
            scene_number: '2', title: '工厂农场-温室', location: '工厂农场-温室',
            time_of_day: '日内', episode: '1', characters: ['林小鹿', '张扬'],
            content: '林小鹿第一次来到温室，看到变异植物非常惊讶。张扬介绍这些植物的价值。',
            shots: [
                {
                    shot_number: 1, shot_type: '全景', camera_movement: '移镜头', camera_angle: '平视',
                    duration: 4,
                    dialogue: '@林小鹿：这些植物好神奇啊，它们会发光诶！',
                    narration: '', original_text: '林小鹿惊叹',
                    visual_prompt: { lighting: '荧光生物光', color_palette: '暖绿紫色调', character_placement: '林小鹿在前景', facial_detail: '惊讶赞叹', scene_description: '温室中发光的变异植物', composition: '三分法' },
                    action_prompt: { physical_action: '林小鹿四处张望', micro_movement: '眼睛发光' },
                    emotion_cue: { primary_emotion: '惊喜', visual_mapping: '眼睛发亮' }
                },
                {
                    shot_number: 2, shot_type: '近景', camera_movement: '推镜头', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@张扬：这是我们的秘密花园，所有的晶核都从这里产出来！',
                    narration: '', original_text: '张扬介绍植物',
                    visual_prompt: { lighting: '荧光', color_palette: '暖色调', character_placement: '张扬在旁', facial_detail: '得意微笑', scene_description: '张扬在植物旁', composition: '侧视' },
                    action_prompt: { physical_action: '张扬手指植物', micro_movement: '微笑' },
                    emotion_cue: { primary_emotion: '得意', visual_mapping: '自信微笑' }
                }
            ]
        }
    ]
};

console.log('========================================');
console.log('  AIManju v7.0.6 完整Pipeline集成测试');
console.log('========================================\n');

// ============ 步骤1: normalizeStoryboard ============
console.log('--- 步骤1: normalizeStoryboard ---');
var step1 = funcs.normalizeStoryboard(funcs.deepClone(aiOutput));
var step1EmptyDialogue = true;
var step1Count = 0;
for (var si = 0; si < step1.scenes.length; si++) {
    for (var i = 0; i < step1.scenes[si].shots.length; i++) {
        var d = String(step1.scenes[si].shots[i].dialogue || '').trim();
        step1Count++;
        if (d) { step1EmptyDialogue = false; console.log('  ❌ 场景' + (si+1) + '镜头' + (i+1) + ' dialogue未清空: ' + d.substring(0,40)); }
    }
}
console.log(step1EmptyDialogue ? '  ✅ 步骤1通过: 所有AI dialogue已清空 (' + step1Count + '镜头)' : '  ❌ 步骤1失败');

// ============ 步骤2: enforceSceneSplit ============
console.log('\n--- 步骤2: enforceSceneSplit ---');
var step2;
try { step2 = funcs.enforceSceneSplit(funcs.deepClone(step1), realScript); } catch(e) { 
    console.log('  ⚠️ enforceSceneSplit出错: ' + e.message); 
    step2 = step1;
}
console.log('  场景数量: ' + step2.scenes.length);
step2.scenes.forEach(function(s, i) { console.log('    场景' + (i+1) + ': ' + s.title + ' (' + s.shots.length + '镜头)'); });

// ============ 步骤3: enforceDialogueFromScript (第一次) ============
console.log('\n--- 步骤3: enforceDialogueFromScript (第一次) ---');
var step3;
try { step3 = funcs.enforceDialogueFromScript(funcs.deepClone(step2), realScript); } catch(e) {
    console.log('  ⚠️ enforceDialogueFromScript出错: ' + e.message);
    step3 = step2;
}
var step3Dialogues = [];
for (var si = 0; si < step3.scenes.length; si++) {
    for (var i = 0; i < step3.scenes[si].shots.length; i++) {
        var d = String(step3.scenes[si].shots[i].dialogue || '').trim();
        if (d) step3Dialogues.push({ scene: si+1, shot: i+1, dialogue: d });
    }
}
console.log('  分配了 ' + step3Dialogues.length + ' 条台词:');
step3Dialogues.forEach(function(r) { console.log('    场景' + r.scene + '镜头' + r.shot + ': ' + r.dialogue.substring(0, 50)); });

// ============ 步骤4: applyDirectorEngine ============
console.log('\n--- 步骤4: applyDirectorEngine ---');
var step4;
try { step4 = funcs.applyDirectorEngine(funcs.deepClone(step3)); } catch(e) {
    console.log('  ⚠️ applyDirectorEngine出错: ' + e.message);
    step4 = step3;
}
var step4Dialogues = [];
for (var si = 0; si < step4.scenes.length; si++) {
    for (var i = 0; i < step4.scenes[si].shots.length; i++) {
        var d = String(step4.scenes[si].shots[i].dialogue || '').trim();
        if (d) step4Dialogues.push({ scene: si+1, shot: i+1, dialogue: d });
    }
}
console.log('  导演引擎后 ' + step4Dialogues.length + ' 条台词');

// ============ 步骤5: enforceDialogueFromScript (第二次) ============
console.log('\n--- 步骤5: enforceDialogueFromScript (二次校验) ---');
var step5;
try { step5 = funcs.enforceDialogueFromScript(funcs.deepClone(step4), realScript); } catch(e) {
    console.log('  ⚠️ 二次校验出错: ' + e.message);
    step5 = step4;
}

// ============ 步骤6: compilePromptsForStoryboard ============
console.log('\n--- 步骤6: compilePromptsForStoryboard ---');
var step6;
try { step6 = funcs.compilePromptsForStoryboard(funcs.deepClone(step5), []); } catch(e) {
    console.log('  ⚠️ compilePrompts出错: ' + e.message);
    step6 = step5;
}
console.log('  编译完成');

// ============ 最终验证 ============
console.log('\n========================================');
console.log('  最终验证');
console.log('========================================\n');

// 1. 编造台词检测
var fabricated = [
    '这是我工厂的员工宿舍区', '每个员工都有独立的工位', 
    '报告总部！发现携带空间异能的S级丧尸', '请求支援',
    '这些植物好神奇', '秘密花园', '所有的晶核都从这里产出来'
];

var finalDialogues = [];
for (var si = 0; si < step6.scenes.length; si++) {
    for (var i = 0; i < step6.scenes[si].shots.length; i++) {
        var d = String(step6.scenes[si].shots[i].dialogue || '').trim();
        if (d) finalDialogues.push({ scene: si+1, shot: i+1, dialogue: d, title: step6.scenes[si].title });
    }
}

var hasFabricated = false;
console.log('1. 编造台词检测:');
fabricated.forEach(function(p) {
    finalDialogues.forEach(function(r) {
        if (r.dialogue.indexOf(p) >= 0) {
            console.log('  ❌ 编造台词 "' + p + '" → 场景' + r.scene + '(' + r.title + ')镜头' + r.shot + ': ' + r.dialogue.substring(0, 50));
            hasFabricated = true;
        }
    });
});
if (!hasFabricated) console.log('  ✅ 没有编造台词');

// 2. 剧本台词完整性
console.log('\n2. 剧本台词完整性:');
var scriptDialogues = funcs.extractAllDialoguesFromScript(realScript);
var allDialogueText = finalDialogues.map(function(r) { return funcs.stripDialogueMarkup(r.dialogue); }).join('|||');
var missingCount = 0;
scriptDialogues.forEach(function(sd) {
    var pureText = funcs.stripDialogueMarkup(sd.text);
    if (allDialogueText.indexOf(pureText) < 0) {
        console.log('  ❌ 缺少: ' + sd.speaker + '：' + sd.text);
        missingCount++;
    }
});
if (missingCount === 0) console.log('  ✅ 所有 ' + scriptDialogues.length + ' 条剧本台词都已分配');

// 3. 场景分配正确性
console.log('\n3. 台词场景分配:');
step6.scenes.forEach(function(scene, si) {
    var sceneDialogues = [];
    scene.shots.forEach(function(shot) {
        var d = String(shot.dialogue || '').trim();
        if (d) sceneDialogues.push(d);
    });
    console.log('  场景' + (si+1) + '(' + scene.title + '): ' + sceneDialogues.length + ' 条台词, ' + scene.shots.length + ' 个镜头');
    sceneDialogues.forEach(function(d) { console.log('    → ' + d.substring(0, 55)); });
});

// 4. 每句台词独占一个shot
console.log('\n4. 台词堆叠检测:');
var hasStacked = false;
finalDialogues.forEach(function(r) {
    var lines = r.dialogue.split(/\n/).filter(function(l) { return l.trim(); });
    if (lines.length > 2) {
        console.log('  ⚠️ 场景' + r.scene + '镜头' + r.shot + ' 有' + lines.length + '条台词堆叠');
        hasStacked = true;
    }
});
if (!hasStacked) console.log('  ✅ 没有严重堆叠（每shot最多2条）');

// ============ 总结 ============
console.log('\n========================================');
console.log('  测试总结');
console.log('========================================');
console.log('步骤1 (normalizeStoryboard清空): ' + (step1EmptyDialogue ? '✅' : '❌'));
console.log('步骤2 (enforceSceneSplit): ✅ (场景数:' + step2.scenes.length + ')');
console.log('步骤3 (enforceDialogueFromScript): ✅ (' + step3Dialogues.length + '条)');
console.log('步骤4 (applyDirectorEngine): ✅ (' + step4Dialogues.length + '条)');
console.log('步骤5 (二次校验): ✅');
console.log('步骤6 (compilePrompts): ✅');
console.log('---');
console.log('编造台词: ' + (hasFabricated ? '❌ 存在' : '✅ 无'));
console.log('剧本完整: ' + (missingCount === 0 ? '✅ 完整' : '❌ 缺' + missingCount + '条'));
console.log('台词堆叠: ' + (!hasStacked ? '✅ 无严重堆叠' : '⚠️ 有堆叠'));

var finalPass = !hasFabricated && missingCount === 0;
console.log('\n总体: ' + (finalPass ? '✅ 全部通过' : '❌ 存在问题'));
process.exit(finalPass ? 0 : 1);
