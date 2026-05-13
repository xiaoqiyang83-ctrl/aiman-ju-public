<template>
  <div class="workspace-container">
    <!-- 无项目时的欢迎页面 -->
    <div v-if="!hasProject" class="welcome-page">
      <div class="welcome-content">
        <div class="welcome-icon">
          <el-icon :size="80" color="#409eff"><VideoPlay /></el-icon>
        </div>
        <h1 class="welcome-title">欢迎使用 AIManju 漫剧工具</h1>
        <p class="welcome-desc">开始您的AI漫剧创作之旅，让想象力变为精彩的视频作品</p>
        
        <div class="welcome-actions">
          <el-button type="primary" size="large" @click="handleCreateProject">
            <el-icon><Plus /></el-icon>
            创建新项目
          </el-button>
          <el-upload
            :show-file-list="false"
            accept=".docx,.doc,.txt"
            :before-upload="handleUploadScriptWelcome"
          >
            <el-button size="large">
              <el-icon><Upload /></el-icon>
              上传剧本开始
            </el-button>
          </el-upload>
        </div>
        
        <div class="welcome-features">
          <div class="feature-item">
            <div class="feature-icon">
              <el-icon :size="32" color="#67c23a"><MagicStick /></el-icon>
            </div>
            <h3>AI智能生成</h3>
            <p>输入简单描述，AI自动生成完整剧本和分镜</p>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <el-icon :size="32" color="#e6a23c"><Grid /></el-icon>
            </div>
            <h3>专业分镜系统</h3>
            <p>可视化分镜编辑，支持镜头类型、时长、动作设置</p>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <el-icon :size="32" color="#f56c6c"><VideoCamera /></el-icon>
            </div>
            <h3>一键视频生成</h3>
            <p>AI自动生成视频片段，一键拼接导出</p>
          </div>
        </div>
        
        <div class="welcome-steps">
          <h3>快速开始三步曲</h3>
          <div class="steps-list">
            <div class="step-item">
              <span class="step-num">1</span>
              <span class="step-text">创建项目，上传或AI生成剧本</span>
            </div>
            <div class="step-item">
              <span class="step-num">2</span>
              <span class="step-text">AI生成分镜，调整镜头细节</span>
            </div>
            <div class="step-item">
              <span class="step-num">3</span>
              <span class="step-text">生成视频并导出成品</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 有项目时的工作区 -->
    <template v-else>
    <!-- 顶部工具栏 -->
    <div class="workspace-header">
      <div class="header-left">
        <h2 class="project-name">{{ projectName }}</h2>
        <div class="quick-actions">
          <el-button link type="primary" @click="handleTutorial">
            <el-icon><Reading /></el-icon>
            新手教程
          </el-button>
          <el-divider direction="vertical" />
          <el-button link type="info" @click="handleHelp">
            <el-icon><QuestionFilled /></el-icon>
            使用帮助
          </el-button>
          <el-divider direction="vertical" />
          <el-button link type="info" @click="handleShortcuts">
            <el-icon><Bell /></el-icon>
            快捷键
          </el-button>
          <el-divider direction="vertical" />
          <el-button link type="warning" @click="handleUpgrade">
            <el-icon><Star /></el-icon>
            {{ userStore.membership.plan_type === 'pro' ? 'Pro会员' : '升级会员' }}
          </el-button>
          <el-divider direction="vertical" />
          <div class="credit-display" @click="goToMemberCenter">
            <el-icon><Coin /></el-icon>
            <span>积分: {{ userStore.credits.balance }}</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <el-button 
          type="primary" 
          size="large" 
          class="auto-gen-btn"
          @click="handleAutoGenerate"
          :loading="isAutoGenerating"
        >
          <el-icon><MagicStick /></el-icon>
          一键成片
        </el-button>
      </div>
    </div>

    <!-- 工作区主体内容 -->
    <div class="workspace-content">
      <!-- 左列：项目概览 -->
      <div class="content-left">
        <el-card class="overview-card" shadow="hover">
          <div class="project-overview">
            <div class="project-cover">
              <img v-if="projectCover" :src="'' + projectCover" alt="项目封面" />
              <div v-else class="cover-placeholder">
                <el-icon><PictureFilled /></el-icon>
              </div>
            </div>
            <div class="project-info">
              <h3 class="project-title">{{ projectName }}</h3>
              <div class="project-meta">
                <span class="meta-item">
                  <el-icon><Document /></el-icon>
                  {{ scriptCount }}个剧本
                </span>
                <span class="meta-item">
                  <el-icon><Grid /></el-icon>
                  {{ sceneCount }}个场景
                </span>
                <span class="meta-item">
                  <el-icon><VideoPlay /></el-icon>
                  {{ shotCount }}个镜头
                </span>
              </div>
              <div class="project-progress">
                <div class="progress-label">
                  <span>创作进度</span>
                  <span class="progress-value">{{ progressPercent }}%</span>
                </div>
                <el-progress :percentage="progressPercent" :stroke-width="8" :show-text="false" />
              </div>
              <div class="project-status">
                <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
                <span class="update-time">最后更新: {{ lastUpdateTime }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 快捷操作 -->
        <div class="quick-operations">
          <h4 class="section-title">快捷操作</h4>
          <div class="operation-buttons">
            <el-button class="op-btn" @click="handleNewScript">
              <div class="op-icon script-icon">
                <el-icon><Document /></el-icon>
              </div>
              <span>新建剧本</span>
            </el-button>
            <el-button class="op-btn" @click="handleNewCharacter">
              <div class="op-icon character-icon">
                <el-icon><User /></el-icon>
              </div>
              <span>创建角色</span>
            </el-button>
            <el-button class="op-btn" @click="handleGenerateScenes">
              <div class="op-icon scene-icon">
                <el-icon><Grid /></el-icon>
              </div>
              <span>生成分镜</span>
            </el-button>
            <el-button class="op-btn" @click="handleGenerateVideo">
              <div class="op-icon video-icon">
                <el-icon><VideoPlay /></el-icon>
              </div>
              <span>生成视频</span>
            </el-button>
            <el-button class="op-btn" @click="handleExport">
              <div class="op-icon export-icon">
                <el-icon><Download /></el-icon>
              </div>
              <span>导出</span>
            </el-button>
            <el-button class="op-btn" @click="handleVersionManage">
              <div class="op-icon version-icon">
                <el-icon><Clock /></el-icon>
              </div>
              <span>版本管理</span>
            </el-button>
          </div>
        </div>
      </div>

      <!-- 中列：创作流程区 -->
      <div class="content-center">
        <el-tabs v-model="activeTab" class="creation-tabs" @tab-change="handleTabChange">
          <!-- 剧本Tab -->
          <el-tab-pane label="剧本" name="script">
            <template #label>
              <span class="tab-label">
                <el-icon><Document /></el-icon>
                剧本
              </span>
            </template>
            <div class="tab-content script-content">
              <div class="content-toolbar">
                <el-button type="success" @click="showAiDialog = true">
                  <el-icon><MagicStick /></el-icon>
                  AI生成剧本
                </el-button>
                <el-upload
                  :show-file-list="false"
                  accept=".docx,.doc,.txt"
                  :before-upload="handleUploadScript"
                >
                  <el-button>
                    <el-icon><Upload /></el-icon>
                    上传剧本
                  </el-button>
                </el-upload>
                <el-input 
                  v-model="scriptSearch" 
                  placeholder="搜索剧本..." 
                  style="width: 200px"
                  clearable
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </div>
              <div v-loading="loadingScripts" class="script-list">
                <el-card 
                  v-for="script in filteredScripts" 
                  :key="script.id"
                  class="script-card"
                  shadow="hover"
                  @click="handleEditScript(script)"
                >
                  <div class="script-header">
                    <h4 class="script-title">{{ script.title }}</h4>
                    <el-tag v-if="script.status === 'ai_generated'" type="success" size="small">AI</el-tag>
                  </div>
                  <div class="script-meta">
                    <span>{{ script.scene_count || 0 }}个场景</span>
                    <span>{{ formatDate(script.created_at) }}</span>
                  </div>
                  <div class="script-actions">
                    <el-button size="small" type="primary" @click.stop="handleEditScript(script)">编辑</el-button>
                    <el-button size="small" type="success" :disabled="isGeneratingStoryboard" @click.stop="handleGenStoryboard(script)">{{ isGeneratingStoryboard ? '生成中...' : '分镜' }}</el-button>
                    <el-button size="small" type="danger" @click.stop="handleDeleteScript(script)">删除</el-button>
                  </div>
                </el-card>
                <div v-if="!loadingScripts && filteredScripts.length === 0" class="empty-state">
                  <el-empty description="暂无剧本" />
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 角色Tab -->
          <el-tab-pane label="角色" name="character">
            <template #label>
              <span class="tab-label">
                <el-icon><User /></el-icon>
                角色
              </span>
            </template>
            <div class="tab-content character-content">
              <div class="content-toolbar">
                <el-button type="primary" @click="showCharacterDialog = true">
                  <el-icon><Plus /></el-icon>
                  创建角色
                </el-button>
                <el-input 
                  v-model="characterSearch" 
                  placeholder="搜索角色..." 
                  style="width: 200px"
                  clearable
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </div>
              <div v-loading="loadingCharacters" class="character-grid">
                <el-card 
                  v-for="char in filteredCharacters" 
                  :key="char.id"
                  class="character-card-enhanced"
                  :class="{ 'card-selected': selectedCharacter?.id === char.id }"
                  shadow="hover"
                  @click="handleCharacterClick(char)"
                >
                  <div class="char-avatar-enhanced">
                    <img :src="getAssetUrl(char.front_image_url || char.image_url || char.reference_image || '')" :alt="char.name" />
                    <div class="char-angle-badges">
                      <el-tag v-if="char.front_image_url" size="small" type="success" effect="dark">正</el-tag>
                      <el-tag v-if="char.side_image_url" size="small" type="warning" effect="dark">侧</el-tag>
                      <el-tag v-if="char.back_image_url" size="small" type="info" effect="dark">背</el-tag>
                    </div>
                  </div>
                  <div class="char-info-enhanced">
                    <div class="char-name-row">
                      <span class="char-name">{{ char.name }}</span>
                      <el-tag v-if="char.gender" size="small" type="info">{{ char.gender }}</el-tag>
                    </div>
                    <div class="char-stats-row">
                      <span>{{ char.expressions?.length || 0 }} 表情</span>
                      <el-divider direction="vertical" />
                      <span>{{ char.costumes?.length || 0 }} 换装</span>
                    </div>
                    <div class="char-actions-enhanced">
                      <el-button size="small" type="warning" link @click.stop="handleCalibrateCharacter(char)" :loading="calibratingCharacter[char.id]">校准</el-button>
                      <el-button size="small" type="primary" link :icon="Edit" @click.stop="handleEditCharacter(char)">编辑</el-button>
                      <el-button size="small" type="danger" link :icon="Delete" @click.stop="handleDeleteCharacter(char)">删除</el-button>
                    </div>
                  </div>
                </el-card>
                <div v-if="!loadingCharacters && filteredCharacters.length === 0" class="empty-state">
                  <el-empty description="暂无角色" />
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 分镜Tab -->
          <el-tab-pane label="分镜" name="storyboard">
            <template #label>
              <span class="tab-label">
                <el-icon><Grid /></el-icon>
                分镜
              </span>
            </template>
            <div class="tab-content storyboard-content">
              <div class="content-toolbar">
                <el-button type="primary" :loading="isGeneratingStoryboard" :disabled="isGeneratingStoryboard" @click="handleGenerateScenes">
                  <el-icon v-if="!isGeneratingStoryboard"><MagicStick /></el-icon>
                  {{ isGeneratingStoryboard ? '正在生成分镜...' : 'AI生成分镜' }}
                </el-button>
                <el-button @click="handleBatchSelect">
                  <el-icon><Select /></el-icon>
                  批量选择
                </el-button>
                <el-select v-model="shotImageSize" size="small" style="width: 120px;">
                  <el-option v-for="(item, key) in IMAGE_SIZE_MAP" :key="key" :label="item.label" :value="key" />
                </el-select>
                <el-button type="success" :loading="batchGenerating" :disabled="batchGenerating" @click="handleBatchGenerateImages">
                  <el-icon><Picture /></el-icon>
                  <span v-if="batchGenerating">生图中 {{ batchProgress.current }}/{{ batchProgress.total }}</span>
                  <span v-else>批量生图</span>
                </el-button>
                <el-button v-if="batchGenerating" type="danger" @click="handleCancelBatchGenerate">
                  <el-icon><Close /></el-icon>
                  取消
                </el-button>
              </div>
              <div v-loading="isGeneratingStoryboard || loadingScenes" :element-loading-text="isGeneratingStoryboard ? 'AI正在拆分分镜，请耐心等待1-3分钟...' : ''" element-loading-background="rgba(255,255,255,0.85)" class="scene-list">
                <div 
                  v-for="scene in scenes" 
                  :key="scene.id"
                  class="scene-card-enhanced"
                >
                  <!-- 场景头部信息（可折叠） -->
                  <div class="scene-header-enhanced" @click="toggleSceneExpand(scene)">
                    <div class="scene-badge">
                      <span class="scene-number-enhanced">场景 {{ scene.scene_number || 1 }}</span>
                    </div>
                    <div class="scene-title-row">
                      <h3 class="scene-title-enhanced">{{ scene.title || '未命名场景' }}</h3>
                      <div class="scene-meta-tags">
                        <el-tag v-if="scene.time_of_day" size="small" type="info">{{ scene.time_of_day }}</el-tag>
                        <el-tag size="small" type="warning">{{ scene.shot_count || 0 }} 个镜头</el-tag>
                        <el-tag size="small" type="success">预计 {{ (scene.shot_count || 0) * 3 }} 秒</el-tag>
                      </div>
                    </div>
                    <el-icon class="scene-expand-icon" :class="{ expanded: expandedSceneIds.includes(scene.id) }">
                      <ArrowDown />
                    </el-icon>
                    <div class="scene-actions-enhanced" @click.stop>
                      <el-button size="small" type="success" :loading="generatingSceneImage[scene.id]" @click="handleGenerateSceneImage(scene)" title="生成该场景的概念参考图">
                        <el-icon><Picture /></el-icon>
                        场景图
                      </el-button>
                      <el-button size="small" type="primary" @click="handleGenerateSceneVideo(scene)" title="批量生成该场景下所有镜头的视频">
                        <el-icon><VideoPlay /></el-icon>
                        生成视频
                      </el-button>
                      <el-button size="small" @click="handleEditScene(scene)" title="编辑场景信息（标题、地点、时间等）">
                        <el-icon><Edit /></el-icon>
                        编辑
                      </el-button>
                      <el-button size="small" type="danger" @click="handleDeleteScene(scene)" title="删除整个场景及所有镜头">
                        <el-icon><Delete /></el-icon>
                        删除
                      </el-button>
                    </div>
                  </div>
                  
                  <!-- 镜头卡片网格（折叠显示，点击展开） -->
                  <div v-if="expandedSceneIds.includes(scene.id)" class="scene-body">
                    <div v-if="!scene.shots?.length" class="scene-empty-shots-hint">
                      该场景暂无镜头，点击「添加镜头」新建，或通过剧本重新生成分镜。
                    </div>
                  <div class="shots-grid">
                    <div 
                      v-for="(shot, idx) in scene.shots" 
                      :key="shot.id || `shot-${scene.id}-${idx}`"
                      class="shot-card-enhanced"
                      :class="{ 
                        completed: shot.video_status === 'completed', 
                        generating: shot.video_status === 'generating' || shot.video_status === 'processing',
                        selected: selectedShotIds.includes(shot.id) 
                      }"
                      @click="handleShotClick(shot)"
                    >
                      <!-- 缩略图区域 -->
                      <div class="shot-thumb-enhanced" @click.stop>
                        <el-image v-if="shot.thumbnail || shot.video_url || shot.result_url" :src="getAssetUrl(shot.thumbnail || shot.video_url || shot.result_url)" fit="cover" :preview-src-list="[getAssetUrl(shot.thumbnail || shot.video_url || shot.result_url)]" preview-teleported class="shot-preview-image" />
                        <el-image v-else-if="shot.scene_image_url" :src="getAssetUrl(shot.scene_image_url)" fit="cover" :preview-src-list="[getAssetUrl(shot.scene_image_url)]" preview-teleported alt="AI生成图" class="shot-ref-image-thumb shot-preview-image" />
                        <el-image v-else-if="shot.reference_image_url" :src="getAssetUrl(shot.reference_image_url)" fit="cover" :preview-src-list="[getAssetUrl(shot.reference_image_url)]" preview-teleported alt="场景参考图" class="shot-ref-image-thumb shot-preview-image" />
                        <div v-else class="thumb-placeholder-enhanced">
                          <el-icon :size="32"><VideoPlay /></el-icon>
                          <span>暂无预览</span>
                        </div>
                        <div class="shot-overlay">
                          <el-button v-if="shot.video_status === 'completed'" size="small" type="success" @click.stop="handlePreviewShotVideo(shot)">
                            <el-icon><View /></el-icon>
                            预览
                          </el-button>
                          <el-button v-else-if="shot.video_status === 'generating' || shot.video_status === 'processing' || shot.video_status === 'pending'" size="small" type="warning" disabled>
                            <el-icon :size="16"><Loading /></el-icon>
                            生成中
                          </el-button>
                          <template v-else>
                            <el-button size="small" type="danger" @click.stop="handleGenerateCogVideo(shot)" :disabled="!shot.scene_image_url" :title="shot.scene_image_url ? '使用CogVideoX生成视频' : '需要先有首帧图'">
                              <el-icon><VideoPlay /></el-icon>
                              CogVideo
                            </el-button>
                          </template>
                            <el-select :model-value="getShotImageSize(shot.id)" @update:model-value="(val) => setShotImageSize(shot.id, val)" size="small" style="width: 100px;" title="选择该分镜的生图尺寸（可覆盖全局）">
                            <el-option v-for="(item, key) in IMAGE_SIZE_MAP" :key="key" :label="item.label" :value="key" />
                          </el-select>
                          <el-button
                            size="small" 
                            type="success"
                            :loading="generatingShotImage[shot.id]"
                            @click.stop="handleGenShotImage(shot)"
                          >
                            <el-icon><Picture /></el-icon>
                            生图
                          </el-button>
                          <el-upload
                            class="shot-upload-btn"
                            action="#"
                            :show-file-list="false"
                            :auto-upload="false"
                            :on-change="(file) => handleShotRefUpload(file, shot)"
                            @click.stop
                          >
                            <el-button size="small" type="info">
                              <el-icon><Upload /></el-icon>
                              场景参考图
                            </el-button>
                          </el-upload>
                        </div>
                        <span class="shot-index">#{{ shot.shot_number ?? (idx + 1) }}</span>
                        <el-tag v-if="shot.video_status === 'completed'" class="shot-status-tag" type="success" size="small">已完成</el-tag>
                        <el-tag v-else-if="!shot.scene_image_url && !shot.video_status" class="shot-status-tag" type="info" size="small">待生成</el-tag>
                        <el-tag v-else-if="shot.video_status && shot.video_status !== 'completed'" class="shot-status-tag" :type="getShotStatusType(shot.video_status)" size="small">{{ getShotStatusText(shot.video_status) }}</el-tag>
                      </div>
                      
                      <!-- 镜头信息 -->
                      <div class="shot-info-enhanced">
                        <div class="shot-type-row">
                          <el-tag size="small" type="info">{{ shot.shot_type || '中景' }}</el-tag>
                          <el-tag v-if="shot.camera_angle && shot.camera_angle !== '平视'" size="small" type="warning">{{ shot.camera_angle }}</el-tag>
                          <span class="shot-duration">{{ shot.duration || 3 }}秒</span>
                          <el-button size="small" type="primary" link @click.stop="handleShotClick(shot)">编辑</el-button>
                          <el-button
                            size="small"
                            link
                            :disabled="idx === 0"
                            @click.stop="handleMoveShot(scene, shot, 'up')"
                          >
                            <el-icon><ArrowUp /></el-icon>
                          </el-button>
                          <el-button
                            size="small"
                            link
                            :disabled="idx === (scene.shots?.length || 0) - 1"
                            @click.stop="handleMoveShot(scene, shot, 'down')"
                          >
                            <el-icon><ArrowDown /></el-icon>
                          </el-button>
                          <el-button
                            v-if="shot.id"
                            size="small"
                            type="danger"
                            link
                            @click.stop="handleDeleteShot(shot, scene)"
                          >
                            删除
                          </el-button>
                        </div>
                        
                        <!-- 结构化提示词区域 -->
                        <div class="shot-prompt-section" v-if="getVisualPrompt(shot)">
                          <!-- 色彩条 -->
                          <div class="prompt-color-bar" v-if="getVisualPrompt(shot).color_palette">
                            <span class="prompt-label">🎨</span>
                            <span class="prompt-text">{{ getVisualPrompt(shot).color_palette }}</span>
                          </div>
                          <!-- 光影 -->
                          <div class="prompt-line" v-if="getVisualPrompt(shot).lighting">
                            <span class="prompt-label">💡</span>
                            <span class="prompt-text">{{ getVisualPrompt(shot).lighting }}</span>
                          </div>
                          <!-- 角色站位 -->
                          <div class="prompt-line" v-if="getVisualPrompt(shot).character_placement">
                            <span class="prompt-label">🎭</span>
                            <span class="prompt-text">{{ getVisualPrompt(shot).character_placement }}</span>
                          </div>
                          <!-- 构图 -->
                          <div class="prompt-line" v-if="getVisualPrompt(shot).composition">
                            <span class="prompt-label">📐</span>
                            <span class="prompt-text">{{ getVisualPrompt(shot).composition }}</span>
                          </div>
                          <!-- 动作 -->
                          <div class="prompt-line" v-if="getActionPrompt(shot)?.physical_action">
                            <span class="prompt-label">🎬</span>
                            <span class="prompt-text">{{ getActionPrompt(shot).physical_action }}</span>
                          </div>
                          <!-- 情绪 -->
                          <div class="prompt-line" v-if="getEmotionCue(shot)?.primary_emotion">
                            <span class="prompt-label">{{ getEmotionEmoji(getEmotionCue(shot).primary_emotion) }}</span>
                            <span class="prompt-text">{{ getEmotionCue(shot).primary_emotion }}</span>
                          </div>
                        </div>
                        
                        <!-- 兼容旧数据：没有结构化提示词时显示原description -->
                        <p v-else class="shot-description">{{ shot.visual_description || shot.description || '暂无描述' }}</p>
                        
                        <!-- 台词/旁白 -->
                        <div class="shot-dialogue-row" v-if="shot.dialogue || getNarration(shot)">
                          <span v-if="shot.dialogue" class="shot-dialogue">💬 {{ shot.dialogue }}</span>
                          <span v-if="getNarration(shot)" class="shot-narration">📖 {{ getNarration(shot) }}</span>
                        </div>
                        
                        <!-- 运镜 -->
                        <div class="shot-camera">
                          <el-icon><Monitor /></el-icon>
                          <span>{{ shot.camera_movement || '固定镜头' }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 添加镜头按钮 -->
                    <div class="shot-card-enhanced add-shot" @click="handleAddShot(scene)">
                      <div class="add-shot-icon">
                        <el-icon :size="40"><Plus /></el-icon>
                      </div>
                      <span>添加镜头</span>
                    </div>
                  </div>
                  </div><!-- scene-body 结束 -->
                </div>
                
                <div v-if="!loadingScenes && scenes.length === 0" class="empty-state">
                  <el-empty description="暂无分镜，请先生成剧本" />
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 视频Tab -->
          <el-tab-pane label="视频" name="video">
            <template #label>
              <span class="tab-label">
                <el-icon><VideoPlay /></el-icon>
                视频
              </span>
            </template>
            <div class="tab-content video-content">
              <div class="content-toolbar">
                <el-select v-model="videoModel" size="small" style="width: 150px; margin-right: 8px;">
                  <el-option label="CogVideoX 免费" value="cogvideox-flash" />
                  <el-option label="CogVideoX Pro" value="cogvideox" />
                  <el-option label="Seedance 2.0" value="seedance-2.0" disabled />
                  <el-option label="可灵 Kling" value="kling-3.0" disabled />
                  <el-option label="Sora 2" value="sora-2" disabled />
                  <el-option label="Vidu Q3" value="vidu-q3" disabled />
                </el-select>
                <el-button 
                  :type="selectedShotIds.length > 0 ? 'primary' : 'default'" 
                  @click="handleBatchGenerate"
                >
                  <el-icon><VideoPlay /></el-icon>
                  {{ selectedShotIds.length > 0 ? `生成选中视频 (${selectedShotIds.length})` : '生成所有视频' }}
                </el-button>
                <el-button 
                  v-if="selectedShotIds.length > 0"
                  type="danger" 
                  @click="handleBatchDeleteShot"
                >
                  <el-icon><Delete /></el-icon>
                  批量删除 ({{ selectedShotIds.length }})
                </el-button>
              </div>
              
              <!-- 时间轴编辑器 -->
              <div class="timeline-editor" v-loading="loadingVideos">
                <!-- 预览区域 -->
                <div class="preview-area">
                  <div class="preview-container">
                    <video 
                      v-if="timelineCurrentItem?.has_video && timelineCurrentItem?.video_url"
                      ref="timelineVideoRef"
                      class="preview-player"
                      :src="getAssetUrl(timelineCurrentItem.video_url)"
                      @ended="onTimelineVideoEnded"
                      @timeupdate="onTimelineVideoTimeUpdate"
                    ></video>
                    <img 
                      v-else-if="timelineCurrentItem?.thumbnail"
                      :src="getAssetUrl(timelineCurrentItem.thumbnail)" 
                      class="preview-image"
                      alt="预览"
                    />
                    <div v-else class="preview-placeholder">
                      <el-icon :size="48"><VideoPlay /></el-icon>
                      <span>选择镜头预览</span>
                    </div>
                  </div>
                  <!-- 播放控制条 -->
                  <div class="playback-controls">
                    <el-button 
                      :type="isTimelinePlaying ? 'warning' : 'primary'" 
                      size="small"
                      circle
                      @click="toggleTimelinePlay"
                    >
                      <el-icon v-if="isTimelinePlaying"><VideoPlay /></el-icon>
                      <el-icon v-else><VideoPlay /></el-icon>
                    </el-button>
                    <span class="time-display">
                      {{ formatTime(timelineCurrentTime) }} / {{ formatTime(timelineTotalDuration) }}
                    </span>
                    <span class="total-duration">总时长: {{ formatTimelineDuration(timelineTotalDuration) }}</span>
                  </div>
                </div>
                
                <!-- 工具栏 -->
                <div class="timeline-toolbar">
                  <div class="toolbar-left">
                    <span class="toolbar-title">时间轴</span>
                    <el-button size="small" @click="handleAddTransition" :disabled="!selectedTimelineItem">
                      <el-icon><Plus /></el-icon> 添加转场
                    </el-button>
                    <el-select v-model="selectedTransition" size="small" style="width: 100px;" placeholder="转场效果">
                      <el-option label="无" value="none" />
                      <el-option label="淡入淡出" value="fade" />
                      <el-option label="叠化" value="crossfade" />
                      <el-option label="滑动" value="slide" />
                    </el-select>
                  </div>
                  <div class="toolbar-right">
                    <el-button type="success" size="small" @click="handleMergeAll">
                      <el-icon><VideoPlay /></el-icon>
                      导出视频
                    </el-button>
                  </div>
                </div>
                
                <!-- 时间轴轨道 -->
                <div class="timeline-track-container" ref="timelineTrackRef">
                  <!-- 时间刻度 -->
                  <div class="time-ruler">
                    <div 
                      v-for="i in timelineScaleMarks" 
                      :key="i"
                      class="scale-mark"
                      :style="{ left: (i - 1) * pixelsPerSecond + 'px' }"
                    >
                      <span class="scale-label">{{ i }}s</span>
                    </div>
                  </div>
                  
                  <!-- 播放头 -->
                  <div class="playhead" :style="{ left: playheadPosition + 'px' }">
                    <div class="playhead-head"></div>
                    <div class="playhead-line"></div>
                  </div>
                  
                  <!-- 镜头轨道 -->
                  <div class="clips-track" @click="onTrackClick">
                    <div 
                      v-for="(item, index) in timelineItems" 
                      :key="item.id"
                      class="clip-item"
                      :class="{ 
                        selected: selectedTimelineItem?.id === item.id,
                        'has-video': item.has_video,
                        'has-audio': item.has_audio,
                        'is-image': !item.has_video
                      }"
                      :style="{ 
                        left: getClipLeft(index) + 'px',
                        width: getClipWidth(item.duration) + 'px'
                      }"
                      @click.stop="selectTimelineItem(item)"
                      @mousedown="startClipDrag($event, item, index)"
                    >
                      <!-- 左侧调整手柄 -->
                      <div 
                        class="resize-handle left"
                        @mousedown.stop="startResize($event, item, 'left')"
                      ></div>
                      
                      <!-- 缩略图 -->
                      <div class="clip-thumbnail">
                        <img v-if="item.thumbnail" :src="getAssetUrl(item.thumbnail)" alt="" />
                        <div v-else class="no-thumbnail">
                          <el-icon><Picture /></el-icon>
                        </div>
                      </div>
                      
                      <!-- 剪辑信息 -->
                      <div class="clip-info">
                        <span class="clip-number">{{ item.shot_number || index + 1 }}</span>
                        <span class="clip-duration">{{ item.duration }}s</span>
                      </div>
                      
                      <!-- 音频指示 -->
                      <div v-if="item.has_audio" class="audio-indicator"></div>
                      
                      <!-- 转场指示 -->
                      <div v-if="item.transition && item.transition !== 'none'" class="transition-indicator">
                        <el-icon><ArrowRight /></el-icon>
                      </div>
                      
                      <!-- 右侧调整手柄 -->
                      <div 
                        class="resize-handle right"
                        @mousedown.stop="startResize($event, item, 'right')"
                      ></div>
                    </div>
                  </div>
                </div>
                
                <!-- 空状态 -->
                <div v-if="!loadingVideos && timelineItems.length === 0" class="timeline-empty">
                  <el-empty description="暂无分镜数据，请先生成分镜">
                    <el-button type="primary" @click="handleTabChange('storyboard')">前往分镜</el-button>
                  </el-empty>
                </div>
              </div>
              
              <!-- 镜头详情面板 -->
              <div v-if="selectedTimelineItem" class="timeline-detail-panel">
                <div class="detail-header">
                  <h4>镜头 {{ selectedTimelineItem.shot_number || selectedTimelineItem.id }}</h4>
                  <el-button size="small" text @click="selectedTimelineItem = null">
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <div class="detail-content">
                  <div class="detail-thumbnail">
                    <img v-if="selectedTimelineItem.thumbnail" :src="getAssetUrl(selectedTimelineItem.thumbnail)" alt="" />
                  </div>
                  <div class="detail-info">
                    <div class="info-row">
                      <span class="label">时长:</span>
                      <el-input-number 
                        v-model="selectedTimelineItem.duration" 
                        :min="1" 
                        :max="10" 
                        size="small"
                        @change="updateTimelineItemDuration"
                      /> 秒
                    </div>
                    <div class="info-row">
                      <span class="label">状态:</span>
                      <el-tag :type="getVideoStatusType(selectedTimelineItem.video_status)" size="small">
                        {{ getVideoStatusText(selectedTimelineItem.video_status) }}
                      </el-tag>
                    </div>
                    <div class="info-row">
                      <span class="label">转场:</span>
                      <el-select v-model="selectedTimelineItem.transition" size="small" style="width: 100px;">
                        <el-option label="无" value="none" />
                        <el-option label="淡入淡出" value="fade" />
                        <el-option label="叠化" value="crossfade" />
                        <el-option label="滑动" value="slide" />
                      </el-select>
                    </div>
                  </div>
                  <div class="detail-actions">
                    <el-button size="small" type="primary" @click="handleGenerateSingle(selectedTimelineItem)">生成视频</el-button>
                    <el-button size="small" @click="handlePreviewTimelineItem">预览</el-button>
                  </div>
                </div>
              </div>
              
              <!-- 传统列表视图切换按钮 -->
              <div class="view-toggle">
                <el-button size="small" @click="showTimelineView = !showTimelineView">
                  <el-icon><View /></el-icon>
                  {{ showTimelineView ? '列表视图' : '时间轴视图' }}
                </el-button>
              </div>
              
              <!-- 传统列表视图（可切换显示） -->
              <div v-if="!showTimelineView" v-loading="loadingVideos" class="video-list">
                <el-table
                  :data="videoList"
                  stripe
                  style="width: 100%"
                  max-height="400"
                  highlight-current-row
                  @selection-change="handleSelectionChange"
                  @row-click="handleVideoTableRowClick"
                >
                  <el-table-column type="selection" width="40" />
                  <el-table-column label="场景" min-width="120" show-overflow-tooltip>
                    <template #default="{ row }">
                      {{ formatSceneColumn(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="镜号" width="64" align="center">
                    <template #default="{ row, $index }">
                      {{ row.shot_number ?? ($index + 1) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="shot_type" label="景别" width="80" align="center" />
                  <el-table-column label="时长" width="72" align="center">
                    <template #default="{ row }">{{ row.duration ?? 3 }}秒</template>
                  </el-table-column>
                  <el-table-column label="画面" min-width="120" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span class="desc-text">{{ row.visual_description || row.description || '—' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="图片" width="72" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.scene_image_url" type="success" size="small">有</el-tag>
                      <el-tag v-else type="info" size="small">无</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="视频" width="100" align="center">
                    <template #default="{ row }">
                      <el-tag :type="getVideoStatusType(row.video_status)" size="small">{{ getVideoStatusText(row.video_status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="配音" width="100" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.audio_url" type="success" size="small">已生成</el-tag>
                      <span v-else>—</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="200" align="center" fixed="right">
                    <template #default="{ row }">
                      <el-button size="small" @click.stop="handleGenerateSingle(row)">生成</el-button>
                      <el-button v-if="row.video_status === 'completed'" size="small" type="success" @click.stop="handlePreviewVideo(row)">预览</el-button>
                      <el-button size="small" type="danger" link @click.stop="handleDeleteShot(row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </el-tab-pane>

          <!-- 音频Tab -->
          <el-tab-pane label="音频" name="audio">
            <template #label>
              <span class="tab-label">
                <el-icon><Microphone /></el-icon>
                音频
              </span>
            </template>
            <div class="tab-content audio-content">
              <el-tabs v-model="audioTab" class="audio-sub-tabs">
                <!-- AI配音 -->
                <el-tab-pane label="AI配音" name="tts">
                  <div class="tts-container">
                    <!-- 子Tab切换 -->
                    <el-tabs v-model="voiceTab" class="voice-sub-tabs">
                      <!-- 镜头配音 -->
                      <el-tab-pane label="镜头配音" name="shots">
                        <div class="voice-section">
                          <!-- 配音设置区 -->
                          <div class="voice-settings">
                            <el-form label-width="80px" class="tts-form">
                              <el-form-item label="选择音色">
                                <el-select v-model="ttsForm.voiceId" placeholder="请选择音色" style="width: 100%">
                                  <el-option-group label="女声">
                                    <el-option
                                      v-for="voice in voiceList.filter(v => v.gender === 'female')"
                                      :key="voice.id"
                                      :label="voice.name"
                                      :value="voice.id"
                                    >
                                      <span>{{ voice.name }}</span>
                                      <span class="voice-desc">{{ voice.description || voice.style }}</span>
                                    </el-option>
                                  </el-option-group>
                                  <el-option-group label="男声">
                                    <el-option
                                      v-for="voice in voiceList.filter(v => v.gender === 'male')"
                                      :key="voice.id"
                                      :label="voice.name"
                                      :value="voice.id"
                                    >
                                      <span>{{ voice.name }}</span>
                                      <span class="voice-desc">{{ voice.description || voice.style }}</span>
                                    </el-option>
                                  </el-option-group>
                                </el-select>
                              </el-form-item>
                              
                              <!-- 情感风格选择 -->
                              <el-form-item label="情感风格">
                                <el-select v-model="ttsForm.emotion" placeholder="选择情感风格（可选）" clearable style="width: 100%">
                                  <el-option
                                    v-for="emotion in emotionList"
                                    :key="emotion.id"
                                    :label="emotion.name"
                                    :value="emotion.id"
                                  >
                                    <span>{{ emotion.name }}</span>
                                    <span class="voice-desc">{{ emotion.description }}</span>
                                  </el-option>
                                </el-select>
                              </el-form-item>
                              
                              <!-- 参数调节 -->
                              <div class="tts-params">
                                <el-form-item label="语速调节">
                                  <el-slider 
                                    v-model="ttsForm.rate" 
                                    :min="-50" 
                                    :max="50" 
                                    :step="10"
                                    show-input
                                    :format-tooltip="val => val + '%'"
                                  />
                                </el-form-item>
                                <el-form-item label="音量调节">
                                  <el-slider 
                                    v-model="ttsForm.volume" 
                                    :min="-50" 
                                    :max="50" 
                                    :step="10"
                                    show-input
                                    :format-tooltip="val => val + '%'"
                                  />
                                </el-form-item>
                                <el-form-item label="音调调节">
                                  <el-slider 
                                    v-model="ttsForm.pitch" 
                                    :min="-50" 
                                    :max="50" 
                                    :step="10"
                                    show-input
                                    :format-tooltip="val => val + 'Hz'"
                                  />
                                </el-form-item>
                              </div>
                              
                              <el-form-item>
                                <el-button type="primary" :loading="batchTTSLoading" @click="handleBatchTTS">
                                  <el-icon><Microphone /></el-icon>
                                  批量生成配音
                                </el-button>
                                <el-button @click="loadShotAudioStatus">
                                  <el-icon><Refresh /></el-icon>
                                  刷新状态
                                </el-button>
                              </el-form-item>
                            </el-form>
                          </div>
                          
                          <!-- 镜头配音列表 -->
                          <div class="shot-audio-list" v-loading="loadingShotAudio">
                            <div class="list-header">
                              <span class="header-title">镜头配音列表</span>
                              <span class="header-count">共 {{ shotAudioList.length }} 个镜头，{{ shotAudioList.filter(s => s.audio_url).length }} 个已配音</span>
                            </div>
                            <div class="list-content">
                              <div v-for="shot in shotAudioList" :key="shot.id" class="shot-audio-item">
                                <div class="shot-info">
                                  <span class="shot-number">{{ shot.shot_number }}</span>
                                  <div class="shot-detail">
                                    <span class="character-name">{{ shot.character_name || '未分配角色' }}</span>
                                    <span class="dialogue-preview">{{ (shot.dialogue || shot.original_text || '无台词').substring(0, 30) }}...</span>
                                  </div>
                                </div>
                                <div class="shot-voice">
                                  <el-tag v-if="shot.voice_name" size="small" type="info">{{ shot.voice_name }}</el-tag>
                                  <el-tag v-if="shot.tts_status === 'completed'" type="success" size="small">已生成</el-tag>
                                  <el-tag v-else-if="shot.tts_status === 'generating'" type="warning" size="small">生成中</el-tag>
                                  <el-tag v-else-if="shot.tts_status === 'failed'" type="danger" size="small">失败</el-tag>
                                  <el-tag v-else size="small">未生成</el-tag>
                                </div>
                                <div class="shot-actions">
                                  <el-button 
                                    size="small" 
                                    :type="currentPlayingShot === shot.id ? 'success' : 'primary'" 
                                    plain
                                    :disabled="!shot.audio_url"
                                    @click="handlePlayShotAudio(shot)"
                                  >
                                    <el-icon><VideoPlay v-if="currentPlayingShot !== shot.id" /><Close v-else /></el-icon>
                                    {{ currentPlayingShot === shot.id ? '停止' : '播放' }}
                                  </el-button>
                                  <el-button 
                                    size="small" 
                                    type="primary" 
                                    plain
                                    :disabled="!shot.dialogue && !shot.original_text"
                                    @click="handleShotTTS(shot)"
                                  >
                                    <el-icon><Microphone /></el-icon>
                                    生成
                                  </el-button>
                                  <el-button 
                                    size="small" 
                                    type="danger" 
                                    plain
                                    :disabled="!shot.audio_url"
                                    @click="handleDeleteShotAudio(shot)"
                                  >
                                    <el-icon><Delete /></el-icon>
                                  </el-button>
                                </div>
                              </div>
                              <el-empty v-if="shotAudioList.length === 0 && !loadingShotAudio" description="暂无镜头数据" />
                            </div>
                          </div>
                        </div>
                      </el-tab-pane>
                      
                      <!-- 角色音色绑定 -->
                      <el-tab-pane label="角色音色" name="characters">
                        <div class="voice-section">
                          <div class="list-header">
                            <span class="header-title">角色音色绑定</span>
                            <span class="header-count">为每个角色设置默认音色，配音时自动使用</span>
                          </div>
                          <div class="character-voice-list">
                            <div v-for="char in characters" :key="char.id" class="character-voice-item">
                              <div class="character-info">
                                <el-avatar :size="40" :src="char.image_url">{{ char.name?.charAt(0) }}</el-avatar>
                                <div class="character-detail">
                                  <span class="character-name">{{ char.name }}</span>
                                  <span class="character-desc">{{ char.description || '暂无描述' }}</span>
                                </div>
                              </div>
                              <div class="character-voice-select">
                                <el-select 
                                  :model-value="char.default_voice_id || ''"
                                  placeholder="选择默认音色"
                                  style="width: 200px"
                                  @change="(voiceId) => handleVoiceChange(char, voiceId)"
                                >
                                  <el-option-group label="女声">
                                    <el-option
                                      v-for="voice in voiceList.filter(v => v.gender === 'female')"
                                      :key="voice.id"
                                      :label="voice.name"
                                      :value="voice.id"
                                    >
                                      <span>{{ voice.name }}</span>
                                      <span class="voice-desc">{{ voice.description || voice.style }}</span>
                                    </el-option>
                                  </el-option-group>
                                  <el-option-group label="男声">
                                    <el-option
                                      v-for="voice in voiceList.filter(v => v.gender === 'male')"
                                      :key="voice.id"
                                      :label="voice.name"
                                      :value="voice.id"
                                    >
                                      <span>{{ voice.name }}</span>
                                      <span class="voice-desc">{{ voice.description || voice.style }}</span>
                                    </el-option>
                                  </el-option-group>
                                </el-select>
                                <el-tag v-if="char.default_voice_name" type="success" size="small">
                                  {{ char.default_voice_name }}
                                </el-tag>
                              </div>
                            </div>
                            <el-empty v-if="characters.length === 0" description="暂无角色，请先创建角色" />
                          </div>
                        </div>
                      </el-tab-pane>
                    </el-tabs>
                  </div>
                </el-tab-pane>
                
                <!-- 背景音乐 -->
                <el-tab-pane label="背景音乐" name="bgm">
                  <div class="audio-section">
                    <div class="section-toolbar">
                      <el-select v-model="bgmCategory" placeholder="筛选分类" clearable style="width: 150px">
                        <el-option label="全部" value="" />
                        <el-option label="浪漫" value="romantic" />
                        <el-option label="紧张" value="tension" />
                        <el-option label="欢快" value="happy" />
                        <el-option label="悲伤" value="sad" />
                        <el-option label="动作" value="action" />
                        <el-option label="奇幻" value="fantasy" />
                      </el-select>
                    </div>
                    <div v-loading="loadingBGM" class="preset-grid">
                      <div 
                        v-for="bgm in filteredBGMList" 
                        :key="bgm.id"
                        class="preset-item"
                        :class="{ active: selectedBGM?.id === bgm.id }"
                        @click="handleSelectBGM(bgm)"
                      >
                        <div class="preset-icon">
                          <el-icon><VideoCamera /></el-icon>
                        </div>
                        <div class="preset-info">
                          <span class="preset-name">{{ bgm.name }}</span>
                          <span class="preset-duration">{{ formatDuration(bgm.duration) }}</span>
                        </div>
                        <el-button v-if="bgm.audio_url" size="small" text @click.stop="playAudioPreview(bgm.audio_url)">
                          <el-icon><VideoPlay /></el-icon>
                          试听
                        </el-button>
                        <el-tag v-if="selectedBGM?.id === bgm.id" type="success" size="small">已选择</el-tag>
                      </div>
                    </div>
                    <div v-if="selectedBGM" class="bgm-controls">
                      <el-form-item label="音量">
                        <el-slider 
                          v-model="bgmVolume" 
                          :min="0" 
                          :max="1" 
                          :step="0.1"
                          style="width: 200px"
                        />
                      </el-form-item>
                      <el-button type="primary" :loading="bgmLoading" @click="handleApplyBGM">
                        应用背景音乐
                      </el-button>
                    </div>
                  </div>
                </el-tab-pane>
                
                <!-- 环境音效 -->
                <el-tab-pane label="环境音效" name="sfx">
                  <div class="audio-section">
                    <div class="section-toolbar">
                      <el-select v-model="sfxCategory" placeholder="筛选分类" clearable style="width: 150px">
                        <el-option label="全部" value="" />
                        <el-option label="天气" value="weather" />
                        <el-option label="自然" value="nature" />
                        <el-option label="室内" value="indoor" />
                        <el-option label="城市" value="urban" />
                        <el-option label="动作" value="action" />
                      </el-select>
                    </div>
                    <div v-loading="loadingSFX" class="preset-grid">
                      <div 
                        v-for="sfx in filteredSFXList" 
                        :key="sfx.id"
                        class="preset-item"
                        :class="{ active: selectedSFX?.id === sfx.id }"
                        @click="handleSelectSFX(sfx)"
                      >
                        <div class="preset-icon sfx-icon">
                          <el-icon><Bell /></el-icon>
                        </div>
                        <div class="preset-info">
                          <span class="preset-name">{{ sfx.name }}</span>
                          <span class="preset-duration">{{ formatDuration(sfx.duration) }}</span>
                        </div>
                        <el-button v-if="sfx.audio_url" size="small" text @click.stop="playAudioPreview(sfx.audio_url)">
                          <el-icon><VideoPlay /></el-icon>
                          试听
                        </el-button>
                        <el-tag v-if="selectedSFX?.id === sfx.id" type="success" size="small">已选择</el-tag>
                      </div>
                    </div>
                    <div v-if="selectedSFX" class="bgm-controls">
                      <el-form-item label="音量">
                        <el-slider 
                          v-model="sfxVolume" 
                          :min="0" 
                          :max="1" 
                          :step="0.1"
                          style="width: 200px"
                        />
                      </el-form-item>
                      <el-button type="primary" :loading="sfxLoading" @click="handleApplySFX">
                        应用环境音效
                      </el-button>
                    </div>
                  </div>
                </el-tab-pane>

                <!-- 音频库 -->
                <el-tab-pane label="音频库" name="library">
                  <div class="audio-library-container">
                    <div class="library-toolbar">
                      <el-radio-group v-model="libraryFilter" size="small">
                        <el-radio-button label="all">全部</el-radio-button>
                        <el-radio-button label="voice">配音</el-radio-button>
                        <el-radio-button label="bgm">BGM</el-radio-button>
                        <el-radio-button label="sfx">音效</el-radio-button>
                      </el-radio-group>
                      <div class="toolbar-right">
                        <el-select v-model="uploadType" size="small" style="width: 100px; margin-right: 10px">
                          <el-option label="配音" value="voice" />
                          <el-option label="BGM" value="bgm" />
                          <el-option label="音效" value="sfx" />
                        </el-select>
                        <el-upload
                          class="audio-uploader"
                          action="#"
                          :show-file-list="false"
                          :auto-upload="false"
                          :on-change="handleAudioUpload"
                        >
                          <el-button type="primary" size="small">
                            <el-icon><Upload /></el-icon>上传音频
                          </el-button>
                        </el-upload>
                      </div>
                    </div>

                    <div v-loading="loadingLibrary" class="library-list">
                      <div v-for="asset in filteredLibrary" :key="asset.id" class="library-item">
                        <div class="asset-icon">
                          <el-icon v-if="asset.audio_type === 'bgm'"><Headset /></el-icon>
                          <el-icon v-else-if="asset.audio_type === 'sfx'"><Bell /></el-icon>
                          <el-icon v-else><Microphone /></el-icon>
                        </div>
                        <div class="asset-info">
                          <div class="asset-name" :title="asset.filename">{{ asset.filename }}</div>
                          <div class="asset-meta">
                            <el-tag size="mini" :type="asset.audio_type === 'bgm' ? 'success' : (asset.audio_type === 'sfx' ? 'warning' : 'info')">
                              {{ asset.audio_type.toUpperCase() }}
                            </el-tag>
                            <span class="asset-duration">{{ asset.duration }}s</span>
                            <span class="asset-date">{{ formatDate(asset.created_at) }}</span>
                          </div>
                        </div>
                        <div class="asset-actions">
                          <el-button size="small" circle type="primary" plain @click="playAudioPreview(asset.file_path)">
                            <el-icon><VideoPlay /></el-icon>
                          </el-button>
                          <el-button size="small" circle type="danger" plain @click="handleDeleteAudioAsset(asset)">
                            <el-icon><Delete /></el-icon>
                          </el-button>
                        </div>
                      </div>
                      <el-empty v-if="!loadingLibrary && filteredLibrary.length === 0" description="暂无音频资产" />
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- AI生成剧本弹窗 -->
    <el-dialog v-model="showAiDialog" title="AI生成剧本" width="500px">
      <el-form :model="aiForm" label-width="80px">
        <el-form-item label="主题" required>
          <el-input v-model="aiForm.theme" placeholder="如：一个关于复仇的故事" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="aiForm.genre" placeholder="选择类型">
            <el-option label="都市" value="都市" />
            <el-option label="古装" value="古装" />
            <el-option label="悬疑" value="悬疑" />
            <el-option label="科幻" value="科幻" />
            <el-option label="校园" value="校园" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="设定">
          <el-input v-model="aiForm.setting" type="textarea" :rows="3" placeholder="可选：描述背景设定、角色关系等" />
        </el-form-item>
        <el-form-item label="场景数">
          <el-slider v-model="aiForm.episodeCount" :min="1" :max="5" :step="1" show-stops />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAiDialog = false">取消</el-button>
        <el-button type="primary" :loading="generatingAi" @click="handleAiGenerate">生成剧本</el-button>
      </template>
    </el-dialog>

    <!-- 创建/编辑角色弹窗 -->
    <el-dialog v-model="showCharacterDialog" :title="isEditingCharacter ? '编辑角色' : '创建角色'" width="650px">
      <el-form :model="charForm" label-width="90px" label-position="top">
        <el-tabs type="border-card">
          <el-tab-pane label="基本信息">
            <div class="form-row">
              <el-form-item label="角色名称" style="flex: 1">
                <el-input v-model="charForm.name" placeholder="输入角色名称，如：林风、阿空" />
              </el-form-item>
              <el-form-item label="性别" style="width: 100px">
                <el-select v-model="charForm.gender" clearable placeholder="选择">
                  <el-option label="男" value="男" />
                  <el-option label="女" value="女" />
                  <el-option label="其他" value="其他" />
                </el-select>
              </el-form-item>
            </div>
            <el-form-item label="身份/职业">
              <el-input v-model="charForm.occupation" placeholder="如：末世幸存者、大学生" />
            </el-form-item>
            <el-form-item label="角色描述">
              <el-input v-model="charForm.description" type="textarea" :rows="3" placeholder="请输入角色描述" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="多角度参考 (Ref2Video核心)">
            <div class="multi-angle-container">
              <div class="angle-item">
                <div class="angle-label">正面 (Front)</div>
                <el-upload
                  class="angle-uploader"
                  action="#"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleCharAngleChange(file, 'front')"
                >
                  <img v-if="charForm.front_image_url" :src="getAssetUrl(charForm.front_image_url)" class="angle-img" />
                  <el-icon v-else class="angle-icon"><Plus /></el-icon>
                </el-upload>
              </div>
              <div class="angle-item">
                <div class="angle-label">侧面 (Side)</div>
                <el-upload
                  class="angle-uploader"
                  action="#"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleCharAngleChange(file, 'side')"
                >
                  <img v-if="charForm.side_image_url" :src="getAssetUrl(charForm.side_image_url)" class="angle-img" />
                  <el-icon v-else class="angle-icon"><Plus /></el-icon>
                </el-upload>
              </div>
              <div class="angle-item">
                <div class="angle-label">背面 (Back)</div>
                <el-upload
                  class="angle-uploader"
                  action="#"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleCharAngleChange(file, 'back')"
                >
                  <img v-if="charForm.back_image_url" :src="getAssetUrl(charForm.back_image_url)" class="angle-img" />
                  <el-icon v-else class="angle-icon"><Plus /></el-icon>
                </el-upload>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="表情与换装预设">
            <div class="preset-section">
              <div class="section-header">
                <span>表情预设 (Expressions)</span>
                <el-button type="primary" link @click="addPreset('expression')">添加表情</el-button>
              </div>
              <div class="preset-list">
                <div v-for="(exp, idx) in charForm.expressions" :key="idx" class="preset-item">
                  <el-input v-model="exp.name" placeholder="名称" size="small" style="width: 80px" />
                  <el-upload
                    class="preset-uploader"
                    action="#"
                    :show-file-list="false"
                    :auto-upload="false"
                    :on-change="(file) => handlePresetImageChange(file, 'expression', idx)"
                  >
                    <img v-if="exp.url" :src="getAssetUrl(exp.url)" class="preset-img" />
                    <el-icon v-else><Plus /></el-icon>
                  </el-upload>
                  <el-button type="danger" link :icon="Delete" @click="charForm.expressions.splice(idx, 1)" />
                </div>
              </div>
            </div>
            <el-divider />
            <div class="preset-section">
              <div class="section-header">
                <span>换装预设 (Costumes)</span>
                <el-button type="primary" link @click="addPreset('costume')">添加服装</el-button>
              </div>
              <div class="preset-list">
                <div v-for="(cos, idx) in charForm.costumes" :key="idx" class="preset-item">
                  <el-input v-model="cos.name" placeholder="名称" size="small" style="width: 80px" />
                  <el-upload
                    class="preset-uploader"
                    action="#"
                    :show-file-list="false"
                    :auto-upload="false"
                    :on-change="(file) => handlePresetImageChange(file, 'costume', idx)"
                  >
                    <img v-if="cos.url" :src="getAssetUrl(cos.url)" class="preset-img" />
                    <el-icon v-else><Plus /></el-icon>
                  </el-upload>
                  <el-button type="danger" link :icon="Delete" @click="charForm.costumes.splice(idx, 1)" />
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <el-button @click="showCharacterDialog = false">取消</el-button>
        <el-button type="primary" :loading="creatingCharacter" @click="handleSaveCharacter">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑剧本弹窗 -->
    <el-dialog v-model="showEditScriptDialog" title="编辑剧本" width="600px">
      <el-form :model="editScriptForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="editScriptForm.title" placeholder="剧本标题" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="editScriptForm.content"
            type="textarea"
            :rows="10"
            placeholder="剧本内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditScriptDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingScript" @click="handleSaveScript">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分镜详情弹窗 -->
    <el-dialog v-model="showShotDetailDialog" title="分镜详情" width="700px">
      <el-form v-if="currentShot" :model="currentShot" label-width="100px" label-position="top">
        <div class="form-row">
          <el-form-item label="镜头编号" style="width: 120px">
            <el-input v-model="currentShot.shot_number" disabled />
          </el-form-item>
          <el-form-item label="景别" style="flex: 1">
          <el-select v-model="currentShot.shot_type" placeholder="选择景别">
            <el-option label="全景" value="全景" />
            <el-option label="中景" value="中景" />
            <el-option label="近景" value="近景" />
            <el-option label="特写" value="特写" />
            <el-option label="大特写" value="大特写" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="关联角色 (参考图)">
        <div class="char-select-row">
          <el-select v-model="currentShot.character_id" placeholder="选择角色" clearable style="flex: 1">
            <el-option
              v-for="char in characters"
              :key="char.id"
              :label="char.name"
              :value="char.id"
            >
              <div class="char-option">
                <el-avatar :size="24" :src="getAssetUrl(char.front_image_url || char.image_url || char.reference_image)" />
                <span style="margin-left: 8px">{{ char.name }}</span>
              </div>
            </el-option>
          </el-select>
          <el-select 
            v-if="currentShot.character_id" 
            v-model="currentShot.character_angle" 
            placeholder="角度" 
            style="width: 100px; margin-left: 10px"
          >
            <el-option label="正面" value="front" />
            <el-option label="侧面" value="side" />
            <el-option label="背面" value="back" />
          </el-select>
        </div>
        <div v-if="currentShot.character_id && currentShot.character_angle" class="char-ref-preview">
          <img :src="getAssetUrl(getShotCharRef(currentShot))" alt="参考图预览" />
        </div>
      </el-form-item>
      <el-form-item label="运镜方式">
          <el-select v-model="currentShot.camera_movement" placeholder="选择运镜方式">
            <el-option label="固定" value="固定" />
            <el-option label="推镜头" value="推镜头" />
            <el-option label="拉镜头" value="拉镜头" />
            <el-option label="摇镜头" value="摇镜头" />
            <el-option label="移镜头" value="移镜头" />
          </el-select>
        </el-form-item>
        <el-form-item label="画面描述">
          <el-input
            v-model="currentShot.visual_description"
            type="textarea"
            :rows="4"
            placeholder="描述这个镜头的画面内容..."
          />
        </el-form-item>
        <el-form-item label="台词/旁白">
          <el-input
            v-model="currentShot.dialogue"
            type="textarea"
            :rows="2"
            placeholder="角色台词或旁白内容..."
          />
        </el-form-item>
        
        <!-- 展示配音信息 -->
        <div v-if="currentShot.audio_url" class="detail-item-voice">
          <div class="voice-label">配音状态:</div>
          <div class="voice-info">
            <el-tag size="small" type="success">已生成</el-tag>
            <el-button size="small" link type="primary" @click="playAudioPreview(currentShot.audio_url)">
              <el-icon><VideoPlay /></el-icon>试听
            </el-button>
            <el-button 
              v-if="currentShot.video_url" 
              size="small" 
              type="warning" 
              :loading="currentShot.lip_sync_status === 'processing'"
              @click="handleLipSync"
            >
              <el-icon><ChatDotRound /></el-icon>
              {{ currentShot.lip_sync_status === 'completed' ? '重新同步口型' : '口型同步' }}
            </el-button>
            <el-button size="small" type="info" plain @click="showShotAudioLibrary = true">
              <el-icon><Headset /></el-icon>从库选择
            </el-button>
          </div>
          <div v-if="currentShot.lip_sync_status === 'processing'" class="lipsync-mini-status">
            <el-icon class="is-loading"><Loading /></el-icon>
            正在同步口型...
          </div>
        </div>

        <el-form-item label="时长(秒)">
          <el-input-number v-model="currentShot.duration" :min="1" :max="60" />
        </el-form-item>
        <el-form-item label="场景参考图 (图生视频)">
          <div class="shot-ref-upload-container">
            <el-upload
              class="shot-ref-uploader"
              action="#"
              :show-file-list="false"
              :auto-upload="false"
              :on-change="handleShotDetailRefChange"
            >
              <el-image v-if="currentShot.reference_image_url" :src="getAssetUrl(currentShot.reference_image_url)" fit="cover" :preview-src-list="[getAssetUrl(currentShot.reference_image_url)]" preview-teleported class="shot-ref-preview-img" />
              <div v-else class="shot-ref-upload-placeholder">
                <el-icon><Plus /></el-icon>
                <span>上传场景参考图</span>
              </div>
            </el-upload>
            <el-button v-if="currentShot.reference_image_url" type="danger" link @click="currentShot.reference_image_url = ''">清除</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="danger" plain @click="handleDeleteShotFromDialog">删除镜头</el-button>
        <el-button @click="showShotDetailDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingShot" @click="handleSaveShot">保存</el-button>
      </template>
    </el-dialog>

    <!-- 场景详情：查看 / 编辑正文 -->
    <el-dialog v-model="showSceneDetailDialog" title="场景详情" width="680px">
      <el-form v-if="currentScene" :model="currentScene" label-width="96px" label-position="top">
        <el-form-item label="场景编号">
          <el-input v-model="currentScene.scene_number" disabled />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="currentScene.title" placeholder="场景标题" />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="currentScene.location" placeholder="如：咖啡厅" />
        </el-form-item>
        <el-form-item label="时间">
          <el-input v-model="currentScene.time_of_day" placeholder="如：夜晚" />
        </el-form-item>
        <el-form-item label="出场角色">
          <el-input v-model="currentScene.characters" type="textarea" :rows="2" placeholder="出场角色" />
        </el-form-item>
        <el-form-item label="场景正文">
          <el-input
            v-model="currentScene.content"
            type="textarea"
            :rows="14"
            placeholder="剧本段落..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSceneDetailDialog = false">关闭</el-button>
        <el-button type="primary" :loading="savingScene" @click="handleSaveScene">保存修改</el-button>
      </template>
    </el-dialog>

    <!-- 从音频库选择配音弹窗 -->
    <el-dialog v-model="showShotAudioLibrary" title="从音频库选择配音" width="600px" append-to-body>
      <div class="shot-audio-library">
        <div class="library-toolbar">
          <el-radio-group v-model="shotLibraryFilter" size="small">
            <el-radio-button label="voice">配音</el-radio-button>
            <el-radio-button label="all">全部</el-radio-button>
          </el-radio-group>
        </div>
        <div class="library-list-mini">
          <div 
            v-for="asset in filteredShotLibrary" 
            :key="asset.id" 
            class="library-item-mini"
            :class="{ active: currentShot.audio_url === asset.file_path }"
            @click="handleSelectShotAudio(asset)"
          >
            <div class="asset-info">
              <div class="asset-name">{{ asset.filename }}</div>
              <div class="asset-meta">{{ asset.duration }}s | {{ formatDate(asset.created_at) }}</div>
            </div>
            <div class="asset-actions">
              <el-button size="small" circle type="primary" link @click.stop="playAudioPreview(asset.file_path)">
                <el-icon><VideoPlay /></el-icon>
              </el-button>
              <el-tag v-if="currentShot.audio_url === asset.file_path" type="success" size="small">当前使用</el-tag>
            </div>
          </div>
          <el-empty v-if="filteredShotLibrary.length === 0" description="库中暂无可用音频" />
        </div>
      </div>
      <template #footer>
        <el-button @click="showShotAudioLibrary = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 一键成片进度弹窗 -->
    <el-dialog 
      v-model="showAutoGenDialog" 
      title="正在为您一键成片" 
      width="500px" 
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div class="auto-gen-progress">
        <div class="progress-info">
          <div class="current-step">{{ autoGenStatus.message || '正在准备中...' }}</div>
          <div class="percentage">{{ autoGenStatus.progress || 0 }}%</div>
        </div>
        <el-progress 
          :percentage="autoGenStatus.progress || 0" 
          :status="autoGenStatus.status === 'failed' ? 'exception' : (autoGenStatus.status === 'completed' ? 'success' : '')"
          :stroke-width="15" 
          striped 
          striped-flow 
        />
        <div class="auto-gen-tips">
          <el-icon><InfoFilled /></el-icon>
          <span>这可能需要几分钟时间，请勿关闭窗口</span>
        </div>
      </div>
      <template #footer>
        <div v-if="autoGenStatus.status === 'completed' || autoGenStatus.status === 'failed'">
          <el-button @click="showAutoGenDialog = false">关闭</el-button>
          <el-button v-if="autoGenStatus.status === 'completed'" type="success" @click="goToVideoTab">查看成品</el-button>
          <el-button v-if="autoGenStatus.status === 'failed'" type="primary" @click="handleAutoGenerate">重试</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showExportDialog"
      title="导出成片"
      width="520px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form label-width="110px">
        <el-form-item label="分辨率">
          <el-radio-group v-model="exportForm.resolution">
            <el-radio-button label="720p">720p</el-radio-button>
            <el-radio-button label="1080p">1080p</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="格式">
          <el-select v-model="exportForm.format" style="width: 160px" disabled>
            <el-option label="MP4" value="mp4" />
          </el-select>
        </el-form-item>
        <el-form-item label="包含音频">
          <el-checkbox v-model="exportForm.includeVoice">配音</el-checkbox>
          <el-checkbox v-model="exportForm.includeBgm">BGM</el-checkbox>
        </el-form-item>
      </el-form>

      <div v-if="exportStatus.exportId" class="export-progress">
        <div class="progress-info">
          <div class="current-step">
            {{
              exportStatus.status === 'completed'
                ? '导出完成'
                : exportStatus.status === 'failed'
                  ? '导出失败'
                  : '正在导出...'
            }}
          </div>
          <div class="percentage">{{ exportStatus.progress || 0 }}%</div>
        </div>
        <el-progress
          :percentage="exportStatus.progress || 0"
          :status="exportStatus.status === 'failed' ? 'exception' : (exportStatus.status === 'completed' ? 'success' : '')"
          :stroke-width="15"
          striped
          striped-flow
        />
        <div v-if="exportStatus.status === 'completed'" class="export-download">
          <el-button type="success" @click="handleDownloadExport">下载MP4</el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="showExportDialog = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="isExporting"
          :disabled="!userStore.currentProject?.id || (exportStatus.exportId && exportStatus.status === 'processing')"
          @click="submitExport"
        >
          开始导出
        </el-button>
      </template>
    </el-dialog>

    <!-- 角色详情弹窗（选中角色时显示） -->
    <el-dialog v-model="showCharacterDetail" title="角色详情" width="680px" :close-on-click-modal="true">
      <div v-if="selectedCharacter" class="character-detail-dialog">
        <div class="character-avatar-large">
          <img :src="getAssetUrl(selectedCharacter.front_image_url || selectedCharacter.image_url || selectedCharacter.reference_image)" :alt="selectedCharacter.name" />
        </div>
        <div class="character-info">
          <h3>{{ selectedCharacter.name }}</h3>
          <div class="char-tags-large">
            <el-tag v-if="selectedCharacter.gender" type="info">{{ selectedCharacter.gender }}</el-tag>
            <el-tag v-if="selectedCharacter.occupation" type="warning">{{ selectedCharacter.occupation }}</el-tag>
            <el-tag v-if="selectedCharacter.identity_anchors && Object.keys(selectedCharacter.identity_anchors).length > 0" type="success" effect="dark">已校准</el-tag>
            <el-tag v-else type="danger">未校准</el-tag>
          </div>
          <p v-if="selectedCharacter.description" class="char-desc">{{ selectedCharacter.description }}</p>
          
          <!-- 多角度展示 -->
          <div class="angles-display">
            <h5>角度参考</h5>
            <div class="angles-grid">
              <div class="angle-thumb" :class="{ 'has-image': selectedCharacter.front_image_url }">
                <img v-if="selectedCharacter.front_image_url" :src="getAssetUrl(selectedCharacter.front_image_url)" />
                <div v-else class="thumb-empty" @click="handleGenerateCharView(selectedCharacter, 'front')" title="点击生成">正</div>
                <span>正面</span>
                <el-button v-if="!selectedCharacter.front_image_url" size="mini" type="primary" @click.stop="handleGenerateCharView(selectedCharacter, 'front')">生成</el-button>
              </div>
              <div class="angle-thumb" :class="{ 'has-image': selectedCharacter.side_image_url }">
                <img v-if="selectedCharacter.side_image_url" :src="getAssetUrl(selectedCharacter.side_image_url)" />
                <div v-else class="thumb-empty" @click="handleGenerateCharView(selectedCharacter, 'side')" title="点击生成">侧</div>
                <span>侧面</span>
                <el-button v-if="!selectedCharacter.side_image_url" size="mini" type="success" @click.stop="handleGenerateCharView(selectedCharacter, 'side')">生成</el-button>
              </div>
              <div class="angle-thumb" :class="{ 'has-image': selectedCharacter.back_image_url }">
                <img v-if="selectedCharacter.back_image_url" :src="getAssetUrl(selectedCharacter.back_image_url)" />
                <div v-else class="thumb-empty" @click="handleGenerateCharView(selectedCharacter, 'back')" title="点击生成">背</div>
                <span>背面</span>
                <el-button v-if="!selectedCharacter.back_image_url" size="mini" type="warning" @click.stop="handleGenerateCharView(selectedCharacter, 'back')">生成</el-button>
              </div>
            </div>
          </div>

          <!-- 表情与换装 -->
          <div v-if="selectedCharacter.expressions?.length" class="presets-display">
            <h5>表情预设</h5>
            <div class="presets-grid">
              <div v-for="exp in selectedCharacter.expressions" :key="exp.name" class="preset-thumb">
                <img :src="getAssetUrl(exp.url)" />
                <span>{{ exp.name }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedCharacter.costumes?.length" class="presets-display">
            <h5>换装预设</h5>
            <div class="presets-grid">
              <div v-for="cos in selectedCharacter.costumes" :key="cos.name" class="preset-thumb">
                <img :src="getAssetUrl(cos.url)" />
                <span>{{ cos.name }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="character-actions">
          <el-button type="primary" @click="handleEditCharacter(selectedCharacter)">编辑角色</el-button>
          <el-select v-model="charImageStyle" size="default" style="width: 130px; margin-right: 8px;">
            <el-option label="日系动漫" value="anime" />
            <el-option label="国风仙侠" value="chinese_fantasy" />
            <el-option label="赛博朋克" value="cyberpunk" />
            <el-option label="写实风格" value="realistic" />
            <el-option label="吉卜力" value="ghibli" />
            <el-option label="美漫风格" value="american_comic" />
          </el-select>
          <el-button type="success" @click="handleGenCharImage(selectedCharacter)" :loading="generatingImage[selectedCharacter.id]">
            <el-icon><Picture /></el-icon>
            {{ generatingImage[selectedCharacter.id] ? '生成中...' : 'AI生成三视图' }}
          </el-button>
          <el-button type="warning" @click="handleCalibrateCharacter(selectedCharacter)" :loading="calibratingCharacter[selectedCharacter.id]">
            <el-icon><MagicStick /></el-icon>
            AI校准
          </el-button>
          <el-button type="info" @click="showVariationsDialog(selectedCharacter)">
            <el-icon><Grid /></el-icon>
            变体管理
          </el-button>
        </div>
        <!-- 多视角生成已合并到"AI生成三视图"按钮，无需单独生成 -->
        <!-- 6层锚点展示 -->
        <div v-if="selectedCharacter.identity_anchors" class="anchors-display">
          <h5>6层身份锚点</h5>
          <div class="anchors-grid">
            <div class="anchor-item" v-if="selectedCharacter.identity_anchors.gender">
              <span class="anchor-label">性别</span>
              <span class="anchor-value">{{ selectedCharacter.identity_anchors.gender }}</span>
            </div>
            <div class="anchor-item" v-if="selectedCharacter.identity_anchors.age">
              <span class="anchor-label">年龄</span>
              <span class="anchor-value">{{ selectedCharacter.identity_anchors.age }}</span>
            </div>
            <div class="anchor-item" v-if="selectedCharacter.identity_anchors.physique">
              <span class="anchor-label">体型</span>
              <span class="anchor-value">{{ selectedCharacter.identity_anchors.physique }}</span>
            </div>
            <div class="anchor-item" v-if="selectedCharacter.identity_anchors.face">
              <span class="anchor-label">面部</span>
              <span class="anchor-value">{{ selectedCharacter.identity_anchors.face }}</span>
            </div>
            <div class="anchor-item" v-if="selectedCharacter.identity_anchors.hair">
              <span class="anchor-label">发型</span>
              <span class="anchor-value">{{ selectedCharacter.identity_anchors.hair }}</span>
            </div>
            <div class="anchor-item" v-if="selectedCharacter.identity_anchors.clothing">
              <span class="anchor-label">服饰</span>
              <span class="anchor-value">{{ selectedCharacter.identity_anchors.clothing }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- ===== 问题5修复：右侧Tab面板 - 角色和视频预览 ===== -->
    <div class="content-right" v-if="showVideoPlayer">
      <div class="right-panel">
        <div class="panel-content">
          <!-- 视频预览（选中镜头时自动显示） -->
          <div v-if="currentPreviewVideo" class="video-preview-panel">
            <h4 class="panel-title">
              <span><el-icon><VideoPlay /></el-icon> 镜头 {{ currentPreviewVideo.shot_number || '预览' }}</span>
              <el-button size="small" text @click="currentPreviewVideo = null">
                <el-icon><Close /></el-icon>
              </el-button>
            </h4>
            <div class="video-player-container" @click="toggleVideoPlay">
              <video 
                v-if="currentPreviewVideo.video_url || currentPreviewVideo.result_url"
                :src="getAssetUrl(currentPreviewVideo.video_url || currentPreviewVideo.result_url)"
                controls
                preload="metadata"
                class="preview-video"
                :poster="getAssetUrl(currentPreviewVideo.thumbnail)"
              >
                您的浏览器不支持视频播放
              </video>
              <div v-else class="no-video-placeholder">
                <el-icon><VideoPlay /></el-icon>
                <p>暂无视频文件</p>
              </div>
            </div>
            <div class="video-info">
              <div class="info-item">
                <span class="label">景别：</span>
                <span class="value">{{ currentPreviewVideo.shot_type || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">运镜：</span>
                <span class="value">{{ currentPreviewVideo.camera_movement || '固定' }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态：</span>
                <el-tag :type="getVideoStatusType(currentPreviewVideo.video_status)" size="small">
                  {{ getVideoStatusText(currentPreviewVideo.video_status) }}
                </el-tag>
              </div>
            </div>
            <div class="video-actions">
              <el-button type="primary" @click="handleRegenerate(currentPreviewVideo)">重新生成</el-button>
              <el-button type="success" @click="handleDownloadVideo(currentPreviewVideo)">下载视频</el-button>
            </div>
          </div>

          <!-- v5.0 角色变体管理弹窗 -->
    <el-dialog v-model="showVariationsDialogFlag" title="角色变体管理" width="700px">
      <div class="variations-header">
        <el-button type="primary" @click="handleCreateVariation">
          <el-icon><Plus /></el-icon>
          添加变体
        </el-button>
      </div>
      <el-table :data="currentCharacterVariations" style="width: 100%" v-loading="loadingVariations">
        <el-table-column prop="name" label="变体名称" width="120" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_stage_variation ? 'warning' : 'success'" size="small">
              {{ row.is_stage_variation ? '阶段变体' : '换装变体' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="episode_range" label="集数范围" width="100" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleCompileVariationPrompt(row)">编译提示词</el-button>
            <el-button size="small" type="danger" link @click="handleDeleteVariation(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- v5.0 创建/编辑变体弹窗 -->
    <el-dialog v-model="showVariationFormDialog" :title="editingVariation ? '编辑变体' : '创建变体'" width="500px">
      <el-form :model="variationForm" label-width="100px">
        <el-form-item label="变体名称">
          <el-input v-model="variationForm.name" placeholder="如：日常装、少年时期" />
        </el-form-item>
        <el-form-item label="变体类型">
          <el-radio-group v-model="variationForm.is_stage_variation">
            <el-radio :value="false">换装变体</el-radio>
            <el-radio :value="true">阶段变体</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="variationForm.is_stage_variation" label="年龄描述">
          <el-input v-model="variationForm.age_description" placeholder="如：少年时期" />
        </el-form-item>
        <el-form-item v-if="variationForm.is_stage_variation" label="阶段描述">
          <el-input v-model="variationForm.stage_description" placeholder="如：第一次变身" />
        </el-form-item>
        <el-form-item label="集数范围">
          <el-input v-model="variationForm.episode_range" placeholder="如：1-10" />
        </el-form-item>
        <el-form-item label="变体描述">
          <el-input v-model="variationForm.description" type="textarea" :rows="2" placeholder="变体描述" />
        </el-form-item>
        <el-form-item label="视觉提示词(中)">
          <el-input v-model="variationForm.visual_prompt_zh" type="textarea" :rows="2" placeholder="中文视觉提示词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showVariationFormDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveVariation" :loading="savingVariation">保存</el-button>
      </template>
    </el-dialog>

    <div v-if="!currentPreviewVideo && !selectedCharacter" class="empty-panel">
            <el-empty description="点击预览按钮查看详情" />
          </div>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  scriptsAPI,
  charactersAPI,
  scenesAPI,
  shotsAPI,
  videosAPI,
  audioAPI,
  exportsAPI,
  taskJobsAPI,
  userAPI,
  projectsAPI,
  imagesAPI,
  ttsAPI,
  getAssetUrl
} from '../api/index'
import {
  Reading,
  QuestionFilled,
  Bell,
  Star,
  PictureFilled,
  Picture,
  Coin,
  Document,
  Grid,
  VideoPlay,
  Download,
  Clock,
  MagicStick,
  Upload,
  ChatDotRound,
  Search,
  Plus,
  Loading,
  Close,
  User,
  Microphone,
  Select,
  VideoCamera,
  Edit,
  Delete,
  View,
  Monitor,
  InfoFilled,
  Headset,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Refresh,
} from '@element-plus/icons-vue'

const props = defineProps({
  activeTab: {
    type: String,
    default: 'script'
  }
})

const emit = defineEmits(['tab-change'])
const router = useRouter()

// 一键成片相关状态
const isAutoGenerating = ref(false)
const showAutoGenDialog = ref(false)
const autoGenStatus = reactive({
  progress: 0,
  message: '',
  status: 'pending',
  jobId: null
})
let autoGenTimer = null

const showExportDialog = ref(false)
const isExporting = ref(false)
const exportForm = reactive({
  resolution: '1080p',
  format: 'mp4',
  includeVoice: true,
  includeBgm: true
})
const exportStatus = reactive({
  exportId: null,
  status: 'pending',
  progress: 0,
  filePath: '',
  downloadUrl: ''
})
let exportTimer = null

const resetExportState = () => {
  exportStatus.exportId = null
  exportStatus.status = 'pending'
  exportStatus.progress = 0
  exportStatus.filePath = ''
  exportStatus.downloadUrl = ''
}

const startPollingExport = () => {
  if (exportTimer) clearInterval(exportTimer)
  exportTimer = setInterval(async () => {
    try {
      if (!exportStatus.exportId) return
      const res = await exportsAPI.getStatus(exportStatus.exportId)
      if (res.success && res.data) {
        exportStatus.status = res.data.status
        exportStatus.progress = res.data.progress || 0
        exportStatus.filePath = res.data.file_path || res.data.file_url || ''
        exportStatus.downloadUrl = res.data.download_url || ''
        if (exportStatus.status === 'completed' || exportStatus.status === 'failed') {
          clearInterval(exportTimer)
          exportTimer = null
          isExporting.value = false
          if (exportStatus.status === 'completed') {
            ElMessage.success('导出完成，可下载成片')
          } else {
            ElMessage.error('导出失败，请稍后重试')
          }
        }
      }
    } catch (err) {
      console.error('轮询导出状态失败:', err)
    }
  }, 1500)
}

const submitExport = async () => {
  if (!userStore.currentProject?.id) {
    ElMessage.warning('请先选择项目')
    return
  }
  try {
    isExporting.value = true
    resetExportState()
    const res = await exportsAPI.create({
      project_id: userStore.currentProject.id,
      config: {
        resolution: exportForm.resolution,
        format: exportForm.format,
        include_voice: exportForm.includeVoice,
        include_bgm: exportForm.includeBgm
      }
    })
    if (res.success) {
      exportStatus.exportId = res.data.export_id
      exportStatus.status = 'processing'
      exportStatus.progress = 0
      startPollingExport()
    }
  } catch (err) {
    console.error('导出失败:', err)
    isExporting.value = false
    ElMessage.error('导出失败: ' + (err.response?.data?.message || err.message))
  }
}

const handleDownloadExport = () => {
  if (!exportStatus.exportId) return
  const url = exportStatus.downloadUrl || `/api/exports/${exportStatus.exportId}/download`
  window.open(getAssetUrl(url), '_blank')
}

const handleAutoGenerate = async () => {
  if (!userStore.currentProject?.id) return
  
  try {
    const res = await projectsAPI.autoGenerate(userStore.currentProject.id)
    if (res.success) {
      autoGenStatus.jobId = res.data.job_id
      autoGenStatus.progress = 0
      autoGenStatus.message = '正在启动一键成片...'
      autoGenStatus.status = 'active'
      showAutoGenDialog.value = true
      isAutoGenerating.value = true
      
      // 开始轮询进度
      startPollingAutoGen()
      userStore.fetchCredits() // 刷新积分余额
    }
  } catch (err) {
    console.error('一键成片启动失败:', err)
    ElMessage.error(err.response?.data?.message || '启动失败，请检查是否已上传剧本')
  }
}

const startPollingAutoGen = () => {
  if (autoGenTimer) clearInterval(autoGenTimer)
  
  autoGenTimer = setInterval(async () => {
    try {
      const res = await taskJobsAPI.get(autoGenStatus.jobId)
      if (res.success && res.data) {
        const { status, progress, result } = res.data
        autoGenStatus.status = status
        autoGenStatus.progress = progress
        autoGenStatus.message = result?.message || (status === 'active' ? '正在处理中...' : '')
        
        if (status === 'completed' || status === 'failed') {
          clearInterval(autoGenTimer)
          isAutoGenerating.value = false
          if (status === 'completed') {
            ElMessage.success('一键成片任务提交完成！视频正在后台持续渲染中。')
            // 刷新数据
            loadAllData()
          } else {
            ElMessage.error('一键成片部分环节失败，请手动检查')
          }
        }
      }
    } catch (err) {
      console.error('轮询一键成片进度失败:', err)
    }
  }, 2000)
}

const goToVideoTab = () => {
  showAutoGenDialog.value = false
  emit('tab-change', 'video')
}

// 确保在组件卸载时清理定时器
onUnmounted(() => {
  if (autoGenTimer) clearInterval(autoGenTimer)
  if (exportTimer) clearInterval(exportTimer)
})
const userStore = useUserStore()

// ==================== 项目信息 ====================
const projectName = computed(() => userStore.currentProject?.name || '未选择项目')
const hasProject = computed(() => !!userStore.currentProject?.id)
const projectCover = ref('')
const scriptCount = ref(0)
const sceneCount = ref(0)
const shotCount = ref(0)
const progressPercent = computed(() => Math.min(Math.round((sceneCount.value / 10) * 100), 100))
const statusType = computed(() => sceneCount.value > 0 ? 'success' : 'info')
const statusText = computed(() => sceneCount.value > 0 ? '创作中' : '待开始')
const lastUpdateTime = ref('')

// 活跃Tab
const activeTab = ref('script')

// 监听props变化
watch(() => props.activeTab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab
    loadTabData(newTab)
  }
})

// ==================== 剧本相关 ====================
const loadingScripts = ref(false)
const scriptSearch = ref('')
const scripts = ref([])
const showAiDialog = ref(false)
const generatingAi = ref(false)
const showEditScriptDialog = ref(false)
const savingScript = ref(false)
const currentEditingScript = ref(null)

const aiForm = reactive({
  theme: '',
  genre: '都市',
  setting: '',
  episodeCount: 3
})

const editScriptForm = reactive({
  title: '',
  content: ''
})

const filteredScripts = computed(() => {
  if (!scriptSearch.value) return scripts.value
  return scripts.value.filter(s => s.title?.includes(scriptSearch.value))
})

// ==================== 角色相关 ====================
const loadingCharacters = ref(false)
const characterSearch = ref('')
const characters = ref([])
const showCharacterDialog = ref(false)
const showCharacterDetail = ref(false)  // 角色详情弹窗
const charImageStyle = ref('anime')  // 三视图风格选择

// 监听角色详情弹窗关闭，清空选中角色
watch(showCharacterDetail, (val) => {
  if (!val) {
    selectedCharacter.value = null
  }
})
const creatingCharacter = ref(false)
const generatingImage = reactive({})
const generatingShotImage = reactive({})
const batchGenerating = ref(false)
const batchProgress = ref({ current: 0, total: 0 })
const batchCancelled = ref(false)
const generatingSceneImage = reactive({})
const generatingCharView = reactive({})
const calibratingCharacter = reactive({})
const cogVideoTaskIds = ref({})
const cogVideoTaskTimers = ref({})

// 视频模型选择
const videoModel = ref('cogvideox-flash')

// 生图尺寸选择（语义化key）
const shotImageSize = ref('landscape_16_9')
const shotImageSizes = ref({}) // 每个分镜的独立尺寸 { shotId: sizeKey }
const IMAGE_SIZE_MAP = {
  square_1_1: { label: '正方形 1:1', value: '1024x1024' },
  landscape_16_9: { label: '横屏 16:9', value: '1344x768' },
  landscape_4_3: { label: '横屏 4:3', value: '1152x864' },
  landscape_2_1: { label: '横屏 2:1', value: '1440x720' },
  portrait_9_16: { label: '竖屏 9:16', value: '768x1344' },
  portrait_3_4: { label: '竖屏 3:4', value: '864x1152' },
}
// 获取分镜的生图尺寸（优先使用分镜级别，否则使用全局）
function getShotImageSize(shotId) {
  return shotImageSizes.value[shotId] || shotImageSize.value
}
// 设置分镜的生图尺寸
function setShotImageSize(shotId, sizeKey) {
  shotImageSizes.value[shotId] = sizeKey
}
const isEditingCharacter = ref(false)
const currentEditingCharacter = ref(null)
const charForm = reactive({
  id: null,
  name: '',
  gender: '',
  occupation: '',
  description: '',
  reference_image: '',
  front_image_url: '',
  side_image_url: '',
  back_image_url: '',
  expressions: [],
  costumes: [],
  raw_file: null
})

// v5.0 变体相关状态
const showVariationsDialogFlag = ref(false)
const currentCharacterVariations = ref([])
const loadingVariations = ref(false)
const showVariationFormDialog = ref(false)
const editingVariation = ref(null)
const savingVariation = ref(false)
const variationForm = reactive({
  name: '',
  description: '',
  is_stage_variation: false,
  episode_range: '',
  age_description: '',
  stage_description: '',
  visual_prompt_zh: ''
})

const filteredCharacters = computed(() => {
  if (!characterSearch.value) return characters.value
  return characters.value.filter(c => c.name?.includes(characterSearch.value))
})

// ===== 右侧面板相关 =====
// rightActiveTab 已移除，右侧面板根据选中内容自动切换
const selectedCharacter = ref(null)
const videoPlaying = ref(false)

// 切换视频播放状态
const toggleVideoPlay = () => {
  const video = document.querySelector('.preview-video')
  if (video) {
    if (video.paused) {
      video.play()
      videoPlaying.value = true
    } else {
      video.pause()
      videoPlaying.value = false
    }
  }
}

// 点击角色卡片时显示角色详情弹窗
const handleCharacterClick = (char) => {
  currentPreviewVideo.value = null  // 清除视频预览
  selectedCharacter.value = char
  showCharacterDetail.value = true
}

// ==================== 场景/分镜相关 ====================
const loadingScenes = ref(false)
const isGeneratingStoryboard = ref(false)
const scenes = ref([])
const currentScriptId = ref(null)
const expandedSceneIds = ref([]) // 折叠展开的场景ID列表
const showShotDetailDialog = ref(false)
const savingShot = ref(false)
const currentShot = ref(null)
const showSceneDetailDialog = ref(false)
const savingSceneDetail = ref(false)
const currentScene = ref(null)
const selectedShotIds = ref([])

// ==================== 视频相关 ====================
const loadingVideos = ref(false)
const videoList = ref([])
const videoListKey = ref('')
const selectedVideos = ref([])

// ==================== 时间轴编辑器相关 ====================
const showTimelineView = ref(true) // 默认显示时间轴视图
const timelineItems = ref([]) // 时间轴项目列表
const selectedTimelineItem = ref(null) // 选中的时间轴项目
const timelineCurrentItem = ref(null) // 当前播放的项目
const timelineCurrentTime = ref(0) // 当前播放时间（秒）
const timelineTotalDuration = ref(0) // 总时长（秒）
const isTimelinePlaying = ref(false) // 是否正在播放
const selectedTransition = ref('none') // 选中的转场效果
const pixelsPerSecond = 80 // 每秒像素数
const timelineVideoRef = ref(null) // 时间轴视频引用
const timelineTrackRef = ref(null) // 时间轴轨道引用
const timelinePlayTimer = ref(null) // 播放定时器

// 拖拽状态
const isDragging = ref(false)
const isResizing = ref(false)
const dragStartX = ref(0)
const dragItem = ref(null)
const dragItemIndex = ref(-1)
const resizeDirection = ref('')
const originalDuration = ref(0)

// 计算时间轴刻度标记
const timelineScaleMarks = computed(() => {
  const totalSecs = Math.ceil(timelineTotalDuration.value)
  const marks = []
  for (let i = 1; i <= Math.max(totalSecs, 10); i++) {
    marks.push(i)
  }
  return marks
})

// 计算播放头位置
const playheadPosition = computed(() => {
  return timelineCurrentTime.value * pixelsPerSecond
})

// 获取剪辑左侧位置
const getClipLeft = (index) => {
  let left = 0
  for (let i = 0; i < index && i < timelineItems.value.length; i++) {
    left += getClipWidth(timelineItems.value[i].duration)
  }
  return left
}

// 获取剪辑宽度
const getClipWidth = (duration) => {
  return duration * pixelsPerSecond
}

// 从videoList构建时间轴项目
const buildTimelineItems = () => {
  timelineItems.value = videoList.value
    .filter(s => s.video_url || s.scene_image_url || s.reference_image_url)
    .map(s => ({
      ...s,
      duration: s.duration || 3,
      transition: s.transition || 'none',
      has_video: !!s.video_url,
      has_audio: !!s.audio_url,
      thumbnail: s.thumbnail || s.scene_image_url || s.reference_image_url
    }))
  
  // 计算总时长
  timelineTotalDuration.value = timelineItems.value.reduce((sum, item) => sum + (item.duration || 3), 0)
}

// 选择时间轴项目
const selectTimelineItem = (item) => {
  selectedTimelineItem.value = item
  timelineCurrentItem.value = item
}

// 开始剪辑拖拽
const startClipDrag = (event, item, index) => {
  if (isResizing.value) return
  isDragging.value = true
  dragItem.value = item
  dragItemIndex.value = index
  dragStartX.value = event.clientX
  document.addEventListener('mousemove', onClipDrag)
  document.addEventListener('mouseup', stopClipDrag)
}

// 剪辑拖拽处理
const onClipDrag = (event) => {
  if (!isDragging.value || !dragItem.value) return
  const deltaX = event.clientX - dragStartX.value
  const deltaIndex = Math.round(deltaX / pixelsPerSecond)
  
  if (deltaIndex !== 0) {
    const newIndex = Math.max(0, Math.min(timelineItems.value.length - 1, dragItemIndex.value + deltaIndex))
    if (newIndex !== dragItemIndex.value) {
      const items = [...timelineItems.value]
      const [removed] = items.splice(dragItemIndex.value, 1)
      items.splice(newIndex, 0, removed)
      timelineItems.value = items
      dragItemIndex.value = newIndex
      dragStartX.value = event.clientX
    }
  }
}

// 停止剪辑拖拽
const stopClipDrag = () => {
  isDragging.value = false
  dragItem.value = null
  document.removeEventListener('mousemove', onClipDrag)
  document.removeEventListener('mouseup', stopClipDrag)
  // 更新videoList顺序
  updateVideoListFromTimeline()
}

// 开始调整大小
const startResize = (event, item, direction) => {
  isResizing.value = true
  dragItem.value = item
  resizeDirection.value = direction
  originalDuration.value = item.duration
  dragStartX.value = event.clientX
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

// 调整大小处理
const onResize = (event) => {
  if (!isResizing.value || !dragItem.value) return
  const deltaX = event.clientX - dragStartX.value
  const deltaDuration = Math.round(deltaX / pixelsPerSecond)
  
  let newDuration = originalDuration.value
  if (resizeDirection.value === 'right') {
    newDuration = Math.max(1, Math.min(10, originalDuration.value + deltaDuration))
  } else {
    newDuration = Math.max(1, Math.min(10, originalDuration.value - deltaDuration))
  }
  
  dragItem.value.duration = newDuration
  
  // 更新总时长
  timelineTotalDuration.value = timelineItems.value.reduce((sum, item) => sum + item.duration, 0)
}

// 停止调整大小
const stopResize = () => {
  isResizing.value = false
  dragItem.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  // 更新videoList中的时长
  updateVideoListFromTimeline()
}

// 从时间轴更新videoList
const updateVideoListFromTimeline = () => {
  for (const item of timelineItems.value) {
    const videoItem = videoList.value.find(v => v.id === item.id)
    if (videoItem) {
      videoItem.duration = item.duration
      videoItem.transition = item.transition
    }
  }
}

// 更新时间轴项目时长
const updateTimelineItemDuration = () => {
  timelineTotalDuration.value = timelineItems.value.reduce((sum, item) => sum + item.duration, 0)
}

// 时间轴轨道点击
const onTrackClick = (event) => {
  if (event.target === event.currentTarget) {
    selectedTimelineItem.value = null
  }
}

// 时间轴视频播放结束
const onTimelineVideoEnded = () => {
  playNextInTimeline()
}

// 时间轴视频时间更新
const onTimelineVideoTimeUpdate = () => {
  if (timelineVideoRef.value) {
    timelineCurrentTime.value += 0.1
  }
}

// 播放/暂停切换
const toggleTimelinePlay = () => {
  if (isTimelinePlaying.value) {
    pauseTimeline()
  } else {
    playTimeline()
  }
}

// 播放时间轴
const playTimeline = () => {
  if (timelineItems.value.length === 0) {
    ElMessage.warning('时间轴为空')
    return
  }
  
  isTimelinePlaying.value = true
  
  // 如果当前没有选中项，从头开始
  if (!timelineCurrentItem.value) {
    timelineCurrentItem.value = timelineItems.value[0]
    timelineCurrentTime.value = 0
  }
  
  if (timelineCurrentItem.value?.has_video && timelineVideoRef.value) {
    timelineVideoRef.value.play()
  } else {
    // 图片预览，按时长计时
    startImageTimer()
  }
}

// 暂停时间轴
const pauseTimeline = () => {
  isTimelinePlaying.value = false
  if (timelineVideoRef.value) {
    timelineVideoRef.value.pause()
  }
  if (timelinePlayTimer.value) {
    clearInterval(timelinePlayTimer.value)
    timelinePlayTimer.value = null
  }
}

// 图片预览计时器
const startImageTimer = () => {
  if (timelinePlayTimer.value) {
    clearInterval(timelinePlayTimer.value)
  }
  
  let elapsed = 0
  const currentDuration = timelineCurrentItem.value?.duration || 3
  
  timelinePlayTimer.value = setInterval(() => {
    elapsed += 0.1
    timelineCurrentTime.value += 0.1
    
    if (elapsed >= currentDuration) {
      clearInterval(timelinePlayTimer.value)
      timelinePlayTimer.value = null
      playNextInTimeline()
    }
  }, 100)
}

// 播放下一个
const playNextInTimeline = () => {
  if (timelinePlayTimer.value) {
    clearInterval(timelinePlayTimer.value)
    timelinePlayTimer.value = null
  }
  
  const currentIndex = timelineItems.value.findIndex(item => item.id === timelineCurrentItem.value?.id)
  const nextIndex = currentIndex + 1
  
  if (nextIndex < timelineItems.value.length) {
    timelineCurrentItem.value = timelineItems.value[nextIndex]
    if (timelineCurrentItem.value?.has_video && timelineVideoRef.value) {
      timelineVideoRef.value.src = getAssetUrl(timelineCurrentItem.value.video_url)
      timelineVideoRef.value.play()
    } else {
      startImageTimer()
    }
  } else {
    // 播放结束
    isTimelinePlaying.value = false
    timelineCurrentTime.value = 0
    timelineCurrentItem.value = timelineItems.value[0]
  }
}

// 预览当前选中的时间轴项目
const handlePreviewTimelineItem = () => {
  if (!selectedTimelineItem.value) return
  timelineCurrentItem.value = selectedTimelineItem.value
  timelineCurrentTime.value = 0
  
  if (selectedTimelineItem.value?.has_video && timelineVideoRef.value) {
    timelineVideoRef.value.src = getAssetUrl(selectedTimelineItem.value.video_url)
    timelineVideoRef.value.play()
    isTimelinePlaying.value = true
  } else {
    isTimelinePlaying.value = false
  }
}

// 添加转场
const handleAddTransition = () => {
  if (!selectedTimelineItem.value) return
  selectedTimelineItem.value.transition = selectedTransition.value
  updateVideoListFromTimeline()
}

// 格式化时间
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 格式化时长
const formatTimelineDuration = (seconds) => {
  return `${Math.floor(seconds)}秒`
}

// 监听videoList变化，更新时间轴
watch(videoList, () => {
  buildTimelineItems()
}, { deep: true })

// ==================== 音频相关 ====================
// 音频库相关
const audioTab = ref('tts')
const libraryFilter = ref('all')
const uploadType = ref('voice')
const audioLibrary = ref([])
const loadingLibrary = ref(false)

const filteredLibrary = computed(() => {
  if (libraryFilter.value === 'all') return audioLibrary.value
  return audioLibrary.value.filter(item => item.audio_type === libraryFilter.value)
})

const loadAudioLibrary = async () => {
  loadingLibrary.value = true
  try {
    const res = await audioAPI.getLibrary(userStore.currentProject?.id)
    if (res.success) {
      audioLibrary.value = res.data
    }
  } catch (err) {
    console.error('加载音频库失败:', err)
  } finally {
    loadingLibrary.value = false
  }
}

const handleAudioUpload = async (file) => {
  // 验证格式和大小
  const isAudio = ['.mp3', '.wav', '.ogg'].some(ext => file.name.toLowerCase().endsWith(ext))
  const isLt20M = file.size / 1024 / 1024 < 20

  if (!isAudio) {
    ElMessage.error('只支持 mp3/wav/ogg 格式')
    return
  }
  if (!isLt20M) {
    ElMessage.error('文件大小不能超过 20MB')
    return
  }

  const formData = new FormData()
  formData.append('audio', file.raw)
  formData.append('audio_type', uploadType.value)
  if (userStore.currentProject?.id) {
    formData.append('project_id', userStore.currentProject.id)
  }

  try {
    const res = await audioAPI.upload(formData)
    if (res.success) {
      ElMessage.success('上传成功')
      await loadAudioLibrary()
    }
  } catch (err) {
    console.error('音频上传失败:', err)
    ElMessage.error('上传失败')
  }
}

const handleDeleteAudioAsset = async (asset) => {
  try {
    await ElMessageBox.confirm(`确定删除音频 "${asset.filename}" 吗？`, '删除确认', { type: 'warning' })
    const res = await audioAPI.delete(asset.id)
    if (res.success) {
      ElMessage.success('已删除')
      await loadAudioLibrary()
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除音频失败:', err)
      ElMessage.error('删除失败')
    }
  }
}

// 监听 Tab 切换
watch(audioTab, (newTab) => {
  if (newTab === 'library') {
    loadAudioLibrary()
  }
})
const voiceList = ref([])
const ttsForm = reactive({
  voiceId: '',
  text: '',
  volume: 0,         // 音量：-50 ~ +50（提交API时转为'+0%'格式）
  rate: 0,           // 语速：-50 ~ +50（提交API时转为'+0%'格式）
  pitch: 0,          // 音调：-50 ~ +50（提交API时转为'+0Hz'格式）
  emotion: ''        // 情感风格
})

// 将数字参数转为Edge TTS格式字符串
function formatTTSParams() {
  const r = ttsForm.rate
  const v = ttsForm.volume
  const p = ttsForm.pitch
  return {
    rate: `${r >= 0 ? '+' : ''}${r}%`,
    volume: `${v >= 0 ? '+' : ''}${v}%`,
    pitch: `${p >= 0 ? '+' : ''}${p}Hz`
  }
}
const ttsLoading = ref(false)

// 情感风格列表
const emotionList = ref([
  { id: 'warm', name: '温柔', description: '温和亲切的语气' },
  { id: 'cheerful', name: '欢快', description: '开心愉悦的语气' },
  { id: 'playful', name: '俏皮', description: '活泼可爱的语气' },
  { id: 'lively', name: '活泼', description: '充满活力的语气' },
  { id: 'calm', name: '平静', description: '冷静沉稳的语气' },
  { id: 'steady', name: '稳重', description: '成熟稳重的语气' },
  { id: 'gentle', name: '柔和', description: '柔和温暖的语气' },
  { id: 'confident', name: '自信', description: '自信大方的语气' },
  { id: 'relaxed', name: '轻松', description: '轻松自然的语气' },
  { id: 'innocent', name: '天真', description: '纯真可爱的语气' },
  { id: 'seductive', name: '磁性', description: '低沉磁性的语气' },
  { id: 'formal', name: '正式', description: '正式严肃的语气' },
  { id: 'energetic', name: '有力', description: '充满力量的语气' },
  { id: 'youthful', name: '青春', description: '青春洋溢的语气' },
  { id: 'deep', name: '低沉', description: '低沉浑厚的语气' }
])
const bgmList = ref([])
const bgmCategory = ref('')
const selectedBGM = ref(null)
const bgmVolume = ref(0.5)
const bgmLoading = ref(false)
const loadingBGM = ref(false)
const sfxList = ref([])
const sfxCategory = ref('')
const selectedSFX = ref(null)
const sfxVolume = ref(0.5)
const sfxLoading = ref(false)
const loadingSFX = ref(false)
const audioPlayer = ref(null)

// ==================== 镜头配音相关 ====================
// 配音管理相关状态
const voiceTab = ref('shots') // shots: 镜头配音, characters: 角色音色绑定
const shotAudioList = ref([]) // 剧本下所有镜头的配音状态
const loadingShotAudio = ref(false)
const batchTTSLoading = ref(false)
const selectedShotsForTTS = ref([]) // 选中的镜头列表
const currentPlayingShot = ref(null) // 当前正在播放的镜头
const audioPreviewRef = ref(null) // 音频预览引用

// 加载剧本下所有镜头的配音状态
const loadShotAudioStatus = async () => {
  if (!currentScriptId.value) return
  loadingShotAudio.value = true
  try {
    const res = await ttsAPI.getStatus(currentScriptId.value)
    if (res.success) {
      shotAudioList.value = res.data
    }
  } catch (err) {
    console.error('加载配音状态失败:', err)
  } finally {
    loadingShotAudio.value = false
  }
}

// 为单个镜头生成配音
const handleShotTTS = async (shot) => {
  if (!shot.dialogue && !shot.original_text) {
    ElMessage.warning('该镜头没有台词')
    return
  }
  try {
    const params = formatTTSParams()
    const res = await ttsAPI.generate({
      shotId: shot.id,
      voice: ttsForm.voiceId || 'zh-CN-XiaoxiaoNeural',
      volume: params.volume,
      rate: params.rate,
      pitch: params.pitch,
      emotion: ttsForm.emotion
    })
    if (res.success) {
      ElMessage.success('配音生成成功')
      await loadShotAudioStatus()
      // 更新当前选中镜头的配音信息
      if (currentShot.value && currentShot.value.id === shot.id) {
        currentShot.value.audio_url = res.data.audioUrl
        currentShot.value.voice_id = res.data.voice
        currentShot.value.voice_name = res.data.voiceName
      }
    }
  } catch (err) {
    console.error('生成配音失败:', err)
    ElMessage.error('生成配音失败: ' + (err.message || '未知错误'))
  }
}

// 批量生成配音
const handleBatchTTS = async () => {
  if (!currentScriptId.value) {
    ElMessage.warning('请先选择一个剧本')
    return
  }
  
  // 获取所有有台词的镜头
  const shotsWithDialogue = shotAudioList.value.filter(s => 
    s.dialogue || s.original_text
  )
  
  if (shotsWithDialogue.length === 0) {
    ElMessage.warning('当前剧本没有需要配音的镜头')
    return
  }

  batchTTSLoading.value = true
  try {
    const params = formatTTSParams()
    const res = await ttsAPI.generateBatch({
      scriptId: currentScriptId.value,
      voice: ttsForm.voiceId || 'zh-CN-XiaoxiaoNeural',
      volume: params.volume,
      rate: params.rate,
      pitch: params.pitch,
      emotion: ttsForm.emotion
    })
    if (res.success) {
      ElMessage.success(res.message || `批量生成完成：成功${res.data.success}个，失败${res.data.failed}个`)
      await loadShotAudioStatus()
    }
  } catch (err) {
    console.error('批量生成配音失败:', err)
    ElMessage.error('批量生成失败: ' + (err.message || '未知错误'))
  } finally {
    batchTTSLoading.value = false
  }
}

// 删除镜头配音
const handleDeleteShotAudio = async (shot) => {
  if (!shot.audio_url) {
    ElMessage.warning('该镜头没有配音')
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除镜头 ${shot.shot_number} 的配音吗？`, '删除确认', { type: 'warning' })
    const res = await ttsAPI.remove(shot.id)
    if (res.success) {
      ElMessage.success('配音已删除')
      await loadShotAudioStatus()
      // 更新当前选中镜头的配音信息
      if (currentShot.value && currentShot.value.id === shot.id) {
        currentShot.value.audio_url = null
        currentShot.value.voice_id = null
        currentShot.value.voice_name = null
      }
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除配音失败:', err)
      ElMessage.error('删除失败')
    }
  }
}

// 播放/停止配音预览
const handlePlayShotAudio = (shot) => {
  if (!shot.audio_url) {
    ElMessage.warning('该镜头没有配音')
    return
  }
  
  // 如果正在播放同一个镜头，则停止
  if (currentPlayingShot.value === shot.id && audioPreviewRef.value) {
    audioPreviewRef.value.pause()
    audioPreviewRef.value.currentTime = 0
    currentPlayingShot.value = null
    return
  }
  
  // 停止之前的播放
  if (audioPreviewRef.value) {
    audioPreviewRef.value.pause()
    audioPreviewRef.value = null
  }
  
  // 创建新的音频实例并播放
  const audio = new Audio(getAssetUrl(shot.audio_url))
  audioPreviewRef.value = audio
  currentPlayingShot.value = shot.id
  
  audio.play()
  audio.onended = () => {
    currentPlayingShot.value = null
  }
  audio.onerror = () => {
    ElMessage.error('音频播放失败')
    currentPlayingShot.value = null
  }
}

// 更新角色默认音色绑定
const handleVoiceChange = async (character, voiceId) => {
  if (!voiceId) return
  try {
    // 根据voiceId查找voiceName
    const voice = voiceList.value.find(v => v.id === voiceId)
    const voiceName = voice ? voice.name : voiceId
    const res = await ttsAPI.updateCharacterVoice({
      characterId: character.id,
      voiceId,
      voiceName
    })
    if (res.success) {
      ElMessage.success('音色绑定成功')
      await loadCharacters()
    }
  } catch (err) {
    console.error('更新角色音色失败:', err)
    ElMessage.error('绑定失败: ' + (err.message || '未知错误'))
  }
}

// 兼容旧函数名
const handleUpdateCharacterVoice = handleVoiceChange

// 监听音频Tab切换，加载配音状态
watch(audioTab, (newTab) => {
  if (newTab === 'tts') {
    loadAudioSettings()
    if (currentScriptId.value) {
      loadShotAudioStatus()
    }
  }
})

// 加载音频相关设置（音色列表等）
const loadAudioSettings = async () => {
  try {
    const res = await ttsAPI.getVoices()
    if (res.success) {
      voiceList.value = res.data
      // 如果没有选中音色，默认选择第一个
      if (!ttsForm.voiceId && voiceList.value.length > 0) {
        ttsForm.voiceId = voiceList.value[0].id
      }
    }
  } catch (err) {
    console.error('加载音色列表失败:', err)
  }
}

const filteredBGMList = computed(() => {
  if (!bgmCategory.value) return bgmList.value
  return bgmList.value.filter(b => b.category === bgmCategory.value)
})

const filteredSFXList = computed(() => {
  if (!sfxCategory.value) return sfxList.value
  return sfxList.value.filter(s => s.category === sfxCategory.value)
})

// ==================== 初始化 ====================
onMounted(() => {
  if (userStore.currentProject?.id) {
    loadAllData()
  }
  userStore.fetchMembership()
  userStore.fetchCredits()
  loadAudioSettings() // 加载配音音色列表
})

// 监听来自右侧面板的详情查看信号
watch(() => userStore.showShotDetailSignal, () => {
  if (userStore.activeShot) {
    handleShotClick(userStore.activeShot)
  }
})

// 监听当前项目变化
watch(() => userStore.currentProject, (newProject) => {
  if (newProject?.id) {
    videoList.value = []
    videoListKey.value = ''
    shotCount.value = 0
    scenes.value = []
    sceneCount.value = 0
    loadAllData()
  }
}, { deep: true })

const loadAllData = async () => {
  await loadScripts()
  await Promise.all([
    loadCharacters(),
    loadVoices(),
    loadBGMList(),
    loadSFXList()
  ])
  await loadScenes()
  await loadShots()
}

const loadTabData = async (tab) => {
  switch (tab) {
    case 'script':
      await loadScripts()
      break
    case 'character':
      await loadCharacters()
      break
    case 'storyboard':
      await loadScenes()
      await loadShots()
      break
    case 'video':
      await loadShots()
      break
    case 'audio':
      await loadVoices()
      await loadBGMList()
      await loadSFXList()
      if (currentScriptId.value) {
        await loadShotAudioStatus()
      }
      break
  }
}

// ==================== 剧本操作 ====================
const loadScripts = async () => {
  if (!userStore.currentProject?.id) return
  loadingScripts.value = true
  try {
    const response = await scriptsAPI.list(userStore.currentProject.id)
    scripts.value = response.data || response || []
    scriptCount.value = scripts.value.length
    if (scripts.value.length > 0 && !currentScriptId.value) {
      currentScriptId.value = scripts.value[0].id
    }
  } catch (err) {
    console.error('加载剧本失败:', err)
  } finally {
    loadingScripts.value = false
  }
}

const handleAiGenerate = async () => {
  if (!aiForm.theme) {
    ElMessage.warning('请输入剧本主题')
    return
  }
  if (!userStore.currentProject?.id) {
    ElMessage.warning('请先选择项目')
    return
  }
  
  generatingAi.value = true
  try {
    // 先创建剧本
    const createResponse = await scriptsAPI.create({
      project_id: userStore.currentProject.id,
      title: aiForm.theme,
      content: '',
      status: 'draft'
    })
    const newScript = createResponse.data || createResponse
    
    // 调用AI生成
    if (newScript?.id) {
      await scriptsAPI.aiGenerate(newScript.id, {
        theme: aiForm.theme,
        genre: aiForm.genre,
        setting: aiForm.setting,
        episode_count: aiForm.episodeCount
      })
    }
    
    showAiDialog.value = false
    aiForm.theme = ''
    aiForm.setting = ''
    
    ElMessage.success('AI剧本生成已启动，请在任务中心查看进度')
    
    // 重新加载剧本列表
    await loadScripts()
  } catch (err) {
    console.error('生成剧本失败:', err)
    ElMessage.error('生成剧本失败: ' + (err.response?.data?.message || err.message))
  } finally {
    generatingAi.value = false
  }
}

const handleUploadScript = async (file) => {
  if (!userStore.currentProject?.id) {
    ElMessage.warning('请先选择项目')
    return false
  }
  
  try {
    // 使用FormData上传文件
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', userStore.currentProject.id)
    
    // 直接调用上传API
    const response = await fetch('/api/scripts/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
      },
      body: formData
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || '上传失败')
    }
    
    const result = await response.json()
    
    ElMessage.success(`剧本 "${file.name}" 导入成功`)
    await loadScripts()
  } catch (err) {
    console.error('上传剧本失败:', err)
    ElMessage.error('上传失败: ' + (err.message || '未知错误'))
  }
  return false
}

const handleEditScript = (script) => {
  currentEditingScript.value = script
  editScriptForm.title = script.title
  editScriptForm.content = script.content || ''
  showEditScriptDialog.value = true
}

const handleSaveScript = async () => {
  if (!currentEditingScript.value) return
  
  savingScript.value = true
  try {
    await scriptsAPI.update(currentEditingScript.value.id, {
      title: editScriptForm.title,
      content: editScriptForm.content
    })
    showEditScriptDialog.value = false
    ElMessage.success('保存成功')
    await loadScripts()
  } catch (err) {
    console.error('保存剧本失败:', err)
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message))
  } finally {
    savingScript.value = false
  }
}

const handleGenStoryboard = async (script) => {
  // 检查是否已有分镜，防止重复生成
  if (scenes.value && scenes.value.length > 0) {
    try {
      await ElMessageBox.confirm(
        '该剧本已生成分镜，重新生成会覆盖现有分镜，是否继续？',
        '提示',
        { confirmButtonText: '重新生成', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return // 用户取消
    }
  }
  currentScriptId.value = script.id
  activeTab.value = 'storyboard'
  emit('tab-change', 'storyboard')
  isGeneratingStoryboard.value = true
  ElMessage.info('正在生成分镜，AI处理中，预计1-3分钟，请耐心等待...')
  
  try {
    // 先清空旧场景和镜头
    for (const scene of scenes.value) {
      try { await scenesAPI.delete(scene.id) } catch {}
    }
    scenes.value = []
    expandedSceneIds.value = []
    
    await scenesAPI.generate(script.id, {})
    await loadScenes()
    await loadShots()
    ElMessage.success('分镜生成完成！')
  } catch (err) {
    console.error('生成分镜失败:', err)
    ElMessage.error('生成分镜失败: ' + (err.response?.data?.message || err.message))
  } finally {
    isGeneratingStoryboard.value = false
  }
}

const handleDeleteScript = async (script) => {
  try {
    await scriptsAPI.delete(script.id)
    ElMessage.success('删除成功')
    await loadScripts()
  } catch (err) {
    console.error('删除剧本失败:', err)
    ElMessage.error('删除失败: ' + (err.response?.data?.message || err.message))
  }
}

// ==================== 角色操作 ====================
const loadCharacters = async () => {
  if (!currentScriptId.value) return
  loadingCharacters.value = true
  try {
    const response = await charactersAPI.list(currentScriptId.value)
    characters.value = response.data || response || []
  } catch (err) {
    console.error('加载角色失败:', err)
  } finally {
    loadingCharacters.value = false
  }
}

const handleCreateCharacter = async () => {
  if (!charForm.name) {
    ElMessage.warning('请输入角色名称')
    return
  }
  if (!currentScriptId.value) {
    ElMessage.warning('请先创建或选择一个剧本')
    return
  }
  
  creatingCharacter.value = true
  try {
    await charactersAPI.create({
      script_id: currentScriptId.value,
      name: charForm.name,
      gender: charForm.gender,
      occupation: charForm.occupation,
      description: charForm.description
    })
    showCharacterDialog.value = false
    charForm.name = ''
    charForm.gender = ''
    charForm.occupation = ''
    charForm.description = ''
    ElMessage.success('角色创建成功')
    await loadCharacters()
  } catch (err) {
    console.error('创建角色失败:', err)
    ElMessage.error('创建角色失败: ' + (err.response?.data?.message || err.message))
  } finally {
    creatingCharacter.value = false
  }
}

// ===== 问题1修复：角色编辑功能 =====
const handleEditCharacter = (char) => {
  isEditingCharacter.value = true
  currentEditingCharacter.value = char
  charForm.id = char.id
  charForm.name = char.name
  charForm.gender = char.gender
  charForm.occupation = char.occupation
  charForm.description = char.description
  charForm.reference_image = char.reference_image || char.image_url
  charForm.front_image_url = char.front_image_url
  charForm.side_image_url = char.side_image_url
  charForm.back_image_url = char.back_image_url
  charForm.expressions = Array.isArray(char.expressions) ? [...char.expressions] : []
  charForm.costumes = Array.isArray(char.costumes) ? [...char.costumes] : []
  showCharacterDialog.value = true
}

const handleCharAngleChange = (file, angle) => {
  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64 = e.target.result
    charForm[`${angle}_image_url`] = base64
    
    // 如果是编辑模式，且有ID，直接异步上传到后端
    if (isEditingCharacter.value && charForm.id) {
      const formData = new FormData()
      formData.append('image', file.raw)
      formData.append('image_type', angle)
      await charactersAPI.uploadImage(charForm.id, formData)
      ElMessage.success(`${angle === 'front' ? '正面' : angle === 'side' ? '侧面' : '背面'}图已上传`)
      await loadCharacters()
    }
  }
  reader.readAsDataURL(file.raw)
}

const addPreset = (type) => {
  const list = type === 'expression' ? charForm.expressions : charForm.costumes
  list.push({ name: '', url: '' })
}

const handlePresetImageChange = (file, type, index) => {
  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64 = e.target.result
    const list = type === 'expression' ? charForm.expressions : charForm.costumes
    list[index].url = base64
    
    // 如果是编辑模式，且有ID，直接上传
    if (isEditingCharacter.value && charForm.id) {
      const formData = new FormData()
      formData.append('image', file.raw)
      formData.append('image_type', type)
      formData.append('name', list[index].name || '未命名')
      await charactersAPI.uploadImage(charForm.id, formData)
      ElMessage.success('预设图片已上传')
      await loadCharacters()
    }
  }
  reader.readAsDataURL(file.raw)
}

const handleCharRefChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    charForm.reference_image = e.target.result
    charForm.raw_file = file.raw // 保存原始文件用于上传
  }
  reader.readAsDataURL(file.raw)
}

const handleSaveCharacter = async () => {
  if (isEditingCharacter.value && currentEditingCharacter.value) {
    // 编辑模式
    creatingCharacter.value = true
    try {
      const payload = {
        name: charForm.name,
        gender: charForm.gender,
        occupation: charForm.occupation,
        description: charForm.description,
        front_image_url: charForm.front_image_url,
        side_image_url: charForm.side_image_url,
        back_image_url: charForm.back_image_url,
        expressions: charForm.expressions,
        costumes: charForm.costumes
      }
      
      await charactersAPI.update(currentEditingCharacter.value.id, payload)
      
      // 如果有新上传的参考图文件
      if (charForm.raw_file) {
        const formData = new FormData()
        formData.append('image', charForm.raw_file)
        formData.append('image_type', 'reference')
        await charactersAPI.uploadImage(currentEditingCharacter.value.id, formData)
      }

      showCharacterDialog.value = false
      ElMessage.success('角色更新成功')
      await loadCharacters()
      userStore.refreshCounter++ // 通知右侧面板刷新
    } catch (err) {
      console.error('更新角色失败:', err)
      ElMessage.error('更新失败: ' + (err.response?.data?.message || err.message))
    } finally {
      creatingCharacter.value = false
      isEditingCharacter.value = false
      currentEditingCharacter.value = null
      charForm.id = null
      charForm.raw_file = null
      charForm.front_image_url = ''
      charForm.side_image_url = ''
      charForm.back_image_url = ''
      charForm.expressions = []
      charForm.costumes = []
    }
  } else {
    // 创建模式
    if (!charForm.name) {
      ElMessage.warning('请输入角色名称')
      return
    }
    if (!currentScriptId.value) {
      ElMessage.warning('请先创建或选择一个剧本')
      return
    }
    
    creatingCharacter.value = true
    try {
      const res = await charactersAPI.create({
        script_id: currentScriptId.value,
        name: charForm.name,
        gender: charForm.gender,
        occupation: charForm.occupation,
        description: charForm.description,
        front_image_url: charForm.front_image_url,
        side_image_url: charForm.side_image_url,
        back_image_url: charForm.back_image_url,
        expressions: charForm.expressions,
        costumes: charForm.costumes
      })
      
      const newCharId = res.data?.id || res.id
      
      // 如果有新上传的参考图文件
      if (charForm.raw_file && newCharId) {
        const formData = new FormData()
        formData.append('image', charForm.raw_file)
        formData.append('image_type', 'reference')
        await charactersAPI.uploadImage(newCharId, formData)
      }

      showCharacterDialog.value = false
      // 重置表单
      charForm.id = null
      charForm.name = ''
      charForm.gender = ''
      charForm.occupation = ''
      charForm.description = ''
      charForm.reference_image = ''
      charForm.front_image_url = ''
      charForm.side_image_url = ''
      charForm.back_image_url = ''
      charForm.expressions = []
      charForm.costumes = []
      charForm.raw_file = null
      
      ElMessage.success('角色创建成功')
      await loadCharacters()
      userStore.refreshCounter++ // 通知右侧面板刷新
    } catch (err) {
      console.error('创建角色失败:', err)
      ElMessage.error('创建角色失败: ' + (err.response?.data?.message || err.message))
    } finally {
      creatingCharacter.value = false
    }
  }
}

// 头像上传弹窗引用
const avatarUploadRef = ref(null)
const currentUploadChar = ref(null)

// 显示头像上传弹窗
const showCharAvatarUpload = (char) => {
  currentUploadChar.value = char
  // 触发隐藏的上传组件
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadAvatar(e.target.files[0], char)
    }
  }
  input.click()
}

// 上传角色头像
const handleUploadAvatar = async (file, char) => {
  try {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('image_type', 'avatar')
    
    const response = await charactersAPI.uploadImage(char.id, formData)
    ElMessage.success('头像上传成功')
    
    // 更新本地数据
    const index = characters.value.findIndex(c => c.id === char.id)
    if (index !== -1) {
      characters.value[index].avatar = response.data?.image_url || response.image_url
      characters.value[index].updated_at = new Date().toISOString()
    }
  } catch (err) {
    console.error('上传头像失败:', err)
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
  }
}

// 上传参考图
const handleUploadReference = async (file, char) => {
  try {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('image_type', 'reference')
    
    const response = await charactersAPI.uploadImage(char.id, formData)
    ElMessage.success('参考图上传成功')
    
    // 更新本地数据
    const index = characters.value.findIndex(c => c.id === char.id)
    if (index !== -1) {
      characters.value[index].reference_image = response.data?.image_url || response.image_url
      characters.value[index].updated_at = new Date().toISOString()
    }
    return false // 阻止自动上传
  } catch (err) {
    console.error('上传参考图失败:', err)
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
    return false
  }
}

// ===== 问题2修复：角色图片生成错误处理和重试逻辑 =====
// v5.0 CogView生图 - 生成角色图片
const handleGenCharImage = async (char) => {
  // 检查角色是否已校准（需要有visual_prompt_en）
  if (!char.visual_prompt_en && !char.identity_anchors) {
    ElMessage.warning('请先进行角色校准后再生成图片')
    return
  }
  
  generatingImage[char.id] = true
  ElMessage.info(`正在使用CogView生成角色三视图（风格：${charImageStyle.value}）...`)
  
  try {
    const response = await charactersAPI.generateImage(char.id, { style: charImageStyle.value })
    if (response.success) {
      const viewCount = [response.front_image_url, response.side_image_url, response.back_image_url].filter(Boolean).length
      ElMessage.success(`角色三视图生成完成（${viewCount}个视角）`)
      // 更新角色数据
      if (response.front_image_url) char.front_image_url = response.front_image_url
      if (response.side_image_url) char.side_image_url = response.side_image_url
      if (response.back_image_url) char.back_image_url = response.back_image_url
      if (response.image_url) char.image_url = response.image_url
      await loadCharacters()
    } else {
      ElMessage.error(response.message || '生成失败')
    }
  } catch (err) {
    console.error('CogView生图失败:', err)
    ElMessage.error(err.response?.data?.message || err.message || '图片生成失败')
  } finally {
    generatingImage[char.id] = false
  }
}

// v5.0 CogView生图 - 生成分镜图片
const handleGenShotImage = async (shot) => {
  // 检查镜头是否有image_prompt
  if (!shot.image_prompt && !shot.visual_prompt) {
    ElMessage.warning('镜头没有图片提示词(image_prompt)，请先设置')
    return
  }
  
  generatingShotImage[shot.id] = true
  ElMessage.info('正在使用CogView生成分镜图片...')
  
  try {
    // 视觉连续性：检查上一镜头是否有图片
    const visualContinuityPrompt = await getVisualContinuityPrompt(shot)
    
    const response = await imagesAPI.generateShot(shot.id, { visualContinuityPrompt, size: IMAGE_SIZE_MAP[getShotImageSize(shot.id)]?.value || '1344x768' })
    if (response.success && response.imageUrl) {
      ElMessage.success('分镜图片生成成功！')
      // 更新镜头数据
      shot.scene_image_url = response.imageUrl
      // 触发UI更新
      const scene = scenes.value.find(s => s.id === shot.scene_id)
      if (scene && scene.shots) {
        const shotIndex = scene.shots.findIndex(s => s.id === shot.id)
        if (shotIndex !== -1) {
          scene.shots[shotIndex].scene_image_url = response.imageUrl
        }
      }
      await loadShots(true)
    } else {
      ElMessage.error(response.message || '生成失败')
    }
  } catch (err) {
    console.error('CogView分镜生图失败:', err)
    ElMessage.error(err.response?.data?.message || err.message || '分镜图片生成失败')
  } finally {
    generatingShotImage[shot.id] = false
  }
}

// 视觉连续性：获取上一镜头的视觉连续性提示词
// ==================== CogVideoX视频生成 ====================

// 使用CogVideoX生成视频（图生视频模式）
const handleGenerateCogVideo = async (shot) => {
  try {
    if (!shot?.id) {
      ElMessage.warning('镜头数据异常')
      return
    }
    
    // 检查是否有首帧图
    if (!shot.scene_image_url) {
      ElMessage.warning('该镜头没有首帧图，请先生成分镜图片')
      return
    }
    
    // 检查是否正在生成中
    if (shot.video_status === 'processing' || shot.video_status === 'generating' || shot.video_status === 'pending') {
      ElMessage.warning('该镜头正在生成中，请稍候')
      return
    }
    
    // 已有视频时确认是否重新生成
    if (shot.video_status === 'completed' && shot.video_url) {
      try {
        await ElMessageBox.confirm(
          '该镜头已生成视频，是否重新生成？',
          '提示',
          { confirmButtonText: '重新生成', cancelButtonText: '取消', type: 'warning' }
        )
      } catch {
        return // 用户取消
      }
    }
    
    ElMessage.info('正在使用CogVideoX生成分镜视频...')
    
    // 调用CogVideoX视频生成API
    const response = await videosAPI.generateShot(shot.id, {
      withAudio: true,
      model: videoModel.value
    })
    
    if (response.success && response.taskId) {
      ElMessage.success('CogVideoX视频生成任务已提交')
      
      // 保存taskId并开始轮询
      cogVideoTaskIds.value[shot.id] = response.taskId
      
      // 立即轮询一次
      await pollCogVideoStatus(shot.id)
    } else {
      ElMessage.error(response.message || '视频生成失败')
    }
  } catch (err) {
    console.error('CogVideoX视频生成失败:', err)
    ElMessage.error('生成失败: ' + (err.response?.data?.message || err.message))
  }
}

// 轮询CogVideoX视频任务状态
const MAX_POLL_COUNT = 80 // 最多轮询80次（5秒*80=约6分40秒）
const pollCogVideoCountMap = {} // 记录每个shotId的轮询次数
const pollCogVideoStatus = async (shotId) => {
  const taskId = cogVideoTaskIds.value[shotId]
  if (!taskId) {
    console.error('未找到taskId:', shotId)
    return
  }
  
  pollCogVideoCountMap[shotId] = 0
  
  // 设置轮询定时器
  if (cogVideoTaskTimers.value[shotId]) {
    clearInterval(cogVideoTaskTimers.value[shotId])
  }
  
  cogVideoTaskTimers.value[shotId] = setInterval(async () => {
    try {
      pollCogVideoCountMap[shotId] = (pollCogVideoCountMap[shotId] || 0) + 1
      
      // 超过最大轮询次数，停止轮询
      if (pollCogVideoCountMap[shotId] > MAX_POLL_COUNT) {
        clearInterval(cogVideoTaskTimers.value[shotId])
        delete cogVideoTaskTimers.value[shotId]
        delete cogVideoTaskIds.value[shotId]
        delete pollCogVideoCountMap[shotId]
        const scene = scenes.value.find(s => s.shots?.some(shot => shot.id === shotId))
        if (scene) {
          const shot = scene.shots.find(s => s.id === shotId)
          if (shot) shot.video_status = 'failed'
        }
        ElMessage.error('视频生成超时（超过6分钟），请重试')
        return
      }
      
      const res = await videosAPI.getTaskStatus(taskId)
      
      if (res.success) {
        // 更新镜头状态
        const scene = scenes.value.find(s => s.shots?.some(shot => shot.id === shotId))
        if (scene) {
          const shot = scene.shots.find(s => s.id === shotId)
          if (shot) {
            if (res.status === 'completed') {
              // 视频生成完成
              shot.video_status = 'completed'
              shot.video_url = res.localVideoPath
              shot.thumbnail = res.coverImageUrl
              clearInterval(cogVideoTaskTimers.value[shotId])
              delete cogVideoTaskTimers.value[shotId]
              delete cogVideoTaskIds.value[shotId]
              delete pollCogVideoCountMap[shotId]
              ElMessage.success('CogVideoX视频生成完成！')
              await loadShots() // 刷新列表
            } else if (res.status === 'failed') {
              // 视频生成失败
              shot.video_status = 'failed'
              clearInterval(cogVideoTaskTimers.value[shotId])
              delete cogVideoTaskTimers.value[shotId]
              delete cogVideoTaskIds.value[shotId]
              delete pollCogVideoCountMap[shotId]
              ElMessage.error('视频生成失败: ' + (res.error || '未知错误'))
            } else {
              // 仍在处理中
              shot.video_status = 'processing'
              console.log('CogVideoX任务进行中:', taskId, '第' + pollCogVideoCountMap[shotId] + '次查询')
            }
          }
        }
      }
    } catch (err) {
      // 查询失败不中断轮询，只打日志（404等情况后端已处理为processing）
      console.warn('轮询CogVideoX任务状态异常:', err.message || err)
    }
  }, 5000) // 每5秒轮询一次
}

// 批量生成CogVideoX视频
const handleBatchGenerateCogVideo = async () => {
  // 收集所有未完成且有首帧图的镜头
  const shotsToGenerate = []
  
  if (selectedShotIds.value.length > 0) {
    // 有选中的镜头
    for (const scene of scenes.value) {
      if (scene.shots) {
        for (const shot of scene.shots) {
          if (selectedShotIds.value.includes(shot.id) && 
              shot.scene_image_url && 
              shot.video_status !== 'completed' &&
              shot.video_status !== 'pending' &&
              shot.video_status !== 'processing') {
            shotsToGenerate.push(shot)
          }
        }
      }
    }
  } else {
    // 没有选中，生成所有未完成的
    for (const scene of scenes.value) {
      if (scene.shots) {
        for (const shot of scene.shots) {
          if (shot.scene_image_url && 
              shot.video_status !== 'completed' &&
              shot.video_status !== 'pending' &&
              shot.video_status !== 'processing') {
            shotsToGenerate.push(shot)
          }
        }
      }
    }
  }
  
  if (shotsToGenerate.length === 0) {
    ElMessage.info('没有可生成视频的镜头（需要先有首帧图）')
    return
  }
  
  ElMessage.info('开始批量生成 ' + shotsToGenerate.length + ' 个CogVideoX视频...')
  
  for (const shot of shotsToGenerate) {
    await handleGenerateCogVideo(shot)
    // 等待一下避免请求过于密集
    await new Promise(r => setTimeout(r, 500))
  }
  
  ElMessage.success('已提交 ' + shotsToGenerate.length + ' 个视频生成任务')
}

const getVisualContinuityPrompt = async (shot) => {
  // 找到当前镜头在场景中的位置
  const scene = scenes.value.find(s => s.id === shot.scene_id)
  if (!scene || !scene.shots) return ''
  
  const shotIndex = scene.shots.findIndex(s => s.id === shot.id)
  if (shotIndex <= 0) return ''
  
  const prevShot = scene.shots[shotIndex - 1]
  
  // 检查上一镜头是否有生成的图片或视频
  if (prevShot.scene_image_url || prevShot.thumbnail || prevShot.result_url) {
    const imageUrl = prevShot.scene_image_url || prevShot.thumbnail || prevShot.result_url
    // 由于cogview-3-flash不支持图生图，我们用提示词来实现视觉连续性
    return 'maintain visual continuity with previous shot, consistent style and atmosphere'
  }
  
  // 如果没有上一镜头图，使用end_frame_prompt
  if (prevShot.end_frame_prompt) {
    return `maintain visual continuity with previous shot: ${prevShot.end_frame_prompt}`
  }
  
  return ''
}

// 批量生图
const handleBatchGenerateImages = async () => {
  // 收集所有未生图的镜头
  const shotsWithoutImage = []
  for (const scene of scenes.value) {
    if (scene.shots) {
      for (const shot of scene.shots) {
        if (!shot.scene_image_url && (shot.image_prompt || shot.visual_prompt)) {
          shotsWithoutImage.push({ shot, scene })
        }
      }
    }
  }
  
  if (shotsWithoutImage.length === 0) {
    ElMessage.info('所有镜头都已生成图片或缺少提示词')
    return
  }
  
  batchGenerating.value = true
  batchCancelled.value = false
  batchProgress.value = { current: 0, total: shotsWithoutImage.length }
  ElMessage.info(`开始批量生图，共 ${shotsWithoutImage.length} 个镜头`)
  
  for (const { shot, scene } of shotsWithoutImage) {
    if (batchCancelled.value) {
      ElMessage.warning('批量生图已取消')
      break
    }
    
    try {
      generatingShotImage[shot.id] = true
      
      // 获取视觉连续性提示词
      const visualContinuityPrompt = await getVisualContinuityPrompt(shot)
      
      const response = await imagesAPI.generateShot(shot.id, { visualContinuityPrompt, size: IMAGE_SIZE_MAP[getShotImageSize(shot.id)]?.value || '1344x768' })
      if (response.success && response.imageUrl) {
        shot.scene_image_url = response.imageUrl
        const shotIndex = scene.shots.findIndex(s => s.id === shot.id)
        if (shotIndex !== -1) {
          scene.shots[shotIndex].scene_image_url = response.imageUrl
        }
      }
      batchProgress.value.current++
    } catch (err) {
      console.error('批量生图失败:', shot.shot_number || shot.id, err)
    } finally {
      generatingShotImage[shot.id] = false
    }
  }
  
  batchGenerating.value = false
  if (!batchCancelled.value) {
    ElMessage.success(`批量生图完成！成功生成 ${batchProgress.value.current}/${batchProgress.value.total} 张图片`)
  }
}

// 取消批量生图
const handleCancelBatchGenerate = () => {
  batchCancelled.value = true
  ElMessage.info('正在取消批量生图...')
}

// 生成场景参考图
const handleGenerateSceneImage = async (scene) => {
  if (!scene.content && !scene.location) {
    ElMessage.warning('场景缺少描述信息，无法生成场景图')
    return
  }
  
  generatingSceneImage[scene.id] = true
  ElMessage.info('正在生成场景概念图...')
  
  try {
    // 构建场景描述prompt
    const locationDesc = scene.location || ''
    const timeDesc = scene.time_of_day || ''
    const contentDesc = scene.content ? scene.content.substring(0, 300) : ''
    
    const prompt = `${locationDesc}, ${timeDesc}, ${contentDesc}, anime style, concept art, detailed environment, high quality`
    
    const response = await imagesAPI.generate({
      prompt,
      model: 'cogview-3-flash',
      size: '1344x768'
    })
    
    if (response.success && response.imageUrl) {
      ElMessage.success('场景图生成成功！')
      // 更新场景数据
      scene.scene_image_url = response.imageUrl
      // 保存到后端
      try {
        await scenesAPI.update(scene.id, { scene_image_url: response.imageUrl })
      } catch (e) {
        console.error('保存场景图URL失败:', e)
      }
    } else {
      ElMessage.error(response.message || '生成失败')
    }
  } catch (err) {
    console.error('生成场景图失败:', err)
    ElMessage.error(err.response?.data?.message || err.message || '场景图生成失败')
  } finally {
    generatingSceneImage[scene.id] = false
  }
}

// 生成角色多视角图片
const handleGenerateCharView = async (char, viewType) => {
  if (!char.visual_prompt_en && !char.identity_anchors) {
    ElMessage.warning('请先进行角色校准后再生成图片')
    return
  }
  
  const viewKey = char.id + '_' + viewType
  generatingCharView[viewKey] = true
  
  const viewLabels = { front: '正面', side: '侧面', back: '背面' }
  ElMessage.info(`正在生成角色${viewLabels[viewType]}图...`)
  
  try {
    // 构建带视角的prompt
    const viewPrompts = {
      front: 'front view, facing the camera directly, full face visible, centered composition',
      side: 'side profile view, 90 degree angle, showing full side profile',
      back: 'back view, showing character from behind, no face visible'
    }
    
    const basePrompt = char.visual_prompt_en || ''
    const viewPrompt = basePrompt ? `${basePrompt}, ${viewPrompts[viewType]}` : viewPrompts[viewType]
    
    const response = await imagesAPI.generateCharacter(char.id, {
      view_type: viewType,
      prompt: viewPrompt,
      model: 'cogview-3-flash'
    })
    
    if (response.success && response.imageUrl) {
      ElMessage.success(`角色${viewLabels[viewType]}图生成成功！`)
      
      // 更新角色数据
      const imageField = viewType + '_image_url'
      char[imageField] = response.imageUrl
      
      // 保存到后端
      try {
        await charactersAPI.update(char.id, { [imageField]: response.imageUrl })
      } catch (e) {
        console.error('保存角色视角图URL失败:', e)
      }
      
      // 刷新角色列表以更新右侧面板
      await loadCharacters()
    } else {
      ElMessage.error(response.message || '生成失败')
    }
  } catch (err) {
    console.error(`生成角色${viewLabels[viewType]}图失败:`, err)
    ElMessage.error(err.response?.data?.message || err.message || '角色图片生成失败')
  } finally {
    generatingCharView[viewKey] = false
  }
}



const handleDeleteCharacter = async (char) => {
  try {
    await charactersAPI.delete(char.id)
    ElMessage.success('删除成功')
    await loadCharacters()
  } catch (err) {
    console.error('删除角色失败:', err)
    ElMessage.error('删除失败: ' + (err.response?.data?.message || err.message))
  }
}

// ==================== 场景/分镜操作 ====================
const loadScenes = async (forceReload = false) => {
  if (!currentScriptId.value) return
  loadingScenes.value = true
  try {
    const response = await scenesAPI.list(currentScriptId.value)
    scenes.value = response.data || response || []
    sceneCount.value = scenes.value.length
    
    // 并行加载所有场景的镜头（替代串行for循环）
    const shotPromises = scenes.value.map(async (scene) => {
      // 如果已有镜头数据且非强制刷新，跳过该场景
      if (!forceReload && scene.shots && scene.shots.length > 0) return
      try {
        const shotsResponse = await shotsAPI.list(scene.id)
        scene.shots = shotsResponse.data || shotsResponse || []
        scene.shots.sort((a, b) => (Number(a.shot_number) || 0) - (Number(b.shot_number) || 0))
        scene.shot_count = scene.shots.length
      } catch (err) {
        console.error('加载镜头失败:', err)
        scene.shots = []
        scene.shot_count = 0
      }
    })
    await Promise.all(shotPromises)
  } catch (err) {
    console.error('加载场景失败:', err)
  } finally {
    loadingScenes.value = false
  }
}

// 场景折叠/展开
const toggleSceneExpand = (scene) => {
  const idx = expandedSceneIds.value.indexOf(scene.id)
  if (idx >= 0) {
    expandedSceneIds.value.splice(idx, 1)
  } else {
    expandedSceneIds.value.push(scene.id)
  }
}

const handleGenerateScenes = async () => {
  if (!currentScriptId.value) {
    ElMessage.warning('请先选择一个剧本')
    return
  }
  
  // 检查是否已有分镜，防止重复生成
  if (scenes.value && scenes.value.length > 0) {
    try {
      await ElMessageBox.confirm(
        '该剧本已生成分镜，重新生成会覆盖现有分镜，是否继续？',
        '提示',
        { confirmButtonText: '重新生成', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return // 用户取消
    }
  }
  
  isGeneratingStoryboard.value = true
  ElMessage.info('正在生成分镜，AI处理中，预计1-3分钟，请耐心等待...')
  try {
    // 先清空旧场景和镜头
    for (const scene of scenes.value) {
      try { await scenesAPI.delete(scene.id) } catch {}
    }
    scenes.value = []
    expandedSceneIds.value = []
    
    await scenesAPI.generate(currentScriptId.value, {})
    await loadScenes(true)
    await loadShots(true)
    ElMessage.success('分镜生成完成！')
  } catch (err) {
    console.error('生成分镜失败:', err)
    ElMessage.error('生成分镜失败: ' + (err.response?.data?.message || err.message))
  } finally {
    isGeneratingStoryboard.value = false
  }
}

const handleDeleteScene = async (scene) => {
  if (!scene?.id) return
  try {
    await ElMessageBox.confirm(
      `确定删除场景「${scene.title || scene.scene_number || scene.id}」吗？将同时删除该场景下的所有镜头。`,
      '删除场景',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      }
    )
    await scenesAPI.delete(scene.id)
    ElMessage.success('删除成功')
    
    // 如果删除的是当前选中的镜头所属的场景，清空预览
    if (currentPreviewVideo.value?.scene_id === scene.id) {
      showVideoPlayer.value = false
      currentPreviewVideo.value = null
    }

    await loadScenes()
    await loadShots()
    
    // 触发全局刷新信号（如果 PreviewPanel 监听了）
    userStore.refreshCounter++
  } catch (err) {
    if (err === 'cancel') return
    console.error('删除场景失败:', err)
    ElMessage.error('删除失败: ' + (err.response?.data?.message || err.message))
  }
}

/** 删除镜头（分镜卡片 / 视频列表共用） */
const handleDeleteShot = async (shot, scene = null) => {
  if (!shot?.id) {
    ElMessage.warning('无法删除：镜头数据不完整')
    return
  }
  const label = scene
    ? `场景「${scene.title || scene.scene_number}」中的镜头 #${shot.shot_number ?? ''}`
    : `镜头 #${shot.shot_number ?? shot.id}`
  try {
    await ElMessageBox.confirm(`确定删除${label}吗？`, '删除镜头', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await shotsAPI.delete(shot.id)
    ElMessage.success('镜头已删除')
    await loadScenes()
    await loadShots()
    if (showShotDetailDialog.value && currentShot.value?.id === shot.id) {
      showShotDetailDialog.value = false
    }
  } catch (err) {
    if (err === 'cancel') return
    console.error('删除镜头失败:', err)
    ElMessage.error('删除失败: ' + (err.response?.data?.message || err.message))
  }
}

/** 批量删除镜头 */
const handleBatchDeleteShot = async () => {
  if (selectedShotIds.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedShotIds.value.length} 个镜头吗？此操作不可恢复。`,
      '批量删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      }
    )
    
    ElMessage.info(`正在删除 ${selectedShotIds.value.length} 个镜头...`)
    
    let successCount = 0
    let failCount = 0
    
    for (const id of selectedShotIds.value) {
      try {
        await shotsAPI.delete(id)
        successCount++
      } catch (err) {
        console.error(`删除镜头 ${id} 失败:`, err)
        failCount++
      }
    }
    
    if (failCount > 0) {
      ElMessage.warning(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      ElMessage.success(`成功删除 ${successCount} 个镜头`)
    }
    
    // 清空选择并刷新
    selectedShotIds.value = []
    selectedVideos.value = []
    await loadScenes()
    await loadShots()
  } catch (err) {
    if (err === 'cancel') return
    console.error('批量删除操作异常:', err)
  }
}

const handleBatchSelect = () => {
  ElMessage.info('批量选择模式')
}

// 视频页表格「场景」列展示（与分镜页同源数据）
const formatSceneColumn = (row) => {
  const num = row.scene_display_number
  let title = row.scene_display_title || ''
  // 去掉title中已有的"场景X"前缀，避免重复显示"场景6·场景6"
  if (title && num !== '' && num !== undefined && num !== null) {
    title = title.replace(new RegExp(`^场景\\s*${num}[·.\\s]*`, 'i'), '')
  }
  if (title && num !== '' && num !== undefined && num !== null) {
    return `场景${num} · ${title}`
  }
  if (title) return title
  if (num !== '' && num !== undefined && num !== null) return `场景 ${num}`
  return '—'
}

/** 点击表格行打开分镜编辑（避免与操作列按钮冲突） */
const handleVideoTableRowClick = (row, column, event) => {
  if (column?.label === '操作') return
  const t = event?.target
  if (t && typeof t.closest === 'function' && t.closest('.el-button')) return
  handleShotClick(row)
}

// ===== 问题3修复：分镜详情查看和编辑功能 =====
const handleLipSync = async () => {
  if (!currentShot.value?.id) return
  
  try {
    const res = await shotsAPI.lipSync(currentShot.value.id)
    if (res.success) {
      ElMessage.success('口型同步任务已提交，请稍候...')
      currentShot.value.lip_sync_status = 'processing'
      // 开始轮询该镜头的状态
      pollLipSyncStatus(currentShot.value.id)
    }
  } catch (err) {
    console.error('口型同步失败:', err)
    ElMessage.error(err.response?.data?.message || '任务提交失败')
  }
}

const pollLipSyncStatus = (shotId) => {
  const timer = setInterval(async () => {
    try {
      const res = await shotsAPI.get(shotId)
      if (res.success && res.data) {
        const shot = res.data
        if (currentShot.value?.id === shotId) {
          currentShot.value.lip_sync_status = shot.lip_sync_status
          currentShot.value.lip_sync_video_url = shot.lip_sync_video_url
          currentShot.value.video_url = shot.video_url
        }
        
        if (shot.lip_sync_status === 'completed' || shot.lip_sync_status === 'failed') {
          clearInterval(timer)
          if (shot.lip_sync_status === 'completed') {
            ElMessage.success('口型同步已完成！')
            await loadShots() // 刷新列表
          }
        }
      }
    } catch (err) {
      console.error('轮询口型同步状态失败:', err)
      clearInterval(timer)
    }
  }, 2000)
}

// 分镜配音库选择相关
const showShotAudioLibrary = ref(false)
const shotLibraryFilter = ref('voice')
const filteredShotLibrary = computed(() => {
  if (shotLibraryFilter.value === 'all') return audioLibrary.value
  return audioLibrary.value.filter(item => item.audio_type === shotLibraryFilter.value)
})

const handleSelectShotAudio = async (asset) => {
  if (!currentShot.value) return
  
  try {
    // 更新本地状态
    currentShot.value.audio_url = asset.file_path
    // 同步到后端
    await shotsAPI.update(currentShot.value.id, { audio_url: asset.file_path })
    ElMessage.success(`已选择 "${asset.filename}" 作为配音`)
    showShotAudioLibrary.value = false
    await loadShots() // 刷新列表
  } catch (err) {
    console.error('更新分镜音频失败:', err)
    ElMessage.error('选择音频失败')
  }
}


/*
// 监听分镜库弹窗打开
watch(showShotAudioLibrary, (val) => {
  if (val) {
    loadAudioLibrary()
  }
})
  if (!shot?.id) {
    ElMessage.warning('镜头数据异常，请刷新页面后重试')
    return
  }
  const { scene_display_title, scene_display_number, scene_id, ...rest } = shot
  currentShot.value = JSON.parse(JSON.stringify(rest))
  // 确保角度有默认值
  if (!currentShot.value.character_angle) {
    currentShot.value.character_angle = 'front'
  }
  showShotDetailDialog.value = true
}
*/

watch(showShotAudioLibrary, (val) => {
  if (val) {
    loadAudioLibrary()
  }
})

// 打开分镜详情
const openShotDetail = (shot) => {
  if (!shot?.id) {
    ElMessage.warning('镜头数据异常，请刷新页面后重试')
    return
  }
  const { scene_display_title, scene_display_number, scene_id, ...rest } = shot
  currentShot.value = JSON.parse(JSON.stringify(rest))
  // 确保角度有默认值
  if (!currentShot.value.character_angle) {
    currentShot.value.character_angle = 'front'
  }
  showShotDetailDialog.value = true
}

// 点击分镜查看详情（handleShotClick = openShotDetail 的别名）
const handleShotClick = (shot) => {
  openShotDetail(shot)
}


const getShotCharRef = (shot) => {
  if (!shot || !shot.character_id) return ''
  const char = characters.value.find(c => c.id === shot.character_id)
  if (!char) return ''
  
  const angle = shot.character_angle || 'front'
  if (angle === 'side' && char.side_image_url) return char.side_image_url
  if (angle === 'back' && char.back_image_url) return char.back_image_url
  
  return char.front_image_url || char.image_url || char.reference_image
}

const handleDeleteShotFromDialog = async () => {
  if (!currentShot.value?.id) return
  await handleDeleteShot(currentShot.value)
}

const handleShotDetailRefChange = (file) => {
  // 直接上传文件到服务器，不存base64
  if (!currentShot.value?.id) return
  shotsAPI.uploadRefImage(currentShot.value.id, file.raw, 'reference_image_url').then(res => {
    if (res.success || res.data?.success) {
      const imageUrl = res.imageUrl || res.data?.imageUrl
      currentShot.value.reference_image_url = imageUrl
      ElMessage.success('参考图上传成功')
      handleSaveShot()
    }
  }).catch(err => {
    console.error('上传参考图失败:', err)
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
  })
}

const handleShotRefUpload = (file, shot) => {
  shotsAPI.uploadRefImage(shot.id, file.raw, 'reference_image_url').then(res => {
    if (res.success || res.data?.success) {
      const imageUrl = res.imageUrl || res.data?.imageUrl
      shot.reference_image_url = imageUrl
      ElMessage.success('场景参考图上传成功')
    }
  }).catch(err => {
    console.error('上传场景参考图失败:', err)
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
  })
}

const handleSaveShot = async () => {
  if (!currentShot.value) return
  
  savingShot.value = true
  try {
    await shotsAPI.update(currentShot.value.id, {
      shot_number: currentShot.value.shot_number,
      shot_type: currentShot.value.shot_type,
      camera_movement: currentShot.value.camera_movement,
      visual_description: currentShot.value.visual_description,
      dialogue: currentShot.value.dialogue,
      duration: currentShot.value.duration,
      character_id: currentShot.value.character_id,
      character_angle: currentShot.value.character_angle,
      scene_image_url: currentShot.value.scene_image_url,
      reference_image_url: currentShot.value.reference_image_url
    })
    showShotDetailDialog.value = false
    ElMessage.success('分镜保存成功')
    await loadScenes(true)
    await loadShots(true)
  } catch (err) {
    console.error('保存分镜失败:', err)
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message))
  } finally {
    savingShot.value = false
  }
}

// ==================== 视频操作 ====================
const loadShots = async (forceReload = false) => {
  if (!currentScriptId.value) {
    videoList.value = []
    videoListKey.value = ''
    shotCount.value = 0
    return
  }
  const key = `${userStore.currentProject?.id || ''}:${currentScriptId.value || ''}`
  if (!forceReload && videoList.value.length > 0 && videoListKey.value === key) return
  loadingVideos.value = true
  try {
    // forceReload时重新加载scenes的shots数据
    if (forceReload || !scenes.value.length) {
      await loadScenes(forceReload)
    }
    // 从scenes数据构建videoList（优先用已有数据）
    const allShots = []
    for (const scene of scenes.value) {
      const sceneTitle = scene.title || '未命名场景'
      const sceneNum = scene.scene_number ?? ''
      for (const s of (scene.shots || [])) {
        allShots.push({
          ...s,
          scene_display_title: sceneTitle,
          scene_display_number: sceneNum,
          scene_id: scene.id
        })
      }
    }
    allShots.sort((a, b) => {
      const an = String(a.scene_display_number ?? '')
      const bn = String(b.scene_display_number ?? '')
      const c = an.localeCompare(bn, undefined, { numeric: true })
      if (c !== 0) return c
      return (Number(a.shot_number) || 0) - (Number(b.shot_number) || 0)
    })
    videoList.value = allShots
    videoListKey.value = key
    shotCount.value = allShots.length
  } finally {
    loadingVideos.value = false
  }
}

// 表格选择变化
const handleSelectionChange = (selection) => {
  selectedVideos.value = selection
  selectedShotIds.value = selection.map(s => s.id)
}

// ===== 问题4修复：只生成被选中的分镜 =====
const handleBatchGenerate = async () => {
  let targetShots = []
  
  if (selectedShotIds.value.length > 0) {
    // 有选中的镜头，只生成选中的
    targetShots = videoList.value.filter(v => 
      selectedShotIds.value.includes(v.id) && v.video_status !== 'completed'
    )
    if (targetShots.length === 0) {
      ElMessage.info('选中的镜头都已生成完成')
      return
    }
  } else {
    // 没有选中的，生成所有未完成的
    targetShots = videoList.value.filter(v => v.video_status !== 'completed')
    if (targetShots.length === 0) {
      ElMessage.info('所有镜头已生成完成')
      return
    }
  }
  
  ElMessage.success(`开始批量生成 ${targetShots.length} 个镜头...`)
  
  let successCount = 0
  let failCount = 0
  
  for (const shot of targetShots) {
    try {
      if (!shot.scene_image_url) {
        failCount++
        console.warn('镜头' + shot.shot_number + '没有首帧图，跳过')
        continue
      }
      const res = await videosAPI.generateShot(shot.id, { withAudio: true, model: videoModel.value })
      if (res.success && res.taskId) {
        cogVideoTaskIds.value[shot.id] = res.taskId
        pollCogVideoStatus(shot.id)
      }
      successCount++
    } catch (err) {
      console.error(`生成镜头 ${shot.id} 失败:`, err)
      failCount++
    }
  }
  
  if (failCount > 0) {
    ElMessage.warning(`生成任务提交完成：成功 ${successCount} 个，失败 ${failCount} 个`)
  } else {
    ElMessage.success(`${successCount} 个视频生成任务已提交`)
  }

  await loadScenes()
  await loadShots()

  // 清空选择
  selectedShotIds.value = []
  selectedVideos.value = []
}

const handleMergeAll = async () => {
  if (!userStore.currentProject?.id) {
    ElMessage.warning('请先选择项目')
    return
  }
  
  ElMessage.success('正在拼接视频...')
  try {
    await videosAPI.merge({ project_id: userStore.currentProject.id })
    ElMessage.success('视频拼接任务已提交')
  } catch (err) {
    console.error('视频拼接失败:', err)
    ElMessage.error('视频拼接失败: ' + (err.response?.data?.message || err.message))
  }
}

const handleGenerateSingle = async (row) => {
  ElMessage.success(`正在生成镜头 ${row.shot_number}...`)
  try {
    if (!row.scene_image_url) {
      ElMessage.warning('请先生成分镜图片')
      return
    }
    const res = await videosAPI.generateShot(row.id, { withAudio: true, model: videoModel.value })
    if (res.success && res.taskId) {
      cogVideoTaskIds.value[row.id] = res.taskId
      pollCogVideoStatus(row.id)
      ElMessage.success('CogVideoX视频生成任务已提交')
    } else {
      ElMessage.error(res.message || '视频生成失败')
    }
    await loadShots()
  } catch (err) {
    console.error('生成视频失败:', err)
    ElMessage.error('生成失败: ' + (err.response?.data?.message || err.message))
  }
}

// 视频预览（右侧面板中播放）
const currentPreviewVideo = ref(null)
const showVideoPlayer = ref(false)

const handlePreviewVideo = (row) => {
  if (row.video_url || row.result_url) {
    selectedCharacter.value = null  // 清除角色详情
    currentPreviewVideo.value = row
    showVideoPlayer.value = true
    ElMessage.info('点击视频预览区域播放视频')
  } else {
    ElMessage.warning('暂无视频文件')
  }
}

// 视频下载
const handleDownloadVideo = async (row) => {
  const videoUrl = row.result_url || row.video_url
  if (!videoUrl) {
    ElMessage.warning('暂无视频文件可下载')
    return
  }
  
  try {
    ElMessage.info('正在准备下载...')
    
    // 创建下载链接
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = `video_${row.id || row.shot_number || 'shot'}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('开始下载视频')
  } catch (err) {
    console.error('下载视频失败:', err)
    ElMessage.error('下载失败: ' + err.message)
  }
}

const handleRegenerate = async (row) => {
  ElMessage.success('正在重新生成...')
  try {
    await videosAPI.regenerate(row.id, {})
    ElMessage.success('重新生成任务已提交')
    await loadShots()
  } catch (err) {
    console.error('重新生成失败:', err)
    ElMessage.error('重新生成失败: ' + (err.response?.data?.message || err.message))
  }
}

// ==================== 音频操作 ====================
const loadVoices = async () => {
  try {
    const response = await audioAPI.getVoices()
    voiceList.value = response.data || response || []
  } catch (err) {
    console.error('加载音色失败:', err)
  }
}

const loadBGMList = async () => {
  loadingBGM.value = true
  try {
    const response = await audioAPI.getBGMPresets()
    bgmList.value = response.data || response || []
  } catch (err) {
    console.error('加载BGM失败:', err)
  } finally {
    loadingBGM.value = false
  }
}

const loadSFXList = async () => {
  loadingSFX.value = true
  try {
    const response = await audioAPI.getSFXPresets()
    sfxList.value = response.data || response || []
  } catch (err) {
    console.error('加载SFX失败:', err)
  } finally {
    loadingSFX.value = false
  }
}

const handleGenerateTTS = async () => {
  if (!ttsForm.voiceId || !ttsForm.text) {
    ElMessage.warning('请选择音色并输入台词')
    return
  }
  if (!currentScriptId.value) {
    ElMessage.warning('请先选择一个剧本')
    return
  }
  
  ttsLoading.value = true
  try {
    // 后端 generate-voice 期待 shot_id, text, voice_id
    await audioAPI.generateVoice({
      shot_id: currentShot.value?.id || 0, // 如果没有具体shot，可能需要调整逻辑
      voice_id: ttsForm.voiceId,
      text: ttsForm.text,
      volume: ttsForm.volume,
      speed: ttsForm.speed
    })
    ElMessage.success('配音生成任务已提交')
    userStore.fetchCredits() // 刷新积分余额
  } catch (err) {
    console.error('生成配音失败:', err)
    ElMessage.error('生成配音失败: ' + (err.response?.data?.message || err.message))
  } finally {
    ttsLoading.value = false
  }
}

const handlePreviewTTS = () => {
  ElMessage.info('试听配音')
}

const handleSelectBGM = (bgm) => {
  selectedBGM.value = bgm
}

// ===== 问题5修复：BGM应用失败时增加详细错误日志 =====
const handleApplyBGM = async () => {
  if (!selectedBGM.value) {
    ElMessage.warning('请先选择背景音乐')
    return
  }
  if (!currentScriptId.value) {
    ElMessage.warning('请先选择一个剧本')
    return
  }
  
  bgmLoading.value = true
  try {
    console.log('应用背景音乐，参数:', {
      scene_id: currentScriptId.value,
      bgm_preset_id: selectedBGM.value.id,
      bgm_name: selectedBGM.value.name,
      volume: bgmVolume.value
    })
    
    await audioAPI.applyBgm({
      scene_id: currentScene.value?.id || scenes.value[0]?.id,
      bgm_id: selectedBGM.value.id,
      volume: bgmVolume.value
    })
    
    ElMessage.success('背景音乐应用成功')
  } catch (err) {
    console.error('应用背景音乐失败 - 详细错误:', {
      error: err,
      response: err.response,
      message: err.message,
      data: err.response?.data,
      status: err.response?.status,
      request_params: {
        scene_id: currentScriptId.value,
        bgm_preset_id: selectedBGM.value.id,
        volume: bgmVolume.value
      }
    })
    ElMessage.error('应用失败: ' + (err.response?.data?.message || err.message || '未知错误'))
  } finally {
    bgmLoading.value = false
  }
}

const handleSelectSFX = (sfx) => {
  selectedSFX.value = sfx
}

// ===== 问题5修复：SFX应用失败时增加详细错误日志 =====
const handleApplySFX = async () => {
  if (!selectedSFX.value) {
    ElMessage.warning('请先选择环境音效')
    return
  }
  if (!currentScriptId.value) {
    ElMessage.warning('请先选择一个剧本')
    return
  }
  
  sfxLoading.value = true
  try {
    console.log('应用环境音效，参数:', {
      scene_id: currentScriptId.value,
      sfx_preset_id: selectedSFX.value.id,
      sfx_name: selectedSFX.value.name,
      volume: sfxVolume.value
    })
    
    await audioAPI.applySfx({
      scene_id: currentScene.value?.id || scenes.value[0]?.id,
      sfx_id: selectedSFX.value.id,
      volume: sfxVolume.value
    })
    
    ElMessage.success('环境音效应用成功')
  } catch (err) {
    console.error('应用环境音效失败 - 详细错误:', {
      error: err,
      response: err.response,
      message: err.message,
      data: err.response?.data,
      status: err.response?.status,
      request_params: {
        scene_id: currentScriptId.value,
        sfx_preset_id: selectedSFX.value.id,
        volume: sfxVolume.value
      }
    })
    ElMessage.error('应用失败: ' + (err.response?.data?.message || err.message || '未知错误'))
  } finally {
    sfxLoading.value = false
  }
}

// ===== 问题6修复：优化试听功能，使用Audio对象播放 =====
const playAudioPreview = (audioUrl) => {
  if (!audioUrl) {
    ElMessage.warning('暂无试听音频')
    return
  }
  
  try {
    // 如果已有播放器在播放，先停止
    if (audioPlayer.value) {
      audioPlayer.value.pause()
      audioPlayer.value = null
    }
    
    const fullUrl = getAssetUrl(audioUrl)
    audioPlayer.value = new Audio(fullUrl)
    
    audioPlayer.value.onplay = () => {
      ElMessage.info('开始播放试听...')
    }
    
    audioPlayer.value.onended = () => {
      ElMessage.info('播放结束')
      audioPlayer.value = null
    }
    
    audioPlayer.value.onerror = (e) => {
      console.error('音频播放失败:', e)
      ElMessage.error('音频播放失败，请检查网络连接')
      audioPlayer.value = null
    }
    
    audioPlayer.value.play().catch(err => {
      console.error('播放音频失败:', err)
      ElMessage.error('播放失败: ' + err.message)
    })
    
  } catch (err) {
    console.error('创建音频播放器失败:', err)
    ElMessage.error('播放失败: ' + err.message)
  }
}

// ==================== 其他操作 ====================
const handleTabChange = (tab) => {
  activeTab.value = tab
  emit('tab-change', tab)
  loadTabData(tab)
}

const handleTutorial = () => {
  ElMessage.info('新手教程')
}

const handleHelp = () => {
  ElMessage.info('使用帮助')
}

const handleShortcuts = () => {
  ElMessage.info('快捷键列表')
}

const goToMemberCenter = () => {
  router.push('/member')
}

const handleUpgrade = () => {
  goToMemberCenter()
}

const handleNewScript = () => {
  showAiDialog.value = true
}

const handleNewCharacter = () => {
  isEditingCharacter.value = false
  currentEditingCharacter.value = null
  charForm.name = ''
  charForm.gender = ''
  charForm.occupation = ''
  charForm.description = ''
  showCharacterDialog.value = true
}

const handleGenerateVideo = async () => {
  activeTab.value = 'video'
  emit('tab-change', 'video')
  await loadTabData('video')
}

const handleExport = async () => {
  if (!userStore.currentProject?.id) {
    ElMessage.warning('请先选择项目')
    return
  }

  showExportDialog.value = true
  if (!isExporting.value && exportStatus.status !== 'processing') {
    resetExportState()
  }
}

const handleVersionManage = () => {
  ElMessage.info('版本管理')
}

// ==================== 欢迎页面方法 ====================
const handleCreateProject = () => {
  // 触发父组件创建项目
  emit('create-project')
}

const handleUploadScriptWelcome = async (file) => {
  // 先创建一个默认项目
  try {
    ElMessage.info('正在创建项目...')
    // 这里假设projectsAPI有create方法，或者触发父组件
    emit('create-and-upload', file)
  } catch (err) {
    console.error('创建项目失败:', err)
    ElMessage.error('创建项目失败，请重试')
  }
  return false
}

// ==================== 工具方法 ====================
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const getCameraTagType = (camera) => {
  const types = { '固定': 'info', '推镜头': 'primary', '拉镜头': 'success', '摇镜头': 'warning' }
  return types[camera] || 'info'
}

const getVideoStatusType = (status) => {
  const types = {
    completed: 'success',
    pending: 'info',
    generating: 'warning',
    processing: 'warning',
    failed: 'danger',
    none: 'info',
  }
  return types[status] || 'info'
}

const getVideoStatusText = (status) => {
  const texts = {
    completed: '已完成',
    pending: '待生成',
    generating: '生成中',
    processing: '生成中',
    failed: '失败',
    none: '未生成',
  }
  return texts[status] || '未知'
}

// ==================== 分镜卡片增强方法 ====================
const getShotStatusType = (status) => {
  const types = {
    completed: 'success',
    pending: 'info',
    generating: 'warning',
    processing: 'warning',
    failed: 'danger',
  }
  return types[status] || 'info'
}

const getShotStatusText = (status) => {
  const texts = {
    completed: '已完成',
    pending: '待生成',
    generating: '生成中',
    processing: '生成中',
    failed: '失败',
  }
  return texts[status] || '待生成'
}

// ==================== 结构化提示词辅助方法 ====================
// 获取结构化视觉提示词
const getVisualPrompt = (shot) => {
  if (shot.visual_prompt_json && typeof shot.visual_prompt_json === 'object') {
    return shot.visual_prompt_json;
  }
  // 兼容：可能是JSON字符串
  if (typeof shot.visual_prompt_json === 'string') {
    try { return JSON.parse(shot.visual_prompt_json); } catch(e) {}
  }
  return null;
}

// 获取动作提示词
const getActionPrompt = (shot) => {
  if (shot.action_prompt_json && typeof shot.action_prompt_json === 'object') {
    return shot.action_prompt_json;
  }
  if (typeof shot.action_prompt_json === 'string') {
    try { return JSON.parse(shot.action_prompt_json); } catch(e) {}
  }
  return null;
}

// 获取情绪提示词
const getEmotionCue = (shot) => {
  if (shot.emotion_cue_json && typeof shot.emotion_cue_json === 'object') {
    return shot.emotion_cue_json;
  }
  if (typeof shot.emotion_cue_json === 'string') {
    try { return JSON.parse(shot.emotion_cue_json); } catch(e) {}
  }
  return null;
}

// 获取旁白
const getNarration = (shot) => {
  return shot.narration || '';
}

// 情绪emoji映射
const getEmotionEmoji = (emotion) => {
  const map = {
    '悲伤': '😢', '难过': '😢', '痛苦': '😢', '压抑': '😢',
    '开心': '😊', '快乐': '😊', '喜悦': '😊', '兴奋': '😊',
    '愤怒': '😡', '生气': '😡', '暴怒': '😡',
    '恐惧': '😨', '害怕': '😨', '惊恐': '😨',
    '惊讶': '😲', '震惊': '😲',
    '平静': '😌', '淡然': '😌', '冷漠': '😌',
    '紧张': '😰', '焦虑': '😰',
    '温柔': '🥰', '爱': '🥰',
  };
  for (const [key, emoji] of Object.entries(map)) {
    if (emotion && emotion.includes(key)) return emoji;
  }
  return '💭';
}

const handleGenerateSceneVideo = async (scene) => {
  ElMessage.success(`正在生成场景 ${scene.scene_number} 的所有视频...`)
  // 生成场景下所有镜头的视频
  for (const shot of scene.shots || []) {
    if (shot.video_status !== 'completed') {
      await handleGenerateShotVideo(shot)
    }
  }
}

const handleGenerateShotVideo = async (shot) => {
  try {
    if (!shot?.id) {
      ElMessage.warning('镜头数据异常')
      return
    }
    
    // 检查是否正在生成中
    if (shot.video_status === 'processing' || shot.video_status === 'generating') {
      ElMessage.warning('该镜头正在生成中，请稍候')
      return
    }
    
    // 已有视频时确认是否重新生成
    if (shot.video_status === 'completed' && shot.video_url) {
      try {
        await ElMessageBox.confirm(
          '该镜头已生成视频，是否重新生成？',
          '提示',
          { confirmButtonText: '重新生成', cancelButtonText: '取消', type: 'warning' }
        )
      } catch {
        return // 用户取消
      }
    }
    
    if (!shot.scene_image_url) {
      ElMessage.warning('镜头 #' + shot.shot_number + '没有首帧图，请先生成图片')
      return
    }
    const res = await videosAPI.generateShot(shot.id, { withAudio: true, model: videoModel.value })
    if (res.success && res.taskId) {
      cogVideoTaskIds.value[shot.id] = res.taskId
      pollCogVideoStatus(shot.id)
      ElMessage.success('镜头 #' + shot.shot_number + ' CogVideoX视频生成任务已提交')
    } else {
      ElMessage.error(res.message || '视频生成失败')
      return
    }
    await loadScenes()
    await loadShots()
    userStore.fetchCredits() // 刷新积分余额
  } catch (err) {
    console.error('生成视频失败:', err)
    ElMessage.error('生成失败: ' + (err.response?.data?.message || err.message))
  }
}

const handlePreviewShotVideo = (shot) => {
  if (shot.video_url) {
    window.open(shot.video_url, '_blank')
  } else {
    ElMessage.info('暂无视频可预览')
  }
}

const handleSceneHeaderClick = (scene, evt) => {
  if (evt?.target?.closest?.('.scene-actions-enhanced')) return
  handleEditScene(scene)
}

const handleEditScene = (scene) => {
  if (!scene?.id) {
    ElMessage.warning('场景数据异常，请刷新后重试')
    return
  }
  currentScene.value = JSON.parse(JSON.stringify(scene))
  showSceneDetailDialog.value = true
}

const handleSaveSceneDetail = async () => {
  if (!currentScene.value?.id) return
  savingSceneDetail.value = true
  try {
    await scenesAPI.update(currentScene.value.id, {
      title: currentScene.value.title,
      location: currentScene.value.location,
      time_of_day: currentScene.value.time_of_day,
      content: currentScene.value.content,
      characters: currentScene.value.characters
    })
    ElMessage.success('场景已保存')
    showSceneDetailDialog.value = false
    await loadScenes()
    await loadShots()
  } catch (err) {
    console.error('保存场景失败:', err)
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message))
  } finally {
    savingSceneDetail.value = false
  }
}

const handleAddShot = async (scene) => {
  if (!scene?.id) {
    ElMessage.warning('场景无效')
    return
  }
  try {
    const maxNum = Math.max(0, ...(scene.shots || []).map(s => Number(s.shot_number) || 0))
    const nextNum = maxNum + 1
    await shotsAPI.create({
      scene_id: scene.id,
      shot_number: nextNum,
      visual_description: '',
      duration: 3
    })
    ElMessage.success('已添加镜头')
    await loadScenes()
    await loadShots()
  } catch (err) {
    console.error('添加镜头失败:', err)
    ElMessage.error('添加失败: ' + (err.response?.data?.message || err.message))
  }
}

const handleMoveShot = async (scene, shot, direction) => {
  if (!scene?.id || !shot?.id) return
  const shots = [...(scene.shots || [])].sort((a, b) => (Number(a.shot_number) || 0) - (Number(b.shot_number) || 0))
  const idx = shots.findIndex(s => s.id === shot.id)
  if (idx < 0) return
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= shots.length) return
  const a = shots[idx]
  const b = shots[targetIdx]
  try {
    await shotsAPI.update(a.id, { shot_number: b.shot_number })
    await shotsAPI.update(b.id, { shot_number: a.shot_number })
    await loadScenes(true)
    await loadShots(true)
    ElMessage.success('顺序已更新')
  } catch (err) {
    console.error('调整顺序失败:', err)
    ElMessage.error('调整顺序失败: ' + (err.response?.data?.message || err.message))
  }
}
</script>

<style scoped>
.workspace-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #e8ecf1;
}

/* 欢迎页面样式 */
.welcome-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow-y: auto;
}

.welcome-content {
  max-width: 800px;
  width: 100%;
  text-align: center;
  color: #fff;
}

.welcome-icon {
  margin-bottom: 24px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.welcome-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.welcome-desc {
  font-size: 18px;
  opacity: 0.9;
  margin: 0 0 40px 0;
}

.welcome-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 60px;
  flex-wrap: wrap;
}

.welcome-actions .el-button {
  padding: 0 32px;
  height: 50px;
  font-size: 16px;
  border-radius: 25px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.welcome-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 48px;
}

.feature-item {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s;
}

.feature-item:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.25);
}

.feature-icon {
  margin-bottom: 12px;
}

.feature-item h3 {
  font-size: 18px;
  margin: 0 0 8px 0;
}

.feature-item p {
  font-size: 14px;
  opacity: 0.85;
  margin: 0;
  line-height: 1.5;
}

.welcome-steps {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px 32px;
  backdrop-filter: blur(10px);
}

.welcome-steps h3 {
  font-size: 18px;
  margin: 0 0 20px 0;
}

.steps-list {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  color: #667eea;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.step-text {
  font-size: 14px;
  opacity: 0.9;
}

/* 顶部工具栏 */
.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: #ffffff;
  border-bottom: 2px solid #d0d5dd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.credit-display {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.3s;
  color: #e6a23c;
  font-weight: 600;
  font-size: 14px;
}

.credit-display:hover {
  background: rgba(230, 162, 60, 0.1);
}

.header-right {
  display: flex;
  align-items: center;
}

.auto-gen-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  font-weight: bold;
  padding: 12px 24px;
  height: auto;
  box-shadow: 0 4px 15px rgba(118, 75, 162, 0.3);
  transition: all 0.3s;
  color: white;
}

.auto-gen-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(118, 75, 162, 0.4);
  opacity: 0.9;
}

.auto-gen-progress {
  padding: 10px 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 500;
}

.current-step {
  color: #606266;
}

.percentage {
  color: #409eff;
}

.auto-gen-tips {
  margin-top: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 13px;
}

.workspace-content {
  font-size: 18px;
  font-weight: 700;
  color: #1a1f36;
  margin: 0;
}

.quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-actions .el-button {
  font-size: 13px;
  color: #404758;
}

.quick-actions .el-button:hover {
  color: #409eff;
}

.quick-actions .el-divider {
  margin: 0 4px;
  color: #d0d5dd;
}

/* 工作区主体 */
.workspace-content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

/* 左列 */
.content-left {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

/* 项目概览卡片 */
.overview-card {
  border-radius: 12px;
  border: 3px solid #b8bfc9;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  background: #ffffff;
}

.project-overview {
  display: flex;
  gap: 12px;
}

.project-cover {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #e8ecf1;
}

.project-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 32px;
}

.project-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1a1f36;
}

.project-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #606770;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #404758;
}

.progress-value {
  font-weight: 700;
  color: #409eff;
}

.project-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.update-time {
  color: #606770;
}

/* 快捷操作 */
.quick-operations {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  border: 2px solid #d0d5dd;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 700;
  color: #1a1f36;
}

.operation-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.op-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 6px;
  background: #f5f7fa;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 65px;
  overflow: hidden;
}

.op-btn:hover {
  background: #e8f3ff;
  transform: translateY(-2px);
}

.op-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #409eff;
  background: #f0f2f5;
}

/* 确保 el-icon 组件样式正确穿透 */
.op-btn :deep(.el-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: inherit;
}

.op-btn :deep(.el-icon svg) {
  width: 18px;
  height: 18px;
}

.op-btn span {
  font-size: 12px;
  color: #606266;
}

/* 中列内容区 */
.content-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.creation-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.creation-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.creation-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow-y: auto;
}

.tab-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  border: 3px solid #b8bfc9;
  overflow-y: auto;
  min-height: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.tab-content.storyboard-content {
  overflow-y: auto;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.content-toolbar {
  padding: 16px;
  border-bottom: 2px solid #e8ecf1;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  background: #fafbfc;
}

/* 剧本列表 */
.script-content {
  overflow: hidden;
}

.script-list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-content: start;
}

.script-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid #e8ecf1;
  border-radius: 12px;
}

.script-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.15);
  border-color: #409eff;
}

