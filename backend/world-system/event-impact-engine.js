/**
 * 事件影响引擎
 * 计算剧情事件对世界状态的连锁影响
 */
class EventImpactEngine {
    constructor() {
        this.impactRules = [];
    }

    registerImpactRule(rule) {
        this.impactRules.push(rule);
    }

    calculateImpact(event, worldState) {
        const impacts = [];
        
        for (const rule of this.impactRules) {
            if (rule.condition(event, worldState)) {
                const impact = rule.effect(event, worldState);
                impacts.push(impact);
            }
        }
        
        return impacts;
    }

    applyImpact(impact, worldState) {
        // 应用影响到世界状态
        if (impact.type === 'faction_power') {
            worldState.factions[impact.target].power += impact.value;
        } else if (impact.type === 'relation_change') {
            worldState.setRelation(impact.factionA, impact.factionB, impact.newRelation);
        } else if (impact.type === 'flag_change') {
            worldState.setFlag(impact.flag, impact.value);
        }
    }

    processEvent(event, worldState) {
        const impacts = this.calculateImpact(event, worldState);
        impacts.forEach(impact => this.applyImpact(impact, worldState));
        return impacts;
    }
}

module.exports = new EventImpactEngine();
