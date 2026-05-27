/**
 * 节奏控制系统
 * 动态调整分镜节奏、镜头时长、情绪起伏
 */
class PaceController {
    constructor() {
        this.paceProfiles = {
            action: { avgShotDuration: 1.2, shotDensity: 0.8, emotionWave: 'fast' },
            drama: { avgShotDuration: 3.5, shotDensity: 0.4, emotionWave: 'slow' },
            thriller: { avgShotDuration: 2.0, shotDensity: 0.6, emotionWave: 'building' },
            romance: { avgShotDuration: 4.0, shotDensity: 0.3, emotionWave: 'gentle' },
            horror: { avgShotDuration: 1.8, shotDensity: 0.7, emotionWave: 'sudden' }
        };
        
        this.currentPace = null;
    }

    selectPaceProfile(sceneType, emotion) {
        const profileMap = {
            fight: 'action',
            chase: 'action',
            dialogue: 'drama',
            monologue: 'drama',
            suspense: 'thriller',
            romantic: 'romance',
            jump_scare: 'horror'
        };
        
        const profileName = profileMap[sceneType] || 'drama';
        this.currentPace = { ...this.paceProfiles[profileName] };
        return this.currentPace;
    }

    calculateShotDuration(index, totalShots, emotionIntensity) {
        const base = this.currentPace?.avgShotDuration || 3;
        const positionFactor = this.getPositionFactor(index, totalShots);
        const emotionFactor = 1 - (emotionIntensity * 0.3);
        
        return Math.max(0.5, base * positionFactor * emotionFactor);
    }

    getPositionFactor(index, total) {
        const progress = index / total;
        if (progress < 0.2) return 1.3; // 开场稍慢
        if (progress < 0.8) return 0.9; // 中间加快
        return 0.7; // 结尾最快
    }

    buildEmotionalWave(sceneLength) {
        const beats = Math.ceil(sceneLength / 30); // 每30秒一个节拍
        const wave = [];
        
        for (let i = 0; i < beats; i++) {
            wave.push({
                beat: i,
                emotion_intensity: 0.3 + (Math.sin(i * 0.5) * 0.3) + Math.random() * 0.2,
                recommended_shot_type: i % 3 === 0 ? 'hook' : 'normal'
            });
        }
        
        return wave;
    }
}

module.exports = new PaceController();