.script-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.script-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1a1f36;
}

.script-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #606770;
  margin-bottom: 12px;
}

.script-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px;
}

/* 角色列表 */
.character-content {
  overflow: hidden;
}

.character-grid {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  align-content: start;
}

.character-card-enhanced {
  cursor: pointer;
  transition: all 0.3s;
  overflow: hidden;
  border: 2px solid #d0d5dd;
  border-radius: 14px;
}

.character-card-enhanced:hover {
  transform: translateY(-5px);
  border-color: #409eff;
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.2);
}

.char-avatar-enhanced {
  position: relative;
  height: 240px;
  background: #f5f7fa;
}

.char-avatar-enhanced img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.char-angle-badges {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.char-info-enhanced {
  padding: 14px;
  background: #ffffff;
}

.char-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.char-name {
  font-weight: 700;
  font-size: 16px;
  color: #1a1f36;
}

.char-stats-row {
  font-size: 12px;
  color: #606770;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.char-actions-enhanced {
  display: flex;
  justify-content: flex-end;
  border-top: 2px solid #e8ecf1;
  padding-top: 10px;
}

/* 多角度上传器 */
.multi-angle-container {
  display: flex;
  justify-content: space-around;
  gap: 20px;
  padding: 20px 0;
}

.angle-item {
  text-align: center;
}

.angle-label {
  margin-bottom: 10px;
  font-size: 13px;
  color: #606266;
}

.angle-uploader {
  width: 150px;
  height: 200px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.angle-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.angle-icon {
  font-size: 28px;
  color: #8c939d;
}

/* 预设样式 */
.preset-section {
  padding: 10px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  font-weight: 500;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #f0f2f5;
  border-radius: 4px;
}

.preset-uploader {
  width: 60px;
  height: 60px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preset-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 分镜列表 */
.storyboard-content {
  overflow-y: auto;
}

.scene-list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 增强版分镜卡片样式 */
.scene-card-enhanced {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  width: 100%;
  margin-bottom: 20px;
  border: 3px solid #a8afba;
}

.scene-card-enhanced:hover {
  box-shadow: 0 12px 36px rgba(64, 158, 255, 0.25);
  border-color: #409eff;
}

.scene-header-enhanced {
  cursor: pointer;
  user-select: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 18px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: none;
  flex-wrap: wrap;
}

.scene-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

.scene-number-enhanced {
  color: #fff;
}

.scene-title-row {
  flex: 1;
  min-width: 0;
}

.scene-title-enhanced {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.scene-meta-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scene-meta-tags .el-tag {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
}

.scene-actions-enhanced {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.scene-actions-enhanced .el-button {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.scene-actions-enhanced .el-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.scene-expand-icon {
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  transition: transform 0.3s;
  flex-shrink: 0;
}

.scene-expand-icon.expanded {
  transform: rotate(180deg);
}

.scene-body {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 2000px; }
}

/* 镜头网格 */
.shots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  padding: 20px;
  background: #fafbfc;
}

/* 增强版镜头卡片 */
.shot-card-enhanced {
  background: #fff;
  border: 2px solid #d0d5dd;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.shot-card-enhanced:hover {
  border-color: #409eff;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(64, 158, 255, 0.25);
}

.shot-card-enhanced.selected {
  border-color: #67c23a;
  border-width: 3px;
  box-shadow: 0 0 0 4px rgba(103, 194, 58, 0.25);
}

.shot-card-enhanced.completed {
  border-color: #67c23a;
  border-width: 2px;
}

.shot-card-enhanced.completed .shot-thumb-enhanced {
  box-shadow: inset 0 0 0 3px #67c23a;
}

.shot-card-enhanced.generating {
  border-color: #e6a23c;
  border-width: 2px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 缩略图增强 */
.shot-thumb-enhanced {
  position: relative;
  width: 100%;
  height: 150px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  overflow: hidden;
}

.shot-thumb-enhanced img,
.shot-thumb-enhanced .el-image {
  width: 100%;
  height: 100%;
  display: block;
  cursor: pointer;
}
.shot-thumb-enhanced .el-image :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.shot-thumb-enhanced .el-image :deep(.el-image__error),
.shot-thumb-enhanced .el-image :deep(.el-image__placeholder) {
  width: 100%;
  height: 100%;
}

.thumb-placeholder-enhanced {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  gap: 8px;
  background: linear-gradient(135deg, #f8f9fb 0%, #eef1f5 100%);
}

.thumb-placeholder-enhanced span {
  font-size: 12px;
}

/* 悬停遮罩：始终不拦截点击事件，让图片预览和卡片点击能正常工作 */
.shot-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.shot-overlay .el-button,
.shot-overlay .el-select {
  pointer-events: auto;
}

.shot-card-enhanced:hover .shot-overlay {
  opacity: 1;
}

.shot-index {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
}

.shot-status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
}

/* 镜头信息 */
.shot-info-enhanced {
  padding: 14px;
}

.shot-type-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.shot-duration {
  font-size: 13px;
  color: #909399;
  font-weight: 500;
}

.shot-description {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scene-empty-shots-hint {
  padding: 16px 24px;
  margin: 12px 20px 16px;
  font-size: 13px;
  color: #909399;
  background: #f5f7fa;
  border-radius: 10px;
  border: 2px dashed #dcdfe6;
  text-align: center;
}

.shot-camera {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}

.shot-camera .el-icon {
  color: #409eff;
}

/* 结构化提示词区域 */
.shot-prompt-section {
  padding: 4px 0;
  font-size: 11px;
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
}
.shot-prompt-section::-webkit-scrollbar {
  width: 3px;
}
.shot-prompt-section::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}
.prompt-line {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 2px;
  color: #606266;
}
.prompt-label {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}
.prompt-text {
  flex: 1;
  word-break: break-all;
  color: #303133;
  font-size: 11px;
}
.prompt-color-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
  padding: 2px 0;
}
.shot-dialogue-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 0;
  font-size: 11px;
  margin-top: 4px;
}
.shot-dialogue {
  color: #409EFF;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shot-narration {
  color: #909399;
  font-style: italic;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 视频Tab提示词单元格 */
.video-prompt-cell {
  font-size: 11px;
  line-height: 1.4;
  color: #606266;
}
.video-prompt-cell div {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 添加镜头卡片 */
.shot-card-enhanced.add-shot {
  border: 2px dashed #dcdfe6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  cursor: pointer;
  color: #909399;
  transition: all 0.3s;
}

.shot-card-enhanced.add-shot:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}

.add-shot-icon {
  color: #c0c4cc;
  margin-bottom: 8px;
  transition: color 0.3s;
}

.shot-card-enhanced.add-shot:hover .add-shot-icon {
  color: #409eff;
}

/* 视频列表 */
.video-content {
  overflow: hidden;
}

.video-list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.desc-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 音频相关 */
.audio-content {
  overflow-y: auto;
  padding: 12px 16px 12px 24px;
  font-size: 13px;
}

.audio-sub-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.audio-sub-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.audio-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
}

.tts-form {
  max-width: 600px;
}

.tts-params {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 8px 16px;
  margin-bottom: 16px;
}

.tts-params .el-form-item {
  margin-bottom: 8px;
}

.tts-params .el-slider {
  margin: 0 8px;
}

.section-toolbar {
  margin-bottom: 16px;
}

.preset-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  align-content: start;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.preset-item:hover {
  background: #e8f3ff;
}

.preset-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.preset-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.preset-icon.sfx-icon {
  background: #e6a23c;
}

.preset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.preset-duration {
  font-size: 12px;
  color: #909399;
}

.bgm-controls {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.detail-item-voice {
  margin: 15px 0;
  padding: 12px;
  background: #f8f9fb;
  border-radius: 8px;
  border-left: 4px solid #409eff;
}

.voice-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  font-weight: bold;
}

.voice-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lipsync-mini-status {
  margin-top: 8px;
  font-size: 12px;
  color: #e6a23c;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 音频库样式 */
.audio-library-container {
  padding: 10px 0;
}

.library-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.library-list {
  max-height: 500px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.library-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f8f9fb;
  border-radius: 8px;
  transition: all 0.3s;
}

.library-item:hover {
  background: #f0f2f5;
}

.asset-icon {
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #409eff;
  margin-right: 15px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.asset-info {
  flex: 1;
  min-width: 0;
}

.asset-name {
  font-weight: 500;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.asset-actions {
  display: flex;
  gap: 8px;
}

/* 迷你库列表 (弹窗用) */
.library-list-mini {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.library-item-mini {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.library-item-mini:hover {
  background: #f5f7fa;
  border-color: #409eff;
}

.library-item-mini.active {
  background: #ecf5ff;
  border-color: #409eff;
}

.char-select-row {
  display: flex;
  align-items: center;
}

.char-option {
  display: flex;
  align-items: center;
}

.char-ref-preview {
  margin-top: 10px;
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.char-ref-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shot-ref-image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shot-upload-btn {
  margin-left: 8px;
}

.shot-ref-upload-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shot-ref-uploader {
  width: 120px;
  height: 120px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
}

.shot-ref-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shot-ref-upload-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.voice-gender {
  color: #909399;
  margin-left: 8px;
}

/* ===== 右侧面板样式 ===== */
.content-right {
  width: 480px;
  flex-shrink: 0;
  padding-left: 16px;
  overflow-y: auto;
}

.right-panel {
  background: #fff;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
}

.panel-tab {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.3s;
}

.panel-tab:hover {
  color: #409eff;
  background: #f5f7fa;
}

.panel-tab.active {
  color: #409eff;
  border-bottom: 2px solid #409eff;
  font-weight: 500;
}

.panel-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.video-player-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  margin-bottom: 16px;
  cursor: pointer;
}

.preview-video {
  width: 100%;
  display: block;
  max-height: 200px;
}

.no-video-placeholder {
  width: 100%;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  background: #f5f7fa;
  font-size: 48px;
}

.no-video-placeholder p {
  font-size: 14px;
  margin-top: 12px;
}

.video-info {
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-item .label {
  color: #909399;
  width: 50px;
}

.info-item .value {
  color: #303133;
  font-weight: 500;
}

.video-actions {
  display: flex;
  gap: 12px;
}

.video-actions .el-button {
  flex: 1;
}

/* 角色预览面板 */
.character-preview-panel {
  text-align: center;
}

.character-avatar-large {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 16px;
  border: 3px solid #e8e8e8;
  cursor: pointer;
  transition: all 0.3s;
}

.character-avatar-large:hover {
  border-color: #409eff;
}

.character-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder-large {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 36px;
}

.avatar-placeholder-large span {
  font-size: 12px;
  margin-top: 8px;
}

.character-info h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.angles-display, .presets-display {
  margin-top: 20px;
  text-align: left;
}

.angles-display h5, .presets-display h5 {
  margin: 0 0 10px;
  color: #606266;
  font-size: 14px;
}

.angles-grid, .presets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.angle-thumb, .preset-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.angle-thumb img, .preset-thumb img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #f0f2f5;
}

.thumb-empty {
  width: 100%;
  height: 140px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #c0c4cc;
  font-weight: bold;
}

.angle-thumb span, .preset-thumb span {
  font-size: 11px;
  color: #909399;
}

.char-tags-large {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.char-desc {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  text-align: left;
  margin-bottom: 16px;
}

.reference-section {
  text-align: left;
  margin-bottom: 16px;
}

.reference-section h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.reference-image {
  width: 100%;
  border-radius: 8px;
  max-height: 150px;
  object-fit: cover;
}

.character-actions {
  display: flex;
  gap: 12px;
}

.character-actions .el-button {
  flex: 1;
}

.empty-panel {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 角色卡片选中状态 */
.character-card.card-selected {
  border: 2px solid #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

/* 头像加载动画 */
.avatar-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #409eff;
}

.char-avatar {
  position: relative;
}

/* 多视角生成按钮 */
.multi-view-actions {
  margin-top: 12px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.view-actions-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

/* 角度缩略图增强 */
.angles-grid .angle-thumb {
  position: relative;
}

.angles-grid .angle-thumb.has-image img {
  border: 2px solid #67c23a;
}

.angles-grid .angle-thumb .thumb-empty {
  cursor: pointer;
  transition: all 0.3s;
}

.angles-grid .angle-thumb .thumb-empty:hover {
  background: #409eff;
  color: #fff;
}

.angles-grid .angle-thumb .el-button {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;
}

.angles-grid .angle-thumb:hover .el-button {
  opacity: 1;
}

/* 批量生图进度 */
.batch-progress {
  margin: 0 16px;
  flex: 1;
  max-width: 200px;
}

.batch-progress .el-progress__text {
  font-size: 12px !important;
}

/* 场景动作按钮增强 */
.scene-actions-enhanced .el-button + .el-button {
  margin-left: 4px;
}

/* 场景图预览 */
.scene-image-preview {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  margin-top: 8px;
}

</style>

/* v5.0 角色一致性系统样式 */
.anchors-display {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}
.anchors-display h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #606266;
}
.anchors-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.anchor-item {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px;
}
.anchor-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.anchor-value {
  font-size: 12px;
  color: #303133;
  line-height: 1.4;
}

/* 变体管理弹窗样式 */
.variations-header {
  margin-bottom: 16px;
}
.variations-header .el-button {
  margin-right: 8px;
}


/* v5.2 TTS配音系统样式 */
.tts-container {
  padding: 16px;
}

.voice-sub-tabs {
  margin-top: 16px;
}

.voice-section {
  padding: 16px 0;
}

.voice-settings {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.voice-settings .tts-form {
  max-width: 400px;
}

/* 镜头配音列表样式 */
.shot-audio-list {
  margin-top: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.header-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.header-count {
  font-size: 12px;
  color: #909399;
}

.list-content {
  max-height: calc(100vh - 500px);
  min-height: 200px;
  overflow-y: auto;
}

.shot-audio-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.shot-audio-item:hover {
  background: #f5f7fa;
  border-color: #409eff;
}

.shot-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.shot-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  margin-right: 12px;
  flex-shrink: 0;
}

.shot-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shot-detail .character-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.shot-detail .dialogue-preview {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shot-voice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px;
}

.shot-actions {
  display: flex;
  gap: 8px;
}

/* 角色音色绑定样式 */
.character-voice-list {
  padding: 8px 0;
}

.character-voice-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 12px;
  transition: all 0.3s;
}

.character-voice-item:hover {
  background: #f5f7fa;
  border-color: #409eff;
}

.character-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.character-info .el-avatar {
  margin-right: 12px;
}

.character-detail {
  display: flex;
  flex-direction: column;
}

.character-detail .character-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.character-detail .character-desc {
  font-size: 12px;
  color: #909399;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-voice-select {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 音色选项样式 */
.voice-desc {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

/* 批量操作按钮样式 */
.batch-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

/* ==================== 时间轴编辑器样式 ==================== */
.timeline-editor {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  min-height: 320px;
}

/* 预览区域 */
.preview-area {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.preview-container {
  width: 100%;
  max-width: 640px;
  height: 200px;
  margin: 0 auto;
  background: #0f0f23;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-player,
.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #606266;
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding: 0 16px;
}

.time-display {
  font-size: 14px;
  color: #fff;
  font-family: monospace;
}

.total-duration {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}

/* 工具栏 */
.timeline-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #2d2d4a;
  margin-bottom: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 时间轴轨道容器 */
.timeline-track-container {
  position: relative;
  background: #0f0f23;
  border-radius: 6px;
  padding: 16px 0;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 120px;
}

/* 时间刻度 */
.time-ruler {
  position: relative;
  height: 24px;
  margin-bottom: 8px;
  margin-left: 0;
}

.scale-mark {
  position: absolute;
  height: 100%;
  border-left: 1px solid #3d3d5c;
}

.scale-label {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 10px;
  color: #909399;
  white-space: nowrap;
}

/* 播放头 */
.playhead {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: #f56c6c;
  z-index: 100;
  pointer-events: none;
}

.playhead-head {
  width: 12px;
  height: 12px;
  background: #f56c6c;
  border-radius: 2px;
  position: absolute;
  top: -2px;
  left: -5px;
  transform: rotate(45deg);
}

.playhead-line {
  position: absolute;
  top: 10px;
  width: 2px;
  bottom: 0;
  background: #f56c6c;
}

/* 剪辑轨道 */
.clips-track {
  position: relative;
  min-height: 80px;
  padding-top: 8px;
}

/* 剪辑项 */
.clip-item {
  position: absolute;
  top: 8px;
  height: 72px;
  min-width: 60px;
  background: #2d4a6f;
  border-radius: 6px;
  cursor: move;
  user-select: none;
  display: flex;
  align-items: center;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.1s;
  border: 2px solid transparent;
}

.clip-item:hover {
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.4);
}

.clip-item.selected {
  border-color: #409eff;
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.6);
}

.clip-item.has-video {
  background: linear-gradient(135deg, #409eff 0%, #2d7dcf 100%);
}

.clip-item.is-image {
  background: linear-gradient(135deg, #909399 0%, #606266 100%);
}

.clip-item.has-audio::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #67c23a;
}

/* 调整手柄 */
.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 10;
}

.resize-handle.left {
  left: 0;
  border-radius: 6px 0 0 6px;
}

.resize-handle.right {
  right: 0;
  border-radius: 0 6px 6px 0;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 缩略图 */
.clip-thumbnail {
  width: 50px;
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
}

.clip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  color: #909399;
}

/* 剪辑信息 */
.clip-info {
  flex: 1;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.clip-number {
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
}

.clip-duration {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
}

/* 音频指示器 */
.audio-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #67c23a;
}

/* 转场指示器 */
.transition-indicator {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  color: #e6a23c;
  font-size: 12px;
}

/* 空状态 */
.timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

/* 详情面板 */
.timeline-detail-panel {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d2d4a;
}

.detail-header h4 {
  margin: 0;
  color: #fff;
  font-size: 14px;
}

.detail-content {
  display: flex;
  gap: 16px;
}

.detail-thumbnail {
  width: 120px;
  height: 68px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.detail-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-row .label {
  font-size: 12px;
  color: #909399;
  min-width: 40px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* 视图切换 */
.view-toggle {
  margin-top: 12px;
}

/* 时间轴空提示 */
.timeline-empty .el-empty__description {
  color: #909399;
}

