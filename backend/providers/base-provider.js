/**
 * 基础Provider基类
 * 所有模型Provider统一继承此类
 */
class BaseProvider {
    constructor(config) {
        this.config = config;
    }

    /**
     * 生成通用图片
     */
    async generateImage(prompt, options) {
        throw new Error('generateImage must be implemented by subclass');
    }

    /**
     * 生成角色图片
     */
    async generateCharacter(character, options) {
        throw new Error('generateCharacter must be implemented by subclass');
    }

    /**
     * 生成分镜帧
     */
    async generateStoryboardFrame(frame, options) {
        throw new Error 'generateStoryboardFrame must be implemented by subclass');
    }

    /**
     * 图片超分
     */
    async upscale(image, options) {
        throw new Error('upscale must be implemented by subclass');
    }

    /**
     * 生成参考图
     */
    async generateReference(referenceType, options) {
        throw new Error('generateReference must be implemented by subclass');
    }
}

module.exports = BaseProvider;
