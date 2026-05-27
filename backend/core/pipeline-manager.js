/**
 * Pipeline管理器
 * 管理渲染管线的注册和执行
 */
const eventBus = require('./event-bus');

class PipelineManager {
    constructor() {
        this.pipelines = {};
    }

    registerPipeline(name, stages) {
        this.pipelines[name] = {
            stages,
            createdAt: new Date().toISOString()
        };
    }

    async run(pipelineName, input) {
        const pipeline = this.pipelines[pipelineName];
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineName} not found`);
        }

        eventBus.emit('pipeline.start', { pipelineName, input });
        
        let current = input;
        for (const stage of pipeline.stages) {
            eventBus.emit('pipeline.stage.start', { stage: stage.name, input: current });
            current = await stage.handler(current);
            eventBus.emit('pipeline.stage.complete', { stage: stage.name, output: current });
        }
        
        eventBus.emit('pipeline.complete', { pipelineName, output: current });
        
        return current;
    }
}

module.exports = new PipelineManager();
