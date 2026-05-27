/**
 * 强化学习系统
 * 通过用户反馈优化导演决策
 */
class RLDirectorAgent {
    constructor() {
        this.qTable = {}; // state -> action -> value
        this.epsilon = 0.1; // 探索率
        this.learningRate = 0.01;
        this.discountFactor = 0.9;
        
        this.stateHistory = [];
        this.actionHistory = [];
    }

    getStateKey(sceneContext) {
        return [
            sceneContext.emotion || 'neutral',
            sceneContext.sceneType || 'dialogue',
            sceneContext.shotCount || 0
        ].join('|');
    }

    selectAction(state, availableActions) {
        const stateKey = this.getStateKey(state);
        
        // ε-greedy策略
        if (Math.random() < this.epsilon) {
            // 探索：随机选择
            return availableActions[Math.floor(Math.random() * availableActions.length)];
        }
        
        // 利用：选择Q值最高的动作
        const qValues = this.qTable[stateKey] || {};
        let bestAction = availableActions[0];
        let bestValue = -Infinity;
        
        for (const action of availableActions) {
            const value = qValues[action] || 0;
            if (value > bestValue) {
                bestValue = value;
                bestAction = action;
            }
        }
        
        this.stateHistory.push(stateKey);
        this.actionHistory.push(bestAction);
        
        return bestAction;
    }

    receiveReward(reward) {
        // 反向传播奖励
        for (let i = this.stateHistory.length - 1; i >= 0; i--) {
            const state = this.stateHistory[i];
            const action = this.actionHistory[i];
            
            if (!this.qTable[state]) {
                this.qTable[state] = {};
            }
            
            const oldValue = this.qTable[state][action] || 0;
            const nextMax = i < this.stateHistory.length - 1
                ? Math.max(...Object.values(this.qTable[this.stateHistory[i + 1]] || {0: 0}))
                : 0;
            
            // Q学习更新
            this.qTable[state][action] = oldValue + 
                this.learningRate * (reward + this.discountFactor * nextMax - oldValue);
            
            reward *= this.discountFactor;
        }
        
        this.stateHistory = [];
        this.actionHistory = [];
    }

    getPolicy() {
        return { ...this.qTable };
    }
}

module.exports = new RLDirectorAgent();
