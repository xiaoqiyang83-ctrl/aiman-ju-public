/**
 * 工作流引擎
 * 编排和执行异步任务工作流
 */
const eventBus = require('./event-bus');

class WorkflowEngine {
    constructor() {
        this.workflows = {};
        this.runningInstances = {};
    }

    registerWorkflow(name, definition) {
        this.workflows[name] = {
            definition,
            createdAt: new Date().toISOString()
        };
    }

    async execute(workflowName, input) {
        const workflow = this.workflows[workflowName];
        if (!workflow) {
            throw new Error(`Workflow ${workflowName} not found`);
        }

        const instanceId = Date.now() + Math.random().toString(36).substr(2, 9);
        
        eventBus.emit('workflow.start', {
            instanceId,
            workflowName,
            input
        });

        try {
            const result = await this.executeSteps(workflow.definition.steps, input);
            
            eventBus.emit('workflow.complete', {
                instanceId,
                workflowName,
                result
            });
            
            return result;
        } catch (error) {
            eventBus.emit('workflow.error', {
                instanceId,
                workflowName,
                error: error.message
            });
            throw error;
        }
    }

    async executeSteps(steps, context) {
        let currentContext = { ...context };
        
        for (const step of steps) {
            eventBus.emit('workflow.step.start', {
                step: step.name,
                context: currentContext
            });
            
            currentContext = await step.handler(currentContext);
            
            eventBus.emit('workflow.step.complete', {
                step: step.name,
                output: currentContext
            });
        }
        
        return currentContext;
    }
}

module.exports = new WorkflowEngine();
