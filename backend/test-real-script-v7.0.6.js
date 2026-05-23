/**
 * AIManju v7.0.6 用真实剧本测试
 */
var fs = require('fs');
var path = require('path');
var Module = require('module');

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
    'compilePromptsForStoryboard', 'deepClone'
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

var tmpFile = path.join(__dirname, '.tmp-real-test.js');
fs.writeFileSync(tmpFile, prefix + '\n' + fixedCode + '\n' + exportCode);

var funcs;
try { funcs = require(tmpFile); } catch(e) {
    console.log('加载出错: ' + e.message); process.exit(1);
} finally { try { fs.unlinkSync(tmpFile); } catch(e) {} }

// ============ 真实剧本（第2集）============
var realScript = '2-1 日 内 工厂农场 - 温室\n\n人物：队长，队员甲，队员乙，S级丧尸\n\n△S级丧尸（阿空）瞬间出手，队长一行人释放异能抵挡。\n\n队长（绝望）：携带空间异能的S级丧尸一起出手！\n\n队员甲：我们的攻击竟然对他毫无作用！这就是S级丧尸的威力吗？！\n\n△S级丧尸（阿空）抬手准备发动致命一击。\n\n阿空：现在该我了！\n\n△S级丧尸（阿空）的攻击被无形的力量挡下，它困惑地停住。\n\n队员甲/乙（惊愕）：啊！队长\n\n张扬：阿空！\n\n△张扬从温室里走出来，一脸不悦。\n\n张扬：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核的奖金！\n\n△S级丧尸（阿空）委屈地低下头。并跟其他人鞠躬。\n\n张扬：行了行了，继续干活！\n\n△S级丧尸（阿空）转身默默回到田里干活。\n\n队长（震惊）：你……你你你到底是什么人？为什么这些丧尸会听你的话？还是S级丧尸！\n\n队长 OS：B级丧尸需要3人小队才能对付，A级丧尸足以攻略7人小队。他竟然能驱使拥有异能的S级丧尸，这家伙是什么怪物？！\n\n张扬（轻哼一声）：哼，美女你这话说的，我雇佣丧尸打工赚的晶核，这也不犯法吧？\n\n队长（难以置信）：雇佣S级丧尸！打工？赚晶核？……\n\n△张扬随手从藤上摘下一个鲜红的番茄，递给队长。\n\n张扬（哈哈一笑）：哈哈！尝尝我们厂的明星产品，丧尸劳模荣誉出品，纯天然无污染。\n\n张扬：番茄，咬一口，回味末日前的味道。';

