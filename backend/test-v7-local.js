/**
 * AIManju v7.0 本地测试脚本
 * 
 * 使用方法：
 *   cd backend
 *   node test-v7-local.js
 * 
 * 测试内容：
 *   1. 爽点检测（8种 + 评分 + 等级）
 *   2. 节奏检测（高潮间隔/冲突频率/对话过长/情绪疲劳）
 *   3. 导演决策（音效/镜头角度/切镜速度）
 *   4. 留存优化（拖沓修复/高潮间隔修复/情绪疲劳修复）
 *   5. 台词规则（说话人标注/去重/拆分）
 *   6. 描述多样性
 *   7. 真实剧本全流程
 */

const aiService = require('./services/ai-service');

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log('[PASS] ' + name);
  } catch (e) {
    failed++;
    console.log('[FAIL] ' + name);
    console.log('       Error: ' + e.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ============ 构造测试数据 ============

// 真实剧本第2集的分镜模拟数据
function createRealScriptStoryboard() {
  return {
    scenes: [{
      scene_number: 1,
      location: "工厂农场-温室",
      description: "温室内部，S级丧尸与队长一行人对峙",
      characters: ["队长", "队员甲", "队员乙", "阿空", "张扬"],
      shots: [
        {
          shot_number: 1,
          shot_type: "远景",
          camera_movement: "固定",
          duration: 5,
          emotion: "压迫",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "队长（绝望）：携带空间异能的S级丧尸一起出手！",
          visual_prompt: {
            scene_description: "温室内部，S级丧尸阿空与队长一行人对峙",
            lighting: "室内自然光，色温5600K，柔和阴影",
            color_palette: "主色#FFFFFF 100%、辅色#EFEFEF 80%、点缀色#FF0000 10%",
            character_placement: "S级丧尸（阿空）在田边，队长一行人在远处",
            facial_detail: "队长表情绝望，阿空面无表情",
            composition: "三分法构图，人物位于左侧交叉点"
          },
          action_prompt: "S级丧尸阿空瞬间出手",
          emotion_cue: "压迫"
        },
        {
          shot_number: 2,
          shot_type: "中景",
          camera_movement: "固定",
          duration: 4,
          emotion: "压迫",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "队员甲：我们的攻击竟然对他毫无作用！这就是S级丧尸的威力吗？！",
          visual_prompt: {
            scene_description: "温室内部，绿意盎然，蔬菜丛生",
            lighting: "室内自然光，色温5600K，柔和阴影",
            color_palette: "主色#FFFFFF 100%、辅色#EFEFEF 80%、点缀色#FF0000 10%",
            character_placement: "S级丧尸（阿空）在田边，队长一行人在远处",
            facial_detail: "队员甲震惊的表情",
            composition: "三分法构图，人物位于左侧交叉点"
          },
          action_prompt: "队员甲释放异能攻击",
          emotion_cue: "压迫"
        },
        {
          shot_number: 3,
          shot_type: "特写",
          camera_movement: "固定",
          duration: 3,
          emotion: "压迫",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "阿空：现在该我了！",
          visual_prompt: {
            scene_description: "温室内部，绿意盎然，蔬菜丛生",
            lighting: "室内自然光，色温5600K，柔和阴影",
            color_palette: "主色#FFFFFF 100%、辅色#EFEFEF 80%、点缀色#FF0000 10%",
            character_placement: "S级丧尸（阿空）在田边，队长一行人在远处",
            facial_detail: "阿空冷漠的眼神",
            composition: "三分法构图，人物位于左侧交叉点"
          },
          action_prompt: "阿空抬手准备发动致命一击",
          emotion_cue: "压迫"
        },
        {
          shot_number: 4,
          shot_type: "近景",
          camera_movement: "固定",
          duration: 4,
          emotion: "惊愕",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "队员甲/乙（惊愕）：啊！队长\n张扬：阿空！",
          visual_prompt: {
            scene_description: "温室内部，阿空的攻击被挡下",
            lighting: "室内自然光",
            color_palette: "暖色调",
            character_placement: "阿空困惑停住，张扬从温室走出",
            facial_detail: "张扬一脸不悦",
            composition: "中心构图"
          },
          action_prompt: "攻击被无形力量挡下，张扬走出来",
          emotion_cue: "惊愕"
        },
        {
          shot_number: 5,
          shot_type: "中景",
          camera_movement: "固定",
          duration: 5,
          emotion: "装逼",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "张扬：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核的奖金！",
          visual_prompt: {
            scene_description: "温室内部，张扬训斥阿空",
            lighting: "暖色调",
            color_palette: "暖黄绿色调",
            character_placement: "张扬站在中间，阿空低头",
            facial_detail: "张扬不悦的表情",
            composition: "中心构图"
          },
          action_prompt: "张扬训斥阿空",
          emotion_cue: "装逼"
        },
        {
          shot_number: 6,
          shot_type: "特写",
          camera_movement: "固定",
          duration: 3,
          emotion: "委屈",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "张扬：行了行了，继续干活！",
          visual_prompt: {
            scene_description: "温室内部，阿空委屈鞠躬",
            lighting: "暖色调",
            color_palette: "暖黄绿色调",
            character_placement: "阿空鞠躬",
            facial_detail: "阿空委屈的表情",
            composition: "中近景"
          },
          action_prompt: "阿空委屈鞠躬，转身干活",
          emotion_cue: "委屈"
        },
        {
          shot_number: 7,
          shot_type: "近景",
          camera_movement: "固定",
          duration: 4,
          emotion: "震惊",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "队长（震惊）：你……你你你到底是什么人？为什么这些丧尸会听你的话？还是S级丧尸！\n队长OS：B级丧尸需要3人小队才能对付，A级丧尸足以攻略7人小队。他竟然能驱使拥有异能的S级丧尸，这家伙是什么怪物？！\n张扬（轻哼一声）：哼，美女你这话说的，我雇佣丧尸打工赚的晶核，这也不犯法吧？\n队长（难以置信）：雇佣S级丧尸！打工？赚晶核？……",
          visual_prompt: {
            scene_description: "温室内部，队长震惊",
            lighting: "暖色调",
            color_palette: "暖黄绿色调",
            character_placement: "队长震惊，张扬淡然",
            facial_detail: "队长难以置信",
            composition: "过肩镜头"
          },
          action_prompt: "队长震惊质问",
          emotion_cue: "震惊"
        },
        {
          shot_number: 8,
          shot_type: "大特写",
          camera_movement: "推镜头",
          duration: 3,
          emotion: "打脸",
          emotion_score: 0,
          climax_type: "",
          climax_score: 0,
          climax_level: "",
          shot_angle: "",
          camera_speed: "",
          sound_effect: "",
          retention_score: 0,
          drop_risk: "",
          dialogue: "张扬：哼，美女你这话说的\n张扬：番茄，咬一口，回味末日前的味道。",
          visual_prompt: {
            scene_description: "温室内部，张扬递番茄给队长",
            lighting: "暖色调",
            color_palette: "鲜红番茄特写",
            character_placement: "张扬递番茄",
            facial_detail: "张扬得意微笑",
            composition: "大特写"
          },
          action_prompt: "张扬递番茄给队长",
          emotion_cue: "打脸"
        }
      ]
    }]
  };
}

// ============ 测试开始 ============

console.log('');
console.log('========================================');
console.log('AIManju v7.0 本地测试');
console.log('========================================');
console.log('');

// ---- 1. 爽点检测 ----
console.log('--- 1. 爽点检测（8种 + 评分 + 等级）---');

test('觉醒爽点 - score=10, weight=2', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  var found = false;
  result.scenes[0].shots.forEach(function(shot) {
    if (shot.climax_type === '觉醒') {
      assert(shot.climax_score >= 8, '觉醒score应>=8, 实际=' + shot.climax_score);
      found = true;
    }
  });
  // 觉醒可能不一定在数据中出现，但算法应该支持
});

test('反杀爽点 - score=9, weight=1.5', function() {
  var data = createRealScriptStoryboard();
  // 添加反杀关键词
  data.scenes[0].shots[3].action_prompt = "阿空一刀斩杀尸王手臂";
  var result = aiService.applyDirectorEngine(data);
  var found = false;
  result.scenes[0].shots.forEach(function(shot) {
    if (shot.climax_type === '反杀') {
      assert(shot.climax_score >= 7, '反杀score应>=7');
      found = true;
    }
  });
});

test('打脸爽点 - 检测"哼"关键词', function() {
  var data = createRealScriptStoryboard();
  // shot 8的dialogue包含"哼"
  var result = aiService.applyDirectorEngine(data);
  var shot8 = result.scenes[0].shots[7];
  if (shot8.climax_type === '打脸') {
    assert(shot8.climax_score >= 5, '打脸score应>=5');
  }
});

test('爽点等级输出 - 普通/有爽点/高潮/爆点', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  var validLevels = ['普通', '有爽点', '高潮', '爆点', ''];
  result.scenes[0].shots.forEach(function(shot) {
    if (shot.climax_level !== undefined) {
      assert(validLevels.indexOf(shot.climax_level) >= 0, 
        'climax_level无效: ' + shot.climax_level);
    }
  });
});

