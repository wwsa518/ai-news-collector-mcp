// 代理配置管理器
import * as fs from 'fs';
import * as path from 'path';
import { AgentConfig, CollectorConfig } from '../types';
import { LoggerUtils } from '../utils';

export interface AgentSystemConfig {
  coordinator: AgentConfig;
  collector: CollectorConfig;
  processor: AgentConfig;
  analyzer: AgentConfig;
  collectors: CollectorConfig[];
  system: {
    log_level: string;
    health_check_interval: number;
    heartbeat_timeout: number;
    max_concurrent_tasks: number;
    task_timeout: number;
  };
}

export class AgentConfigManager {
  private configPath: string;
  private config: AgentSystemConfig;
  private watchers: fs.FSWatcher[] = [];

  constructor(configPath: string = './config/agent-system.json') {
    this.configPath = configPath;
    this.config = this.loadDefaultConfig();
  }

  private loadDefaultConfig(): AgentSystemConfig {
    return {
      coordinator: {
        agent_name: 'coordinator',
        agent_type: 'coordinator',
        capabilities: ['task_distribution', 'agent_management', 'health_monitoring'],
        dependencies: ['shared-types', 'shared-utils'],
        port: 3000,
        host: 'localhost',
        log_level: 'info'
      },
      collector: {
        agent_name: 'collector',
        agent_type: 'data-collection',
        capabilities: ['rss-collection', 'web-scraping', 'api-integration'],
        dependencies: ['shared-types', 'shared-utils', 'coordinator-agent'],
        port: 3001,
        host: 'localhost',
        log_level: 'info',
        max_concurrent_sources: 10,
        collection_timeout: 60000,
        retry_attempts: 3,
        retry_delay: 5000,
        user_agent: 'AI-News-Collector/1.0',
        rate_limit: {
          requests_per_minute: 60,
          requests_per_hour: 1000
        }
      },
      processor: {
        agent_name: 'processor',
        agent_type: 'data-processing',
        capabilities: ['content-cleaning', 'entity-recognition', 'event-extraction'],
        dependencies: ['shared-types', 'shared-utils', 'coordinator-agent'],
        port: 3002,
        host: 'localhost',
        log_level: 'info'
      },
      analyzer: {
        agent_name: 'analyzer',
        agent_type: 'analysis',
        capabilities: ['sentiment-analysis', 'risk-detection', 'trend-analysis'],
        dependencies: ['shared-types', 'shared-utils', 'coordinator-agent'],
        port: 3003,
        host: 'localhost',
        log_level: 'info'
      },
      collectors: [],
      system: {
        log_level: 'info',
        health_check_interval: 30000,
        heartbeat_timeout: 60000,
        max_concurrent_tasks: 50,
        task_timeout: 300000
      }
    };
  }

  async loadConfig(): Promise<AgentSystemConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // 合并默认配置和加载的配置
        this.config = this.mergeConfig(this.config, loadedConfig);
        