// ============ 模拟AI返回的JSON（含编造台词，模拟截图中的情况）============
var aiOutput = {
    scenes: [
        {
            scene_number: '1', title: '工厂农场-走廊', location: '工厂农场-走廊',
            time_of_day: '日内', episode: '2', characters: ['张扬', '队长'],
            content: '张扬带着目瞪口呆的队长穿过走廊，介绍他的工厂',
            shots: [
                {
                    shot_number: 1, shot_type: '中远景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@张扬：这是我工厂的员工宿舍区，每个员工都有独立的工位和KPI考核',
                    narration: '', original_text: '张扬介绍工厂',
                    visual_prompt: { lighting: '自然光', color_palette: '#B0BEC5', character_placement: '@张扬带着目瞪口呆的队长穿过走廊', facial_detail: '得意', scene_description: '工厂走廊', composition: '三分法构图' },
                    action_prompt: { physical_action: '张扬带着队长走', micro_movement: '' },
                    emotion_cue: { primary_emotion: '得意', visual_mapping: '' }
                },
                {
                    shot_number: 2, shot_type: '中远景', camera_movement: '推镜头', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@队长：这...这太疯狂了...',
                    narration: '', original_text: '队长震惊',
                    visual_prompt: { lighting: '自然光', color_palette: '#F9E79F', character_placement: '@张扬带着目瞪口呆的队长穿过走廊', facial_detail: '震惊', scene_description: '工厂走廊', composition: '对角线构图' },
                    action_prompt: { physical_action: '队长震惊', micro_movement: '' },
                    emotion_cue: { primary_emotion: '震惊', visual_mapping: '' }
                },
                {
                    shot_number: 3, shot_type: '全景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@张扬：疯狂？这是管理，丧尸不用发工资，不用交社保',
                    narration: '', original_text: '张扬继续介绍',
                    visual_prompt: { lighting: '自然光', color_palette: '#D5F5E3', character_placement: '@张扬带着目瞪口呆的队长穿过走廊', facial_detail: '无所谓', scene_description: '工厂走廊全景', composition: '对称构图' },
                    action_prompt: { physical_action: '张扬摆手', micro_movement: '' },
                    emotion_cue: { primary_emotion: '装逼', visual_mapping: '' }
                }
            ]
        },
        {
            scene_number: '2', title: '工厂农场-温室', location: '工厂农场-温室',
            time_of_day: '日内', episode: '2', characters: ['队长', '队员甲', '张扬', '阿空'],
            content: 'S级丧尸出手攻击，张扬从温室走出来制止',
            shots: [
                {
                    shot_number: 1, shot_type: '全景', camera_movement: '移镜头', camera_angle: '平视',
                    duration: 4,
                    dialogue: '@队长：报告总部！发现携带空间异能的S级丧尸！请求支援！',
                    narration: '', original_text: '队长绝望地喊',
                    visual_prompt: { lighting: '荧光', color_palette: '暖绿紫色调', character_placement: '队长在前方', facial_detail: '绝望', scene_description: '温室战斗', composition: '三分法' },
                    action_prompt: { physical_action: '队长释放异能', micro_movement: '' },
                    emotion_cue: { primary_emotion: '绝望', visual_mapping: '' }
                },
                {
                    shot_number: 2, shot_type: '特写', camera_movement: '推镜头', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@队员甲：这就是S级丧尸的威力吗？！',
                    narration: '', original_text: '队员甲恐惧',
                    visual_prompt: { lighting: '荧光', color_palette: '冷色调', character_placement: '队员甲在旁', facial_detail: '恐惧', scene_description: '温室战斗', composition: '居中' },
                    action_prompt: { physical_action: '队员甲后退', micro_movement: '' },
                    emotion_cue: { primary_emotion: '恐惧', visual_mapping: '' }
                },
                {
                    shot_number: 3, shot_type: '近景', camera_movement: '固定', camera_angle: '平视',
                    duration: 3,
                    dialogue: '@阿空：现在轮到我了！你们都得死！',
                    narration: '', original_text: '阿空发动攻击',
                    visual_prompt: { lighting: '荧光', color_palette: '暗红', character_placement: '阿空在中央', facial_detail: '凶狠', scene_description: '温室', composition: '居中' },
                    action_prompt: { physical_action: '阿空抬手攻击', micro_movement: '' },
                    emotion_cue: { primary_emotion: '凶狠', visual_mapping: '' }
                }
            ]
        }
    ]
};

console.log('========================================');
console.log('  真实剧本测试 - 第2集');
console.log('========================================\n');

// 步骤1: 提取剧本台词
console.log('--- 步骤0: 提取剧本台词 ---');
var scriptDialogues = funcs.extractAllDialoguesFromScript(realScript);
console.log('从真实剧本提取到 ' + scriptDialogues.length + ' 条台词:');
scriptDialogues.forEach(function(d, i) {
    console.log('  [' + i + '] ' + d.speaker + '：' + d.text);
});

// 步骤2: normalizeStoryboard
console.log('\n--- 步骤1: normalizeStoryboard ---');
var step1 = funcs.normalizeStoryboard(funcs.deepClone(aiOutput));

// 步骤3: enforceSceneSplit
console.log('\n--- 步骤2: enforceSceneSplit ---');
var step2;
try { step2 = funcs.enforceSceneSplit(funcs.deepClone(step1), realScript); } catch(e) {
    console.log('  ⚠️ 出错: ' + e.message); step2 = step1;
}
console.log('  场景数: ' + step2.scenes.length);
step2.scenes.forEach(function(s, i) { console.log('    场景' + (i+1) + ': ' + s.title + ' (' + s.shots.length + '镜头)'); });

