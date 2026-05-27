/**
 * 力量体系
 * 定义和管理世界中的力量等级、修炼体系
 */
class PowerSystem {
    constructor() {
        this.systems = {};
    }

    registerSystem(name, tiers) {
        this.systems[name] = {
            tiers,
            createdAt: new Date().toISOString()
        };
    }

    getTier(systemName, level) {
        const system = this.systems[systemName];
        if (!system) return null;
        
        for (const tier of system.tiers) {
            if (level >= tier.minLevel && level <= tier.maxLevel) {
                return tier;
            }
        }
        
        return system.tiers[system.tiers.length - 1];
    }

    calculatePower(systemName, level, attributes = {}) {
        const tier = this.getTier(systemName, level);
        if (!tier) return level;
        
        let power = level * tier.baseMultiplier;
        
        for (const [attr, value] of Object.entries(attributes)) {
            if (tier.attributeBonus?.[attr]) {
                power += value * tier.attributeBonus[attr];
            }
        }
        
        return Math.floor(power);
    }
}

module.exports = new PowerSystem();