        LoggerUtils.info('Configuration loaded successfully', { path: this.configPath });
      } else {
        LoggerUtils.warn('Configuration file not found, using defaults', { path: this.configPath });
        await this.saveConfig();
      }
    } catch (error) {
      LoggerUtils.error('Failed to load configuration', { 
        path: this.configPath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    return this.config;
  }

  async saveConfig(): Promise<void> {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      LoggerUtils.info('Configuration saved successfully', { path: this.configPath });
    } catch (error) {
      LoggerUtils.error('Failed to save configuration', { 
        path: this.configPath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  private mergeConfig(defaultConfig: AgentSystemConfig, loadedConfig: any): AgentSystemConfig {
    return {
      ...defaultConfig,
      ...loadedConfig,
      collectors: loadedConfig.collectors || defaultConfig.collectors,
      system: {
        ...defaultConfig.system,
        ...loadedConfig.system
      }
    };
  }

  getConfig(): AgentSystemConfig {
    return this.config;
  }

  getAgentConfig(agentName: string): AgentConfig | null {
    switch (agentName) {
      case 'coordinator':
        return this.config.coordinator;
      case 'collector':
        return this.config.collector;
      case 'processor':
        return this.config.processor;
      case 'analyzer':
        return this.config.analyzer;
      default:
        return null;
    }
  }

  getCollectorConfigs(): CollectorConfig[] {
    return this.config.collectors;
  }

  getCollectorConfig(name: string): CollectorConfig | null {
    return this.config.collectors.find(c => c.name === name) || null;
  }

  async addCollectorConfig(config: CollectorConfig): Promise<void> {
    const existingIndex = this.config.collectors.findIndex(c => c.name === config.name);
    
    if (existingIndex >= 0) {
      this.config.collectors[existingIndex] = config;
      LoggerUtils.info('Collector configuration updated', { name: config.name });
    } else {
      this.config.collectors.push(config);
      LoggerUtils.info('Collector configuration added', { name: config.name });
    }

    await this.saveConfig();
  }

  async removeCollectorConfig(name: string): Promise<boolean> {
    const initialLength = this.config.collectors.length;
    this.config.collectors = this.config.collectors.filter(c => c.name !== name);
    
    if (this.config.collectors.length < initialLength) {
      LoggerUtils.info('Collector configuration removed', { name });
      await this.saveConfig();
      return true;
    }
    
    return false;
  }

  async updateSystemConfig(systemConfig: Partial<AgentSystemConfig['system']>): Promise<void> {
    this.config.system = { ...this.config.system, ...systemConfig };
    LoggerUtils.info('System configuration updated');
    await this.saveConfig();
  }

  async updateAgentConfig(agentName: string, agentConfig: Partial<AgentConfig>): Promise<boolean> {
    const targetConfig = this.getAgentConfig(agentName);
    if (!targetConfig) {
      LoggerUtils.warn('Agent configuration not found', { agentName });
      return false;
    }

    Object.assign(targetConfig, agentConfig);
    LoggerUtils.info('Agent configuration updated', { agentName });
    await this.saveConfig();
    return true;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证代理配置
    const agents = ['coordinator', 'collector', 'processor', 'analyzer'];
    for (const agentName of agents) {
      const config = this.getAgentConfig(agentName);
      if (!config) {
        errors.push(`Missing configuration for agent: ${agentName}`);
        continue;
      }

      if (!config.agent_name || config.agent_name !== agentName) {
        errors.push(`Invalid agent_name for ${agentName}: ${config.agent_name}`);
      }

      if (!config.port || config.port < 1 || config.port > 65535) {
        errors.push(`Invalid port for ${agentName}: ${config.port}`);
      }

      if (!config.capabilities || config.capabilities.length === 0) {
        errors.push(`Missing capabilities for ${agentName}`);
      }
    }

    // 验证采集器配置
    for (const collector of this.config.collectors) {
      if (!collector.name) {
        errors.push('Collector configuration missing name');
      }

      if (!collector.type || !['rss', 'web', 'api'].includes(collector.type)) {
        errors.push(`Invalid collector type: ${collector.type}`);
      }

      if (!collector.config) {
        errors.push(`Collector ${collector.name} missing config`);
      }
    }

    // 验证系统配置
    const system = this.config.system;
    if (system.health_check_interval < 1000) {
      errors.push('Health check interval too short');
    }

    if (system.heartbeat_timeout < system.health_check_interval) {
      errors.push('Heartbeat timeout must be greater than health check interval');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async startConfigWatcher(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      LoggerUtils.warn('Configuration file not found, cannot start watcher', { path: this.configPath });
      return;
    }

    try {
      const watcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          LoggerUtils.info('Configuration file changed, reloading');
          await this.loadConfig();
        }
      });

      this.watchers.push(watcher);
      LoggerUtils.info('Configuration watcher started', { path: this.configPath });
    } catch (error) {
      LoggerUtils.error('Failed to start configuration watcher', { 
        path: this.configPath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  stopConfigWatcher(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    LoggerUtils.info('Configuration watchers stopped');
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  async importConfig(configData: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configData);
      this.config = this.mergeConfig(this.loadDefaultConfig(), importedConfig);
      await this.saveConfig();
      LoggerUtils.info('Configuration imported successfully');
    } catch (error) {
      LoggerUtils.error('Failed to import configuration', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
}