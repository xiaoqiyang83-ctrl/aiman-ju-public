/**
 * 世界状态管理器
 * 管理整个世界的全局状态
 */
class WorldStateManager {
    constructor() {
        this.state = {
            time: {
                day: 1,
                hour: 0,
                minute: 0
            },
            weather: 'clear',
            locations: {},
            npcs: {},
            globalFlags: {},
            activeEvents: []
        };
    }

    getState() {
        return { ...this.state };
    }

    updateTime(days = 0, hours = 0, minutes = 0) {
        this.state.time.minute += minutes;
        while (this.state.time.minute >= 60) {
            this.state.time.minute -= 60;
            this.state.time.hour += 1;
        }
        
        this.state.time.hour += hours;
        while (this.state.time.hour >= 24) {
            this.state.time.hour -= 24;
            this.state.time.day += 1;
        }
        
        this.state.time.day += days;
    }

    setFlag(flag, value) {
        this.state.globalFlags[flag] = value;
    }

    getFlag(flag) {
        return this.state.globalFlags[flag];
    }

    addActiveEvent(event) {
        this.state.activeEvents.push({
            ...event,
            startedAt: this.state.time.day
        });
    }
}

module.exports = new WorldStateManager();
