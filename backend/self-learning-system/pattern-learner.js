/**
 * 自学习系统
 * 从历史生成数据中学习最优模式
 */
class PatternLearner {
    constructor() {
        this.patternDB = {
            successful_combinations: [],
            failed_combinations: [],
            emotion_mappings: {},
            style_preferences: {}
        };
        
        this.learningRate = 0.1;
    }

    recordResult(generationData, userRating) {
        const record = {
            generationData,
            userRating,
            timestamp: new Date().toISOString()
        };
        
        if (userRating >= 4) {
            this.patternDB.successful_combinations.push(record);
            this.extractSuccessPatterns(generationData);
        } else {
            this.patternDB.failed_combinations.push(record);
        }
    }

    extractSuccessPatterns(data) {
        // 提取成功模式：情绪→镜头映射，风格偏好等
        if (data.emotion && data.camera) {
            const key = `${data.emotion}_${data.camera}`;
            this.patternDB.emotion_mappings[key] = 
                (this.patternDB.emotion_mappings[key] || 0) + 1;
        }
        
        if (data.style) {
            this.patternDB.style_preferences[data.style] =
                (this.patternDB.style_preferences[data.style] || 0) + 1;
        }
    }

    recommendBestPractice(taskType) {
        const successes = this.patternDB.successful_combinations.filter(
            c => c.generationData.taskType === taskType
        );
        
        if (successes.length === 0) return null;
        
        // 返回最成功的配置
        return successes
            .sort((a, b) => b.userRating - a.userRating)[0]
            .generationData;
    }

    getStats() {
        return {
            total_learned: this.patternDB.successful_combinations.length + 
                           this.patternDB.failed_combinations.length,
            success_rate: this.patternDB.successful_combinations.length / 
                         Math.max(1, this.patternDB.successful_combinations.length + 
                                   this.patternDB.failed_combinations.length),
            top_emotion_mappings: Object.entries(this.patternDB.emotion_mappings)
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
        };
    }
}

module.exports = new PatternLearner();