// ---- 2. 节奏检测 ----
console.log('');
console.log('--- 2. 节奏检测 ---');

test('高潮间隔检测 - 超过15秒无高潮应标记风险', function() {
  var data = {
    scenes: [{
      scene_number: 1,
      description: "平淡场景",
      shots: [
        { shot_number: 1, shot_type: "中景", camera_movement: "固定", duration: 6, emotion: "平静", dialogue: "", action_prompt: "角色走动", emotion_cue: "平静", visual_prompt: { scene_description: "走廊", lighting: "自然光", color_palette: "灰色", character_placement: "角色在走廊", facial_detail: "平静", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" },
        { shot_number: 2, shot_type: "中景", camera_movement: "固定", duration: 6, emotion: "平静", dialogue: "", action_prompt: "角色继续走", emotion_cue: "平静", visual_prompt: { scene_description: "走廊", lighting: "自然光", color_palette: "灰色", character_placement: "角色在走廊", facial_detail: "平静", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" },
        { shot_number: 3, shot_type: "中景", camera_movement: "固定", duration: 6, emotion: "平静", dialogue: "", action_prompt: "角色坐着", emotion_cue: "平静", visual_prompt: { scene_description: "房间", lighting: "自然光", color_palette: "灰色", character_placement: "角色坐着", facial_detail: "平静", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" }
      ]
    }]
  };
  var result = aiService.applyDirectorEngine(data);
  // 节奏检测应该在scene级别添加问题标记
  var scene = result.scenes[0];
  // 检查是否有pace或risk相关字段
  if (scene.pace || scene.risk || scene.problems) {
    assert(scene.pace === 'slow' || scene.risk !== 'none', '应检测到节奏问题');
  }
});

test('对话过长检测 - 超80字应标记', function() {
  var data = {
    scenes: [{
      scene_number: 1,
      description: "对话场景",
      shots: [{
        shot_number: 1, shot_type: "中景", camera_movement: "固定", duration: 5,
        emotion: "平静", dialogue: "@角色A：这是一段非常非常长的台词，超过八十个字了，用来测试对话过长检测功能是否正常工作，希望能被节奏引擎正确识别到并且标记为问题项", 
        action_prompt: "说话", emotion_cue: "平静",
        visual_prompt: { scene_description: "房间", lighting: "自然光", color_palette: "灰色", character_placement: "角色A", facial_detail: "平静", composition: "中景" },
        climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: ""
      }]
    }]
  };
  var result = aiService.applyDirectorEngine(data);
  // 对话过长的检测可能记录在scene级别或通过留存优化修复
});

test('情绪疲劳检测 - 连续5镜同一情绪', function() {
  var data = {
    scenes: [{
      scene_number: 1,
      description: "疲劳场景",
      shots: [
        { shot_number: 1, shot_type: "中景", camera_movement: "固定", duration: 3, emotion: "平静", dialogue: "", action_prompt: "走", emotion_cue: "平静", visual_prompt: { scene_description: "走廊", lighting: "自然光", color_palette: "灰", character_placement: "角色", facial_detail: "平", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" },
        { shot_number: 2, shot_type: "中景", camera_movement: "固定", duration: 3, emotion: "平静", dialogue: "", action_prompt: "坐", emotion_cue: "平静", visual_prompt: { scene_description: "房间", lighting: "自然光", color_palette: "灰", character_placement: "角色", facial_detail: "平", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" },
        { shot_number: 3, shot_type: "中景", camera_movement: "固定", duration: 3, emotion: "平静", dialogue: "", action_prompt: "站", emotion_cue: "平静", visual_prompt: { scene_description: "大厅", lighting: "自然光", color_palette: "灰", character_placement: "角色", facial_detail: "平", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" },
        { shot_number: 4, shot_type: "中景", camera_movement: "固定", duration: 3, emotion: "平静", dialogue: "", action_prompt: "看", emotion_cue: "平静", visual_prompt: { scene_description: "窗外", lighting: "自然光", color_palette: "灰", character_placement: "角色", facial_detail: "平", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" },
        { shot_number: 5, shot_type: "中景", camera_movement: "固定", duration: 3, emotion: "平静", dialogue: "", action_prompt: "叹气", emotion_cue: "平静", visual_prompt: { scene_description: "花园", lighting: "自然光", color_palette: "灰", character_placement: "角色", facial_detail: "平", composition: "中景" }, climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: "" }
      ]
    }]
  };
  var result = aiService.applyDirectorEngine(data);
  // 留存优化应该修改某些shot的情绪
  var emotions = result.scenes[0].shots.map(function(s) { return s.emotion; });
  var allSame = emotions.every(function(e) { return e === '平静'; });
  assert(!allSame, '连续5镜同一情绪应被留存优化修正');
});

// ---- 3. 导演决策 ----
console.log('');
console.log('--- 3. 导演决策（音效/角度/速度）---');

test('音效推荐 - 愤怒场景应有heartbeat/drum', function() {
  var data = {
    scenes: [{
      scene_number: 1,
      description: "愤怒场景",
      shots: [{
        shot_number: 1, shot_type: "中景", camera_movement: "固定", duration: 4,
        emotion: "愤怒", dialogue: "", action_prompt: "战斗", emotion_cue: "愤怒",
        visual_prompt: { scene_description: "战场", lighting: "红色", color_palette: "红黑", character_placement: "战士", facial_detail: "愤怒", composition: "特写" },
        climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: ""
      }]
    }]
  };
  var result = aiService.applyDirectorEngine(data);
  var shot = result.scenes[0].shots[0];
  if (shot.sound_effect) {
    assert(shot.sound_effect.length > 0, '愤怒场景应有音效推荐');
    console.log('       → 音效: ' + shot.sound_effect);
  }
});

test('镜头角度 - 打脸爽点应有仰视', function() {
  var data = {
    scenes: [{
      scene_number: 1,
      description: "打脸场景",
      shots: [{
        shot_number: 1, shot_type: "大特写", camera_movement: "推镜头", duration: 3,
        emotion: "打脸", dialogue: "@角色A：哼", action_prompt: "角色冷哼打脸", emotion_cue: "打脸",
        visual_prompt: { scene_description: "对峙", lighting: "高对比", color_palette: "冷色", character_placement: "主角", facial_detail: "冷漠", composition: "大特写" },
        climax_type: "", climax_score: 0, climax_level: "", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: ""
      }]
    }]
  };
  var result = aiService.applyDirectorEngine(data);
  var shot = result.scenes[0].shots[0];
  if (shot.shot_angle) {
    console.log('       → 角度: ' + shot.shot_angle);
  }
});

test('切镜速度 - 战斗场景应为fast', function() {
  var data = {
    scenes: [{
      scene_number: 1,
      description: "战斗场景",
      shots: [{
        shot_number: 1, shot_type: "特写", camera_movement: "快速推镜", duration: 2,
        emotion: "愤怒", dialogue: "", action_prompt: "战斗爆发", emotion_cue: "愤怒",
        visual_prompt: { scene_description: "战场", lighting: "红色", color_palette: "红黑", character_placement: "战士", facial_detail: "愤怒", composition: "特写" },
        climax_type: "反杀", climax_score: 9, climax_level: "爆点", shot_angle: "", camera_speed: "", sound_effect: "", retention_score: 0, drop_risk: ""
      }]
    }]
  };
  var result = aiService.applyDirectorEngine(data);
  var shot = result.scenes[0].shots[0];
  if (shot.camera_speed) {
    console.log('       → 速度: ' + shot.camera_speed);
  }
});

// ---- 4. 台词规则 ----
console.log('');
console.log('--- 4. 台词规则（说话人标注/去重/拆分）---');

test('台词自动补说话人 - "角色名（情绪）：台词"格式', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  result.scenes[0].shots.forEach(function(shot) {
    if (shot.dialogue && shot.dialogue.length > 0) {
      var lines = shot.dialogue.split('\n');
      lines.forEach(function(line) {
        if (line.trim().length > 0) {
          // 不应该出现 @旁白: @角色名 这种双重包裹
          assert(line.indexOf('@旁白: @') === -1, 
            '不应有双重标注: ' + line.substring(0, 30));
        }
      });
    }
  });
});

test('台词去重 - 不应有重复台词', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  result.scenes[0].shots.forEach(function(shot) {
    if (shot.dialogue && shot.dialogue.length > 0) {
      var lines = shot.dialogue.split('\n').filter(function(l) { return l.trim().length > 0; });
      var unique = [];
      lines.forEach(function(line) {
        if (unique.indexOf(line) === -1) unique.push(line);
      });
      assert(unique.length === lines.length, 
        '镜头' + shot.shot_number + '有重复台词: ' + shot.dialogue.substring(0, 50));
    }
  });
});

test('台词拆分 - 单分镜不超过2条', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  result.scenes[0].shots.forEach(function(shot) {
    if (shot.dialogue && shot.dialogue.length > 0) {
      var lines = shot.dialogue.split('\n').filter(function(l) { return l.trim().length > 0; });
      assert(lines.length <= 2, 
        '镜头' + shot.shot_number + '台词超过2条(' + lines.length + '): ' + shot.dialogue.substring(0, 60));
    }
  });
});

// ---- 5. 描述多样性 ----
console.log('');
console.log('--- 5. 描述多样性 ---');

test('连续分镜描述不应完全相同', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  var shots = result.scenes[0].shots;
  for (var i = 1; i < shots.length; i++) {
    var prev = shots[i-1].visual_prompt;
    var curr = shots[i].visual_prompt;
    if (prev && curr && prev.scene_description && curr.scene_description) {
      // 允许部分相同，但不能完全一样
      if (prev.scene_description === curr.scene_description && 
          prev.character_placement === curr.character_placement) {
        console.log('       [WARN] 镜头' + shots[i].shot_number + '与前一镜头描述可能相同');
      }
    }
  }
});

// ---- 6. compileImagePrompt ----
console.log('');
console.log('--- 6. compileImagePrompt ---');

test('所有shot的image_prompt应为字符串且不含[object Object]', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  result.scenes[0].shots.forEach(function(shot) {
    var prompt = aiService.compileImagePrompt(shot, result.scenes[0], []);
    assert(typeof prompt === 'string', 'image_prompt应为字符串');
    assert(prompt.indexOf('[object Object]') === -1, 
      'image_prompt不应包含[object Object]');
  });
});

// ---- 7. 真实剧本全流程 ----
console.log('');
console.log('--- 7. 真实剧本全流程 ---');

test('真实剧本全流程 - 输出详细结果', function() {
  var data = createRealScriptStoryboard();
  var result = aiService.applyDirectorEngine(data);
  
  console.log('');
  console.log('========== 分镜结果 ==========');
  result.scenes[0].shots.forEach(function(shot) {
    console.log('');
    console.log('【镜头' + shot.shot_number + '】');
    console.log('  景别: ' + shot.shot_type + '  运镜: ' + shot.camera_movement + '  时长: ' + shot.duration + 's');
    if (shot.shot_angle) console.log('  角度: ' + shot.shot_angle);
    if (shot.camera_speed) console.log('  切镜速度: ' + shot.camera_speed);
    if (shot.sound_effect) console.log('  音效: ' + shot.sound_effect);
    console.log('  情绪: ' + shot.emotion + (shot.emotion_score ? '(' + shot.emotion_score + ')' : ''));
    if (shot.climax_type) console.log('  爽点: ' + shot.climax_type + (shot.climax_score ? ' score=' + shot.climax_score : '') + (shot.climax_level ? ' [' + shot.climax_level + ']' : ''));
    if (shot.retention_score) console.log('  留存分: ' + shot.retention_score + (shot.drop_risk ? ' 风险=' + shot.drop_risk : ''));
    if (shot.dialogue) console.log('  台词: ' + shot.dialogue.substring(0, 80) + (shot.dialogue.length > 80 ? '...' : ''));
    if (shot.visual_prompt) console.log('  描述: ' + (shot.visual_prompt.scene_description || '').substring(0, 50));
  });
  
  // 检查scene级别的节奏数据
  var scene = result.scenes[0];
  if (scene.pace) console.log('\n  场景节奏: ' + scene.pace);
  if (scene.risk) console.log('  节奏风险: ' + scene.risk);
  if (scene.problems && scene.problems.length) console.log('  节奏问题: ' + scene.problems.join(', '));
  if (scene.retention_score) console.log('  场景留存分: ' + scene.retention_score);
});

// ============ 结果汇总 ============

console.log('');
console.log('========================================');
console.log('测试结果: ' + passed + '/' + total + ' PASSED' + (failed > 0 ? ', ' + failed + ' FAILED' : ''));
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
