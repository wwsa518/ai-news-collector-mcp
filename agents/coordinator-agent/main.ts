// 协调代理入口文件
import { CoordinatorAgent } from './index';
import { AgentConfig } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

// 加载配置文件
function loadConfig(): AgentConfig {
  const configPath = process.env.AGENT_CONFIG || './agents/coordinator-agent/config.json';
  const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
  return JSON.parse(configData);
}

// 启动协调代理
async function startCoordinatorAgent() {
  try {
    const config = loadConfig();
    const agent = new CoordinatorAgent(config);
    
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
    console.error('Failed to start Coordinator Agent:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动代理
if (require.main === module) {
  startCoordinatorAgent();
}

export { CoordinatorAgent };