/**
 * 模型路由分发器
 * 根据任务类型自动选择最优Provider
 */
const BaseProvider = require('./base-provider');

class ModelRouter {
    constructor() {
        this.providers = {};
        this.defaultProvider = 'cogview';
    }

    registerProvider(name, provider) {
        if (!(provider instanceof BaseProvider)) {
            throw new Error('Provider must inherit from BaseProvider');
        }
        this.providers[name] = provider;
    }

    /**
     * 根据任务类型路由
     */
    routeForTask(taskType, options) {
        // 根据任务类型选择最合适的模型
        switch (taskType) {
            case 'character':
                return this.providers['flux'] || this.providers[this.defaultProvider];
            case 'storyboard':
                return this.providers['sdxl'] || this.providers[this.defaultProvider];
            case 'upscale':
                return this.providers['comfy'] || this.providers[this.defaultProvider];
            default:
                return this.providers[this.defaultProvider];
        }
    }

    getProvider(name) {
        return this.providers[name];
    }
}

module.exports = new ModelRouter();
