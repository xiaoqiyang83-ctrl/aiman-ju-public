/**
 * 灯光引擎
 * 管理场景布光方案
 */
class LightingEngine {
    constructor() {
        this.lightingSchemes = {
            dramatic: {
                key: 'hard',
                fill: 'low',
                contrast: 'high',
                shadows: 'sharp'
            },
            noir: {
                key: 'side',
                fill: 'none',
                contrast: 'extreme',
                shadows: 'long'
            },
            horror: {
                key: 'bottom',
                fill: 'none',
                contrast: 'high',
                color: 'green_blue'
            },
            romantic: {
                key: 'soft',
                fill: 'warm',
                contrast: 'low',
                shadows: 'soft'
            },
            epic: {
                key: 'backlight',
                fill: 'rim',
                contrast: 'high',
                god_rays: true
            }
        };
    }

    getLightingScheme(emotion, timeOfDay) {
        let scheme;
        
        if (emotion === 'horror' || emotion === 'fear') {
            scheme = this.lightingSchemes.horror;
        } else if (emotion === 'oppression' || emotion === 'despair') {
            scheme = this.lightingSchemes.noir;
        } else if (emotion === 'epic' || emotion === 'awakening') {
            scheme = this.lightingSchemes.epic;
        } else if (emotion === 'tender' || emotion === 'romance') {
            scheme = this.lightingSchemes.romantic;
        } else {
            scheme = this.lightingSchemes.dramatic;
        }
        
        return {
            ...scheme,
            timeOfDay,
            colorTemperature: this.getColorTemp(timeOfDay)
        };
    }

    getColorTemp(timeOfDay) {
        const tempMap = {
            dawn: 3200,
            morning: 5600,
            noon: 6500,
            afternoon: 5500,
            sunset: 2800,
            night: 2000
        };
        return tempMap[timeOfDay] || 5600;
    }
}

module.exports = new LightingEngine();
