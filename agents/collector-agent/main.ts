import { CollectorAgent, CollectorConfig } from './index';
import * as fs from 'fs';
import * as path from 'path';

// 加载配置文件
function loadConfig(): CollectorConfig {
  const configPath = process.env.AGENT_CONFIG || './agents/collector-agent/config.json';
  const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
  const baseConfig = JSON.parse(configData);
  
  // 添加代理特定的默认配置
  return {
    ...baseConfig,
    max_concurrent_sources: baseConfig.max_concurrent_sources || 10,
    collection_timeout: baseConfig.collection_timeout || 60000,
    retry_attempts: baseConfig.retry_attempts || 3,
    retry_delay: baseConfig.retry_delay || 5000,
    user_agent: baseConfig.user_agent || 'AI-News-Collector/1.0',
    rate_limit: baseConfig.rate_limit || {
      requests_per_minute: 60,
      requests_per_hour: 1000
    }
  };
}

// 启动数据采集代理
async function startCollectorAgent() {
  try {
    const config = loadConfig();
    const agent = new CollectorAgent(config);
    
    // 优雅关闭处理
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await agent.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await agent.stop();
      process.exit(0);
    });

    // 启动代理
    await agent.start();
    
  } catch (error) {
    console.error('Failed to start Collector Agent:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动代理
if (require.main === module) {
  startCollectorAgent();
}

export { CollectorAgent };