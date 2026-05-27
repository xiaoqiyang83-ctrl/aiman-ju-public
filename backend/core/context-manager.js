/**
 * 上下文管理器
 * 管理整个渲染流程中的共享状态
 */
class ContextManager {
    constructor() {
        this.contexts = new Map();
    }

    createContext(id, initialData = {}) {
        const context = {
            id,
            data: { ...initialData },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.contexts.set(id, context);
        return context;
    }

    getContext(id) {
        return this.contexts.get(id);
    }

    updateContext(id, updates) {
        const context = this.contexts.get(id);
        if (!context) return null;
        
        context.data = { ...context.data, ...updates };
        context.updatedAt = new Date().toISOString();
        return context;
    }

    deleteContext(id) {
        return this.contexts.delete(id);
    }
}

module.exports = new ContextManager();
