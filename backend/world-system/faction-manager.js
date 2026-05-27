/**
 * 势力管理器
 * 管理世界中的各大势力关系
 */
class FactionManager {
    constructor() {
        this.factions = {};
        this.relations = {};
    }

    createFaction(id, data) {
        this.factions[id] = {
            id,
            ...data,
            power: 0,
            influence: 0,
            territories: [],
            members: [],
            createdAt: new Date().toISOString()
        };
        
        this.relations[id] = {};
        return this.factions[id];
    }

    setRelation(factionA, factionB, relation) {
        // relation: hostile, neutral, friendly, allied
        this.relations[factionA][factionB] = relation;
        this.relations[factionB][factionA] = relation;
    }

    getRelation(factionA, factionB) {
        return this.relations[factionA]?.[factionB] || 'neutral';
    }

    updatePower(factionId, delta) {
        if (this.factions[factionId]) {
            this.factions[factionId].power += delta;
        }
    }
}

module.exports = new FactionManager();
