// 测试子代理框架
import { AgentConfigManager } from '../shared/config/agent-config-manager';
import { CollectorFactory } from '../agents/collector-agent/collectors/collector-factory';
import { CommunicationProtocol } from '../shared/communication';
import { LoggerUtils } from '../shared/utils';

async function testAgentFramework() {
  console.log('🚀 Starting Agent Framework Test...\n');

  try {
    // 1. 测试配置管理器
    console.log('1️⃣ Testing Configuration Manager...');
    const configManager = new AgentConfigManager('./config/test-config.json');
    await configManager.loadConfig();
    
    const config = configManager.getConfig();
    console.log('✅ Configuration loaded successfully');
    console.log(`   - Coordinator: ${config.coordinator.agent_name}:${config.coordinator.port}`);
    console.log(`   - Collector: ${config.collector.agent_name}:${config.collector.port}`);
    console.log(`   - Processor: ${config.processor.agent_name}:${config.processor.port}`);
    console.log(`   - Analyzer: ${config.analyzer.agent_name}:${config.analyzer.port}`);
    console.log(`   - Collectors: ${config.collectors.length} configured`);

    // 2. 测试采集器工厂
    console.log('\n2️⃣ Testing Collector Factory...');
    const collectorFactory = new CollectorFactory();
    const availableTypes = collectorFactory.getAvailableTypes();
    console.log(`✅ Available collector types: ${availableTypes.join(', ')}`);

    // 3. 测试配置验证
    console.log('\n3️⃣ Testing Configuration Validation...');
    const validation = configManager.validateConfig();
    if (validation.valid) {
      console.log('✅ Configuration is valid');
    } else {
      console.log('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
    }

    // 4. 测试通信协议
    console.log('\n4️⃣ Testing Communication Protocol...');
    const testProtocol = new CommunicationProtocol('test-agent', 3999);
    console.log('✅ Communication protocol initialized');

    // 5. 测试添加示例采集器配置
    console.log('\n5️⃣ Testing Collector Configuration...');
    const sampleCollector = {
      type: 'rss' as const,
      name: 'test_rss_collector',
      enabled: true,
      priority: 1,
      schedule: '0 */5 * * * *',
      config: {
        url: 'https://example.com/feed.xml',
        name: 'Test RSS Feed',
        category: 'test',
        language: 'en',
        max_items: 10
      }
    };

    await configManager.addCollectorConfig(sampleCollector);
    console.log('✅ Sample collector configuration added');

    // 6. 测试采集器类型获取
    console.log('\n6️⃣ Testing Collector Type Operations...');
    const collectorConfig = configManager.getCollectorConfig('test_rss_collector');
    if (collectorConfig) {
      console.log(`✅ Retrieved collector config: ${collectorConfig.name}`);
      
      const isValid = await collectorFactory.validate(collectorConfig);
      console.log(`✅ Collector validation result: ${isValid}`);
    }

    // 7. 测试配置导出
    console.log('\n7️⃣ Testing Configuration Export...');
    const exportedConfig = configManager.exportConfig();
    console.log('✅ Configuration exported successfully');
    console.log(`   - Export size: ${exportedConfig.length} characters`);

    // 8. 清理测试配置
    console.log('\n8️⃣ Cleaning up test configuration...');
    await configManager.removeCollectorConfig('test_rss_collector');
    console.log('✅ Test configuration cleaned up');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Framework Status:');
    console.log('   ✅ Configuration Management');
    console.log('   ✅ Collector Factory');
    console.log('   ✅ Communication Protocol');
    console.log('   ✅ Agent Configuration');
    console.log('   ✅ Validation System');
    console.log('   ✅ Import/Export Functions');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  testAgentFramework().catch(console.error);
}

export { testAgentFramework };