import { AnalyzerAgent, AnalyzerConfig } from './index';
import * as fs from 'fs';
import * as path from 'path';

// 加载配置文件
function loadConfig(): AnalyzerConfig {
  const configPath = process.env.AGENT_CONFIG || './agents/analyzer-agent/config.json';
  const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
  const baseConfig = JSON.parse(configData);
  
  // 添加代理特定的默认配置
  return {
    ...baseConfig,
    max_concurrent_tasks: baseConfig.max_concurrent_tasks || 15,
    analysis_timeout: baseConfig.analysis_timeout || 45000,
    sentiment_analysis: baseConfig.sentiment_analysis || {
      model_type: 'transformers',
      confidence_threshold: 0.8,
      batch_size: 10
    },
    risk_detection: baseConfig.risk_detection || {
      enable_financial_risks: true,
      enable_reputation_risks: true,
      enable_market_risks: true,
      severity_threshold: 0.7
    },
    trend_analysis: baseConfig.trend_analysis || {
      time_window: 24,
      min_events_for_trend: 5,
      confidence_threshold: 0.6
    }
  };
}

// 启动分析代理
async function startAnalyzerAgent() {
  try {
    const config = loadConfig();
    const agent = new AnalyzerAgent(config);
    
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
    console.error('Failed to start Analyzer Agent:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动代理
if (require.main === module) {
  startAnalyzerAgent();
}

export { AnalyzerAgent };