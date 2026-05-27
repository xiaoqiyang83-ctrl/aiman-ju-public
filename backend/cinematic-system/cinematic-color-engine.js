/**
 * 电影色彩引擎
 * 管理色彩分级、LUT、情绪调色
 */
class CinematicColorEngine {
    constructor() {
        this.colorGrades = {
            warm: { temperature: 100, tint: 10, saturation: 0.8 },
            cool: { temperature: -100, tint: -15, saturation: 0.9 },
            teal_orange: { temperature: 0, tint: 0, contrast: 1.3, saturation: 1.1 },
            noir: { temperature: -50, tint: -20, contrast: 1.5, saturation: 0.3 },
            cyberpunk: { temperature: -30, tint: 30, contrast: 1.4, saturation: 1.4 },
            vintage: { temperature: 50, tint: -10, contrast: 0.9, saturation: 0.7 },
            horror: { temperature: -80, tint: 40, contrast: 1.6, saturation: 0.6 }
        };
        
        this.emotionToColor = {
            calm: 'warm',
            fear: 'cool',
            anger: 'horror',
            despair: 'noir',
            awakening: 'teal_orange',
            hope: 'warm',
            tension: 'cyberpunk'
        };
    }

    getColorGrade(emotion) {
        const gradeName = this.emotionToColor[emotion] || 'teal_orange';
        return {
            name: gradeName,
            ...this.colorGrades[gradeName]
        };
    }

    applyLut(baseGrade, lutName) {
        // LUT叠加逻辑
        return {
            ...baseGrade,
            lut: lutName,
            blendMode: 'overlay'
        };
    }
}

module.exports = new CinematicColorEngine();
