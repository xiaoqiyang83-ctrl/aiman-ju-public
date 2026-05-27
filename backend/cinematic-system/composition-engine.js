/**
 * 构图引擎
 * 管理画面构图规则
 */
class CompositionEngine {
    constructor() {
        this.compositionRules = {
            rule_of_thirds: { grid: 3, focus: 'intersections' },
            golden_ratio: { grid: 1.618, focus: 'phi_point' },
            symmetry: { axis: 'center', balance: true },
            leading_lines: { direction: 'diagonal', convergence: 'vanishing' },
            framing: { type: 'natural_frame', depth: true },
            negative_space: { ratio: 0.6, subject: 'small' }
        };
    }

    selectComposition(shotType, emotion) {
        const compositionMap = {
            closeup: 'rule_of_thirds',
            wide_shot: 'leading_lines',
            establishing: 'golden_ratio',
            portrait: 'negative_space',
            action: 'framing'
        };
        
        const ruleName = compositionMap[shotType] || 'rule_of_thirds';
        
        return {
            rule: ruleName,
            ...this.compositionRules[ruleName],
            subjectPlacement: this.getSubjectPlacement(emotion)
        };
    }

    getSubjectPlacement(emotion) {
        const placementMap = {
            oppression: 'bottom',
            power: 'top',
            freedom: 'center',
            isolation: 'corner',
            tension: 'edge'
        };
        return placementMap[emotion] || 'center';
    }
}

module.exports = new CompositionEngine();
