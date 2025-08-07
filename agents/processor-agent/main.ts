import { ProcessorAgent, ProcessorConfig } from './index';
import * as fs from 'fs';
import * as path from 'path';

// 加载配置文件
function loadConfig(): ProcessorConfig {
  const configPath = process.env.AGENT_CONFIG || './agents/processor-agent/config.json';
  const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
  const baseConfig = JSON.parse(configData);
  
  // 添加代理特定的默认配置
  return {
    ...baseConfig,
    max_concurrent_tasks: baseConfig.max_concurrent_tasks || 20,
    processing_timeout: baseConfig.processing_timeout || 30000,
    entity_recognition: baseConfig.entity_recognition || {
      enable_stock_codes: true,
      enable_companies: true,
      enable_persons: true,
      enable_locations: true,
      confidence_threshold: 0.7
    },
    event_extraction: baseConfig.event_extraction || {
      enable_triple_extraction: true,
      confidence_threshold: 0.6
    },
    content_cleaning: baseConfig.content_cleaning || {
      remove_html: true,
      remove_ads: true,
      normalize_whitespace: true,
      min_content_length: 100
    }
  };
}

// 启动数据处理代理
async function startProcessorAgent() {
  try {
    const config = loadConfig();
    const agent = new ProcessorAgent(config);
    
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
    console.error('Failed to start Processor Agent:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动代理
if (require.main === module) {
  startProcessorAgent();
}

export { ProcessorAgent };