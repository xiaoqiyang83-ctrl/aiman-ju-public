/**
 * 事件总线
 * 系统核心事件发布订阅系统
 */
class EventBus {
    constructor() {
        this.events = {};
        this.eventLog = [];
        this.maxLogSize = 10000;
    }

    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    off(eventName, callback) {
        if (!this.events[eventName]) return;
        this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }

    emit(eventName, data) {
        const event = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: eventName,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.logEvent(event);
        
        if (!this.events[eventName]) return;
        this.events[eventName].forEach(callback => callback(data));
    }

    logEvent(event) {
        this.eventLog.push(event);
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
    }

    getEventHistory(eventName, limit = 100) {
        const events = eventName 
            ? this.eventLog.filter(e => e.name === eventName)
            : this.eventLog;
        return events.slice(-limit);
    }
}

module.exports = new EventBus();
