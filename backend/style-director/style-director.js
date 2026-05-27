/**
 * 风格导演系统
 * 统一管理美术风格、视觉语言、导演签名
 */
class StyleDirector {
    constructor() {
        this.directorStyles = {
            cinematic: {
                color_grade: 'teal_orange',
                lighting: 'dramatic',
                composition: 'rule_of_thirds',
                aspect_ratio: '2.39:1'
            },
            anime: {
                color_grade: 'vibrant',
                lighting: 'cel_shaded',
                composition: 'dynamic',
                aspect_ratio: '16:9'
            },
            noir: {
                color_grade: 'desaturated',
                lighting: 'chiaroscuro',
                composition: 'geometric',
                aspect_ratio: '4:3'
            },
            documentary: {
                color_grade: 'natural',
                lighting: 'available',
                composition: 'organic',
                aspect_ratio: '16:9'
            }
        };
        
        this.signatureShots = [];
    }

    setStyle(styleName) {
        return this.directorStyles[styleName] || this.directorStyles.cinematic;
    }

    blendStyles(styleA, styleB, ratio = 0.5) {
        const a = this.directorStyles[styleA];
        const b = this.directorStyles[styleB];
        
        return {
            color_grade: ratio > 0.5 ? a.color_grade : b.color_grade,
            lighting: a.lighting,
            composition: b.composition,
            blend_ratio: ratio
        };
    }

    addDirectorSignature(shot, sceneIndex) {
        // 添加导演签名镜头（每N个场景出现一次）
        if (sceneIndex % 5 === 0) {
            return {
                ...shot,
                signature_shot: true,
                signature_type: 'long_take'
            };
        }
        return shot;
    }

    getVisualLanguageRules() {
        return {
            framing_rules: [],
            color_consistency: {},
            camera_language: {},
            transition_preferences: {}
        };
    }
}

module.exports = new StyleDirector();
