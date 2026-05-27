/**
 * 任务编排器
 * 协调多个异步任务的执行顺序和依赖关系
 */
const eventBus = require('./event-bus');

class TaskOrchestrator {
    constructor() {
        this.queues = {};
        this.workers = 4;
    }

    addTask(queueName, task, priority = 'normal') {
        if (!this.queues[queueName]) {
            this.queues[queueName] = [];
        }
        
        const taskItem = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            task,
            priority,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        this.queues[queueName].push(taskItem);
        this.sortQueue(queueName);
        
        eventBus.emit('task.added', { queueName, taskId: taskItem.id });
        
        return taskItem.id;
    }

    sortQueue(queueName) {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        this.queues[queueName].sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );
    }

    async processQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue || queue.length === 0) return;
        
        while (queue.length > 0) {
            const taskItem = queue.shift();
            taskItem.status = 'processing';
            
            try {
                eventBus.emit('task.start', { taskId: taskItem.id });
                await taskItem.task.handler(taskItem.task.data);
                taskItem.status = 'completed';
                eventBus.emit('task.complete', { taskId: taskItem.id });
            } catch (error) {
                taskItem.status = 'failed';
                taskItem.error = error.message;
                eventBus.emit('task.failed', { taskId: taskItem.id, error: error.message });
            }
        }
    }
}

module.exports = new TaskOrchestrator();
