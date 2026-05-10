/**
 * 文心一言API测试脚本
 * 用于验证文心一言集成是否正确
 */

require('dotenv').config();
const aiService = require('./services/ai-service');

async function test() {
    console.log('='.repeat(60));
    console.log('文心一言（ERNIE）API 集成测试');
    console.log('='.repeat(60));
    console.log();
    
    // 1. 检查当前配置
    console.log('【1】检查当前配置');
    const status = aiService.getServiceStatus();
    console.log('   当前 Provider:', status.provider);
    console.log('   当前 Model:', status.model);
    console.log('   是否配置:', status.configured ? '✅' : '❌');
    console.log();
    
    // 2. 检查文心一言配置
    console.log('【2】检查文心一言配置');
    const ernieConfig = aiService.AI_CONFIG['ernie'];
    const hasErnieKey = !!ernieConfig.apiKey && !!ernieConfig.secretKey;
    console.log('   ERNIE_API_KEY:', ernieConfig.apiKey ? '已配置 ✅' : '未配置 ❌');
    console.log('   ERNIE_SECRET_KEY:', ernieConfig.secretKey ? '已配置 ✅' : '未配置 ❌');
    console.log('   文心一言可用:', hasErnieKey ? '✅' : '❌ (需要配置密钥)');
    console.log();
    
    // 3. 测试硅基流动（当前已配置）
    if (status.provider !== 'ernie' && status.configured) {
        console.log('【3】测试当前配置的AI服务');
        console.log('   正在生成测试剧本...');
        
        try {
            const result = await aiService.generateScript({
                genre: '都市',
                theme: '职场逆袭',
                protagonist: '普通职员小李',
                setting: '现代都市',
                duration: 2
            });
            
            console.log('   ✅ 剧本生成成功!');
            console.log('   字数:', result.word_count);
            console.log('   Tokens:', result.tokens);
            console.log('   内容预览:', result.content.substring(0, 150) + '...');
        } catch (error) {
            console.log('   ❌ 测试失败:', error.message);
        }
        console.log();
    }
    
    // 4. 文心一言使用说明
    console.log('【4】文心一言使用说明');
    console.log();
    console.log('   要启用文心一言，请在 .env 文件中配置:');
    console.log();
    console.log('   AI_PROVIDER=ernie');
    console.log('   ERNIE_API_KEY=你的API_KEY');
    console.log('   ERNIE_SECRET_KEY=你的SECRET_KEY');
    console.log('   ERNIE_MODEL=ernie-3.5-8k');
    console.log();
    console.log('   获取地址: https://cloud.baidu.com/product/wenxinworkshop');
    console.log();
    
    // 5. 支持的模型列表
    console.log('【5】支持的文心一言模型');
    console.log();
    console.log('   ✅ ernie-3.5-8k      - 标准版，性价比高');
    console.log('   ✅ ernie-3.5-128k    - 长文本版');
    console.log('   ✅ ernie-4.0-8k-latest - 高级版，效果更好');
    console.log('   ✅ ernie-4.0-turbo-8k - 高速版，响应更快');
    console.log();
    
    console.log('='.repeat(60));
    console.log('测试完成!');
    console.log('='.repeat(60));
}

test().catch(console.error);
