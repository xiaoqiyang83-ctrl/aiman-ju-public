/**
 * 多智能体协调系统
 * 多个Agent协作生成最优结果
 */
class AgentCoordinator {
    constructor() {
        this.agents = {
            director_agent: null,
            cinematographer_agent: null,
            character_agent: null,
            world_agent: null,
            critic_agent: null
        };
        
        this.discussionHistory = [];
    }

    registerAgent(role, agent) {
        this.agents[role] = agent;
    }

    async collaborativeGeneration(task) {
        let currentDraft = null;
        const maxIterations = 3;
        
        for (let i = 0; i < maxIterations; i++) {
            // 各Agent轮流提出改进意见
            const directorSuggestion = await this.agents.director_agent?.propose(task, currentDraft);
            const cinematographerSuggestion = await this.agents.cinematographer_agent?.propose(task, currentDraft);
            
            // 评论家Agent评分
            const criticScore = await this.agents.critic_agent?.evaluate(currentDraft);
            
            this.discussionHistory.push({
                iteration: i,
                suggestions: { directorSuggestion, cinematographerSuggestion },
                score: criticScore
            });
            
            // 如果评分足够高，提前结束
            if (criticScore && criticScore.overall > 0.85) {
                break;
            }
            
            // 合并建议生成新版本
            currentDraft = this.mergeSuggestions(currentDraft, {
                directorSuggestion,
                cinematographerSuggestion
            });
        }
        
        return currentDraft;
    }

    mergeSuggestions(base, suggestions) {
        return {
            ...base,
            ...(suggestions.directorSuggestion || {}),
            ...(suggestions.cinematographerSuggestion || {})
        };
    }

    getDiscussionSummary() {
        return {
            total_iterations: this.discussionHistory.length,
            score_progression: this.discussionHistory.map(h => h.score?.overall || 0),
            improvements: []
        };
    }
}

module.exports = new AgentCoordinator();
