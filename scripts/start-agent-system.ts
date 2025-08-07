// 启动完整的子代理系统
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { AgentConfigManager } from '../shared/config/agent-config-manager';
import { LoggerUtils } from '../shared/utils';

interface AgentProcess {
  name: string;
  process: ChildProcess;
  port: number;
  startTime: Date;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

export class AgentSystemManager {
  private configManager: AgentConfigManager;
  private agents: Map<string, AgentProcess> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private configPath: string;

  constructor(configPath: string = './config/agent-system.json') {
    this.configPath = configPath;
    this.configManager = new AgentConfigManager(configPath);
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting AI News Collector Agent System...\n');

      // 1. 加载配置
      console.log('1️⃣ Loading configuration...');
      await this.configManager.loadConfig();
      const config = this.configManager.getConfig();
      console.log('✅ Configuration loaded successfully');

      // 2. 验证配置
      console.log('\n2️⃣ Validating configuration...');
      const validation = this.configManager.validateConfig();
      if (!validation.valid) {
        console.log('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.log(`   - ${error}`));
        throw new Error('Invalid configuration');
      }
      console.log('✅ Configuration is valid');

      // 3. 创建必要的目录
      console.log('\n3️⃣ Creating required directories...');
      this.createRequiredDirectories();
      console.log('✅ Directories created');

      // 4. 启动代理
      console.log('\n4️⃣ Starting agents...');
      await this.startAgents();
      console.log('✅ All agents started');

      // 5. 启动健康检查
      console.log('\n5️⃣ Starting health monitoring...');
      this.startHealthMonitoring();
      console.log('✅ Health monitoring started');

      // 6. 配置采集器
      console.log('\n6️⃣ Configuring collectors...');
      await this.configureCollectors();
      console.log('✅ Collectors configured');

      console.log('\n🎉 Agent System started successfully!');
      console.log('\n📊 System Status:');
      this.printSystemStatus();

      // 7. 设置优雅关闭
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('\n❌ Failed to start agent system:', error);
      await this.stop();
      process.exit(1);
    }
  }

  private createRequiredDirectories(): void {
    const directories = [
      './config',
      './logs',
      './data',
      './data/collected',
      './data/processed',
      './data/analyzed'
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async startAgents(): Promise<void> {
    const config = this.configManager.getConfig();
    const agents = [
      { name: 'coordinator', config: config.coordinator },
      { name: 'collector', config: config.collector },
      { name: 'processor', config: config.processor },
      { name: 'analyzer', config: config.analyzer }
    ];

    for (const agent of agents) {
      try {
        console.log(`   Starting ${agent.name} agent...`);
        await this.startAgent(agent.name, agent.config);
        
        // 等待代理启动
        await this.waitForAgent(agent.name, agent.config.port);
        
        console.log(`   ✅ ${agent.name} agent started on port ${agent.config.port}`);
      } catch (error) {
        console.error(`   ❌ Failed to start ${agent.name} agent:`, error);
        throw error;
      }
    }
  }

  private async startAgent(name: string, config: any): Promise<void> {
    const agentPath = path.join(process.cwd(), 'agents', `${name}-agent`, 'main.ts');
    
    if (!fs.existsSync(agentPath)) {
      throw new Error(`Agent file not found: ${agentPath}`);
    }

    const process = spawn('npx', ['tsx', agentPath], {
      stdio: 'pipe',
      env: { ...process.env, AGENT_CONFIG: this.configPath },
      cwd: process.cwd()
    });

    // 设置输出处理
    process.stdout?.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`);
    });

    process.stderr?.on('data', (data) => {
      console.error(`[${name} ERROR] ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
      console.log(`[${name}] Process exited with code ${code}`);
      const agent = this.agents.get(name);
      if (agent) {
        agent.status = 'stopped';
      }
    });

    process.on('error', (error) => {
      console.error(`[${name}] Process error:`, error);
      const agent = this.agents.get(name);
      if (agent) {
        agent.status = 'error';
      }
    });

    this.agents.set(name, {
      name,
      process,
      port: config.port,
      startTime: new Date(),
      status: 'starting'
    });
  }

  private async waitForAgent(name: string, port: number, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          const agent = this.agents.get(name);
          if (agent) {
            agent.status = 'running';
          }
          return;
        }
      } catch (error) {
        // 等待代理启动
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Agent ${name} did not start within ${timeout}ms`);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [name, agent] of this.agents) {
        try {
          const response = await fetch(`http://localhost:${agent.port}/health`);
          if (!response.ok) {
            console.warn(`⚠️  Agent ${name} health check failed`);
            agent.status = 'error';
          }
        } catch (error) {
          console.warn(`⚠️  Agent ${name} health check error:`, error);
          agent.status = 'error';
        }
      }
    }, 30000); // 每30秒检查一次
  }

  private async configureCollectors(): Promise<void> {
    const collectors = this.configManager.getCollectorConfigs();
    
    for (const collector of collectors) {
      if (collector.enabled) {
        try {
          console.log(`   Configuring collector: ${collector.name}`);
          
          // 向收集器代理发送配置
          const response = await fetch('http://localhost:3001/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'system',
              to: 'collector',
              type: 'request',
              action: 'configure_collector',
              data: { collector_config: collector },
              timestamp: Date.now(),
              message_id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            })
          });

          if (response.ok) {
            console.log(`   ✅ Collector ${collector.name} configured`);
          } else {
            console.error(`   ❌ Failed to configure collector ${collector.name}`);
          }
        } catch (error) {
          console.error(`   ❌ Error configuring collector ${collector.name}:`, error);
        }
      }
    }
  }

  private printSystemStatus(): void {
    console.log('   📈 Running Agents:');
    for (const [name, agent] of this.agents) {
      const uptime = Date.now() - agent.startTime.getTime();
      const uptimeSeconds = Math.floor(uptime / 1000);
      console.log(`      - ${name}: port ${agent.port}, status ${agent.status}, uptime ${uptimeSeconds}s`);
    }

    const collectors = this.configManager.getCollectorConfigs();
    const enabledCollectors = collectors.filter(c => c.enabled);
    console.log(`   📊 Configured Collectors: ${enabledCollectors.length} enabled, ${collectors.length - enabledCollectors.length} disabled`);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGBREAK', () => shutdown('SIGBREAK'));
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Agent System...');

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 停止所有代理
    for (const [name, agent] of this.agents) {
      try {
        console.log(`   Stopping ${name} agent...`);
        
        // 发送关闭信号
        try {
          await fetch(`http://localhost:${agent.port}/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'system',
              to: name,
              type: 'request',
              action: 'shutdown',
              data: {},
              timestamp: Date.now(),
              message_id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            })
          });
        } catch (error) {
          // 忽略关闭时的错误
        }

        // 等待进程结束
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (agent.process && !agent.process.killed) {
          agent.process.kill();
        }
        
        console.log(`   ✅ ${name} agent stopped`);
      } catch (error) {
        console.error(`   ❌ Error stopping ${name} agent:`, error);
      }
    }

    this.agents.clear();
    console.log('✅ Agent System stopped');
  }

  getSystemStatus(): any {
    return {
      agents: Array.from(this.agents.entries()).map(([name, agent]) => ({
        name,
        port: agent.port,
        status: agent.status,
        uptime: Date.now() - agent.startTime.getTime()
      })),
      collectors: this.configManager.getCollectorConfigs()
    };
  }
}

// 如果直接运行此文件，则启动系统
if (require.main === module) {
  const system = new AgentSystemManager();
  system.start().catch(console.error);
}

export { AgentSystemManager };