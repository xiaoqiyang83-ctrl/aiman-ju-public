/**
 * AIManju v7.0 端到端(E2E)测试脚本
 * 
 * 通过HTTP API走完整链路：找到项目/剧本 → 更新剧本内容 → 生成分镜 → 写入数据库
 * 跑完后在前端页面能看到完整的分镜数据
 * 
 * 使用方法：
 *   1. 确保后端已启动（默认 http://localhost:3001）
 *   2. 确保数据库中至少有一个项目和剧本（在前端页面先随便创建一个项目上传一个剧本）
 *   3. cd backend
 *   4. node test-v7-e2e.js
 * 
 * 可选环境变量：
 *   API_BASE - 后端地址，默认 http://localhost:3001
 */

var http = require('http');
var https = require('https');

var API_BASE = process.env.API_BASE || 'http://localhost:3001';

// ============ HTTP工具函数 ============

function httpRequest(method, path, data) {
  return new Promise(function(resolve, reject) {
    var url;
    try {
      url = new URL(API_BASE + path);
    } catch(e) {
      return reject(new Error('无效的API地址: ' + API_BASE + path));
    }
    
    var bodyData = data ? JSON.stringify(data) : '';
    var transport = url.protocol === 'https:' ? https : http;
    
    var options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (bodyData) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }
    
    var req = transport.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var json = JSON.parse(body);
          resolve(json);
        } catch(e) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(120000, function() {
      req.destroy(new Error('请求超时(120s)'));
    });
    
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

function httpGet(path) { return httpRequest('GET', path); }
function httpPost(path, data) { return httpRequest('POST', path, data); }
function httpPut(path, data) { return httpRequest('PUT', path, data); }

// ============ 内置测试剧本 ============

var TEST_SCRIPT_CONTENT = '第2集\n\n场景一：工厂农场-温室\n\n温室内部，绿意盎然，蔬菜丛生。S级丧尸阿空正在田边悠闲地摘番茄。突然，一阵急促的脚步声响起。\n\n队长带领一支全副武装的小队冲进温室，枪口对准阿空。\n\n队长（绝望）：报告总部！发现携带空间异能的S级丧尸！请求支援！\n\n队员甲：我们的攻击竟然对他毫无作用！这就是S级丧尸的威力吗？！\n\n阿空抬起头，面无表情地看了看队长一行人。\n\n阿空：现在该我了！\n\n阿空抬手，空间扭曲，一股无形的力量将队长小队的攻击全部吞噬。队员们惊恐后退。\n\n就在阿空准备发动致命一击时，一道人影从温室深处走出。\n\n张扬（轻哼一声）：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核的奖金！\n\n阿空（委屈）：老板...是他们先动手的...\n\n张扬：行了行了，继续干活！\n\n队长（震惊）：你...你到底是什么人？为什么这些丧尸会听你的话？还是S级丧尸！\n\n队长OS：B级丧尸需要3人小队才能对付，A级丧尸足以攻略7人小队。他竟然能驱使拥有异能的S级丧尸，这家伙是什么怪物？！\n\n张扬（轻哼一声）：哼，美女你这话说的，我雇佣丧尸打工赚的晶核，这也不犯法吧？\n\n队长（难以置信）：雇佣S级丧尸！打工？赚晶核？...\n\n张扬随手从菜篮里拿起一个鲜红的番茄，递到队长面前。\n\n张扬：番茄，咬一口，回味末日前的味道。\n\n场景二：工厂农场-走廊\n\n张扬带着目瞪口呆的队长穿过走廊。两侧的S级丧尸有的在拖地，有的在搬运货物，井然有序。\n\n张扬（得意）：这是我工厂的员工宿舍区。每个员工都有独立的工位和KPI考核。\n\n队长（颤抖）：这...这太疯狂了...\n\n张扬：疯狂？这是管理。丧尸不用发工资，不闹罢工，007全年无休，比人类员工好用多了。\n\n队员乙（小声）：队长，要不要向总部汇报？\n\n队长（低声）：先别急...我需要了解更多情况。这个人太不简单了。';

// ============ 测试流程 ============

async function runE2ETest() {
  console.log('');
  console.log('========================================');
  console.log('AIManju v7.0 端到端(E2E)测试');
  console.log('API地址: ' + API_BASE);
  console.log('========================================');
  console.log('');
  
  var projectId = null;
  var scriptId = null;
  
  // ---- Step 1: 检查后端 ----
  console.log('[Step 1] 检查后端连接...');
  try {
    var health = await httpGet('/api/health');
    if (health.status === 'ok' || health.success) {
      console.log('  ✓ 后端在线');
    } else {
      console.log('  ⚠ 后端响应异常，继续尝试...');
    }
  } catch(e) {
    console.log('  ✗ 后端无法连接: ' + e.message);
    console.log('  请确认后端已启动: node backend/server.js');
    process.exit(1);
  }
  
  // ---- Step 2: 找到项目和剧本 ----
  console.log('[Step 2] 查找已有项目...');
  try {
    var projectsRes = await httpGet('/api/projects');
    if (!projectsRes.success || !projectsRes.data || projectsRes.data.length === 0) {
      console.log('  ✗ 没有找到项目');
      console.log('  请先在前端页面创建一个项目并上传一个剧本，然后重新运行此脚本');
      process.exit(1);
    }
    
    // 取第一个项目
    projectId = projectsRes.data[0].id;
    console.log('  ✓ 找到项目: #' + projectId + ' - ' + projectsRes.data[0].name);
  } catch(e) {
    console.log('  ✗ 查询项目失败: ' + e.message);
    process.exit(1);
  }
  
  // ---- Step 3: 查找剧本 ----
  console.log('[Step 3] 查找剧本...');
  try {
    var scriptsRes = await httpGet('/api/scripts?project_id=' + projectId);
    if (!scriptsRes.success || !scriptsRes.data || scriptsRes.data.length === 0) {
      console.log('  ✗ 该项目下没有剧本');
      console.log('  请先在前端页面上传一个剧本，然后重新运行此脚本');
      process.exit(1);
    }
    
    scriptId = scriptsRes.data[0].id;
    console.log('  ✓ 找到剧本: #' + scriptId + ' - ' + scriptsRes.data[0].title);
  } catch(e) {
    console.log('  ✗ 查询剧本失败: ' + e.message);
    process.exit(1);
  }
  
  // ---- Step 4: 用测试剧本内容覆盖 ----
  console.log('[Step 4] 更新剧本为测试内容...');
  try {
    var updateRes = await httpPut('/api/scripts/' + scriptId, {
      title: 'v7.0测试剧本_' + new Date().toLocaleString('zh-CN'),
      content: TEST_SCRIPT_CONTENT
    });
    if (updateRes.success) {
      console.log('  ✓ 剧本内容已更新');
    } else {
      console.log('  ⚠ 更新可能失败: ' + (updateRes.message || ''));
      console.log('  继续尝试用现有内容生成分镜...');
    }
  } catch(e) {
    console.log('  ⚠ 更新剧本异常: ' + e.message);
    console.log('  继续尝试用现有内容生成分镜...');
  }
  
  // ---- Step 5: 生成分镜（核心！调用AI+导演引擎，写数据库） ----
  console.log('[Step 5] 生成分镜（调用AI+导演引擎，需要30-90秒）...');
  try {
    var startTime = Date.now();
    var storyboardRes = await httpPost('/api/scenes/generate', { script_id: scriptId });
    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (storyboardRes.success) {
      var scenes = storyboardRes.data || [];
      var shotCount = 0;
      scenes.forEach(function(scene) {
        shotCount += (scene.shots ? scene.shots.length : 0);
      });
      
      console.log('  ✓ 分镜生成成功！耗时: ' + elapsed + 's');
      console.log('  场景数: ' + scenes.length + ', 镜头数: ' + shotCount);
      
      // 详细输出每个场景的分镜
      scenes.forEach(function(scene) {
        console.log('');
        console.log('  【场景' + (scene.scene_number || '?') + '】' + (scene.title || '') + ' - ' + (scene.location || ''));
        if (scene.shots && scene.shots.length > 0) {
          scene.shots.forEach(function(shot) {
            console.log('    镜头' + (shot.shot_number || '?') + ': ' + (shot.shot_type || '') + ' | ' + (shot.camera_movement || '') + ' | ' + (shot.duration || '') + 's');
            if (shot.dialogue) console.log('      台词: ' + shot.dialogue.substring(0, 80) + (shot.dialogue.length > 80 ? '...' : ''));
            if (shot.climax_type) console.log('      爽点: ' + shot.climax_type + (shot.climax_score ? ' score=' + shot.climax_score : '') + (shot.climax_level ? ' [' + shot.climax_level + ']' : ''));
            if (shot.sound_effect) console.log('      音效: ' + shot.sound_effect);
            if (shot.shot_angle) console.log('      角度: ' + shot.shot_angle);
            if (shot.camera_speed) console.log('      切镜速度: ' + shot.camera_speed);
            if (shot.retention_score) console.log('      留存分: ' + shot.retention_score + (shot.drop_risk ? ' 风险=' + shot.drop_risk : ''));
            if (shot.pace) console.log('      节奏: ' + shot.pace);
          });
        }
        // 场景级别
        if (scene.pace) console.log('    场景节奏: ' + scene.pace);
        if (scene.risk) console.log('    节奏风险: ' + scene.risk);
        if (scene.retention_score) console.log('    场景留存分: ' + scene.retention_score);
      });
    } else {
      console.log('  ✗ 分镜生成失败: ' + (storyboardRes.message || JSON.stringify(storyboardRes).substring(0, 200)));
    }
  } catch(e) {
    console.log('  ✗ 分镜生成异常: ' + e.message);
    console.log('  提示: 此步骤需要调用AI API，请确认.env中已配置智谱API Key');
  }
  
  // ---- Step 6: 验证数据库 ----
  console.log('');
  console.log('[Step 6] 验证数据是否写入数据库...');
  try {
    var scenesRes = await httpGet('/api/scenes?script_id=' + scriptId);
    if (scenesRes.success && scenesRes.data && scenesRes.data.length > 0) {
      console.log('  ✓ 场景数据已写入: ' + scenesRes.data.length + '个场景');
      scenesRes.data.forEach(function(s) {
        console.log('    - 场景#' + s.scene_number + ': ' + (s.title || '') + ' (' + (s.location || '') + ')');
      });
    } else {
      console.log('  ⚠ 未查询到场景数据');
    }
  } catch(e) {
    console.log('  ✗ 查询失败: ' + e.message);
  }
  
  // ---- 总结 ----
  console.log('');
  console.log('========================================');
  console.log('端到端测试完成！');
  console.log('');
  console.log('现在请打开前端页面验证效果:');
  console.log('  http://localhost:5173');
  console.log('  项目 #' + projectId + ' → 剧本 #' + scriptId + ' → 查看分镜');
  console.log('');
  console.log('重点验证:');
  console.log('  1. 分镜是否有爽点标注（打脸/装逼/觉醒等）');
  console.log('  2. 景别是否有变化（远景/中景/特写交替）');
  console.log('  3. 台词是否标注了说话人（如"队长：..."）');
  console.log('  4. 音效/镜头角度是否显示');
  console.log('  5. 图片描述是否和实际内容一致');
  console.log('  6. 分镜编辑/重新生成/拖拽排序是否正常');
  console.log('========================================');
}

runE2ETest().catch(function(err) {
  console.error('测试异常退出:', err.message);
  process.exit(1);
});
