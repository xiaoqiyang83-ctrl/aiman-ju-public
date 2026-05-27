/**
 * 世界时间线引擎
 * 管理和回溯世界历史时间线
 */
class TimelineWorldEngine {
    constructor() {
        this.timeline = [];
        this.checkpoints = [];
        this.currentDay = 1;
    }

    recordEvent(day, event) {
        this.timeline.push({
            day,
            event,
            timestamp: new Date().toISOString()
        });
    }

    createCheckpoint(day, label) {
        const checkpoint = {
            day,
            label,
            snapshot: null, // 保存完整世界状态快照
            createdAt: new Date().toISOString()
        };
        this.checkpoints.push(checkpoint);
        return checkpoint;
    }

    getHistory(startDay, endDay) {
        return this.timeline.filter(
            item => item.day >= startDay && item.day <= endDay
        );
    }

    rollbackToCheckpoint(checkpointId) {
        const checkpoint = this.checkpoints.find(c => c.day === checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }
        
        // 回滚到指定时间点
        this.currentDay = checkpoint.day;
        this.timeline = this.timeline.filter(item => item.day <= checkpoint.day);
        
        return checkpoint.snapshot;
    }

    generateWorldSummary() {
        return {
            currentDay: this.currentDay,
            totalEvents: this.timeline.length,
            checkpoints: this.checkpoints.length,
            recentEvents: this.timeline.slice(-10)
        };
    }
}

module.exports = new TimelineWorldEngine();