// 步骤4: enforceDialogueFromScript
console.log('\n--- 步骤3: enforceDialogueFromScript ---');
var step3;
try { step3 = funcs.enforceDialogueFromScript(funcs.deepClone(step2), realScript); } catch(e) {
    console.log('  ⚠️ 出错: ' + e.message); step3 = step2;
}

// 步骤5: applyDirectorEngine
console.log('\n--- 步骤4: applyDirectorEngine ---');
var step4;
try { step4 = funcs.applyDirectorEngine(funcs.deepClone(step3)); } catch(e) {
    console.log('  ⚠️ 出错: ' + e.message); step4 = step3;
}

// 步骤6: 二次校验
console.log('\n--- 步骤5: 二次enforceDialogueFromScript ---');
var step5;
try { step5 = funcs.enforceDialogueFromScript(funcs.deepClone(step4), realScript); } catch(e) {
    console.log('  ⚠️ 出错: ' + e.message); step5 = step4;
}

// ============ 验证 ============
console.log('\n========================================');
console.log('  最终验证');
console.log('========================================\n');

// 收集所有最终台词
var finalDialogues = [];
for (var si = 0; si < step5.scenes.length; si++) {
    for (var i = 0; i < step5.scenes[si].shots.length; i++) {
        var d = String(step5.scenes[si].shots[i].dialogue || '').trim();
        if (d) finalDialogues.push({ scene: si+1, shot: i+1, dialogue: d, title: step5.scenes[si].title });
    }
}

// 1. 编造台词检测
console.log('1. 编造台词检测（截图中的编造台词）:');
var fabricatedPatterns = [
    '这是我工厂的员工宿舍区',
    '每个员工都有独立的工位',
    '这...这太疯狂了',
    '疯狂？这是管理',
    '丧尸不用发工资',
    '不用交社保',
    '报告总部！发现携带空间异能的S级丧尸！请求支援',
    '现在轮到我了！你们都得死',
];
var hasFabricated = false;
fabricatedPatterns.forEach(function(p) {
    finalDialogues.forEach(function(r) {
        if (r.dialogue.indexOf(p) >= 0) {
            console.log('  ❌ 编造: "' + p + '" → 场景' + r.scene + '(' + r.title + ')镜头' + r.shot + ': ' + r.dialogue.substring(0,50));
            hasFabricated = true;
        }
    });
});
if (!hasFabricated) console.log('  ✅ 没有编造台词');

// 2. 剧本台词完整性
console.log('\n2. 剧本台词完整性:');
var allDialogueText = finalDialogues.map(function(r) { return funcs.stripDialogueMarkup(r.dialogue); }).join('|||');
var missingCount = 0;
var missingList = [];
scriptDialogues.forEach(function(sd) {
    var pureText = funcs.stripDialogueMarkup(sd.text);
    if (allDialogueText.indexOf(pureText) < 0) {
        // 宽松检查：重合度
        var found = false;
        for (var fi = 0; fi < finalDialogues.length; fi++) {
            if (funcs.calcTextOverlap(pureText, funcs.stripDialogueMarkup(finalDialogues[fi].dialogue)) >= 0.5) {
                found = true; break;
            }
        }
        if (!found) {
            console.log('  ❌ 缺少: ' + sd.speaker + '：' + sd.text);
            missingCount++;
            missingList.push(sd);
        }
    }
});
if (missingCount === 0) console.log('  ✅ 所有 ' + scriptDialogues.length + ' 条剧本台词都已分配');

// 3. 显示每条最终台词
console.log('\n3. 最终台词列表:');
finalDialogues.forEach(function(r) {
    console.log('  场景' + r.scene + '(' + r.title + ')镜头' + r.shot + ': ' + r.dialogue);
});

// 总结
console.log('\n========================================');
console.log('编造台词: ' + (hasFabricated ? '❌ 存在' : '✅ 无'));
console.log('剧本完整: ' + (missingCount === 0 ? '✅ 完整(' + scriptDialogues.length + '条)' : '❌ 缺' + missingCount + '条'));
var finalPass = !hasFabricated && missingCount === 0;
console.log('\n总体: ' + (finalPass ? '✅ 通过' : '❌ 有问题'));
process.exit(finalPass ? 0 : 1);
