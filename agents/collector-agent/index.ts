import { CommunicationProtocol } from '../../shared/communication';
import { AgentConfig, AgentMessage, CollectionTask, NewsItem, Task } from '../../shared/types';
import { AGENT_ACTIONS, LoggerUtils, AgentUtils } from '../../shared/utils';
import { TaskScheduler } from '../../src/task';
import { CollectorFactory, CollectorConfig, CollectorResult } from './collectors/collector-factory';

export interface CollectorConfig extends AgentConfig {
  max_concurrent_sources: number;
  collection_timeout: number;
  retry_attempts: number;
  retry_delay: number;
  user_agent: string;
  rate_limit: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
}

export class CollectorAgent {
  private config: CollectorConfig;
  private communication: CommunicationProtocol;
  private taskScheduler: TaskScheduler;
  private logger = LoggerUtils;
  private activeSources: Map<string, CollectionTask> = new Map();
  private collectionStats: Map<string, any> = new Map();
  private rateLimiter: Map<string, number[]> = new Map();
  private collectorFactory: CollectorFactory;
  private collectorConfigs: Map<string, CollectorConfig> = new Map();

  constructor(config: CollectorConfig) {
    this.config = config;
    this.communication = new CommunicationProtocol(config.agent_name, config.port);
    this.collectorFactory = new CollectorFactory();
    this.taskScheduler = new TaskScheduler({
      max_concurrent_tasks: config.max_concurrent_sources,
      default_timeout: config.collection_timeout,
      max_retries: config.retry_attempts,
      retry_delay: config.retry_delay,
      cleanup_interval: 3600000, // 1小时
      task_retention_days: 7
    });
    
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // 健康检查
    this.communication.registerHandler('health_check', this.handleHealthCheck.bind(this));
    
    // 心跳
    this.communication.registerHandler('heartbeat', this.handleHeartbeat.bind(this));
    
    // 开始采集
    this.communication.registerHandler('start_collection', this.handleStartCollection.bind(this));
    
    // 停止采集
    this.communication.registerHandler('stop_collection', this.handleStopCollection.bind(this));
    
    // 获取采集状态
    this.communication.registerHandler('get_collection_status', this.handleGetCollectionStatus.bind(this));
    
    // 任务执行
    this.communication.registerHandler('execute_task', this.handleExecuteTask.bind(this));
    
    // 添加新闻源
    this.communication.registerHandler('add_source', this.handleAddSource.bind(this));
    
    // 移除新闻源
    this.communication.registerHandler('remove_source', this.handleRemoveSource.bind(this));
    
    // 获取统计信息
    this.communication.registerHandler('get_stats', this.handleGetStats.bind(this));
    
    // 配置采集器
    this.communication.registerHandler('configure_collector', this.handleConfigureCollector.bind(this));
    
    // 验证采集器
    this.communication.registerHandler('validate_collector', this.handleValidateCollector.bind(this));
    
    // 测试采集器
    this.communication.registerHandler('test_collector', this.handleTestCollector.bind(this));
    
    // 获取可用采集器类型
    this.communication.registerHandler('get_collector_types', this.handleGetCollectorTypes.bind(this));
  }

  private async handleHealthCheck(message: AgentMessage): Promise<void> {
    const response = {
      status: 'healthy',
      timestamp: Date.now(),
      active_sources: this.activeSources.size,
      total_collected: this.getTotalCollectedCount(),
      uptime: Date.now()
    };

    await this.sendResponse(message, response);
  }

  private async handleHeartbeat(message: AgentMessage): Promise<void> {
    const agentStatus = AgentUtils.createAgentStatus(
      this.config.agent_name,
      this.config.port,
      this.config.capabilities
    );
    
    agentStatus.uptime = Date.now();
    await this.sendResponse(message, agentStatus);
  }

  private async handleStartCollection(message: AgentMessage): Promise<void> {
    const { source_id, source_config } = message.data;
    
    try {
      const task: CollectionTask = {
        id: source_id,
        source_type: source_config.type,
        source_config,
        schedule: source_config.schedule || '0 */5 * * * *', // 默认每5分钟
        enabled: true,
        last_run: undefined,
        next_run: undefined
      };

      this.activeSources.set(source_id, task);
      this.logger.info('Collection started', { source_id, source_type: source_config.type });
      
      await this.sendResponse(message, { success: true, task });
    } catch (error) {
      this.logger.error('Failed to start collection', { source_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleStopCollection(message: AgentMessage): Promise<void> {
    const { source_id } = message.data;
    
    try {
      const task = this.activeSources.get(source_id);
      if (task) {
        task.enabled = false;
        this.logger.info('Collection stopped', { source_id });
      }
      
      await this.sendResponse(message, { success: true });
    } catch (error) {
      this.logger.error('Failed to stop collection', { source_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleGetCollectionStatus(message: AgentMessage): Promise<void> {
    const status = Array.from(this.activeSources.values()).map(task => ({
      source_id: task.id,
      source_type: task.source_type,
      enabled: task.enabled,
      last_run: task.last_run,
      next_run: task.next_run,
      stats: this.collectionStats.get(task.id) || {}
    }));

    await this.sendResponse(message, status);
  }

  private async handleExecuteTask(message: AgentMessage): Promise<void> {
    const task: Task = message.data;
    
    try {
      this.logger.info('Executing collection task', { task_id: task.id, type: task.type });
      
      // 根据任务类型执行相应的采集
      let result;
      switch (task.type) {
        case 'collect_news':
          result = await this.executeCollection(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      await this.sendResponse(message, { success: true, result });
    } catch (error) {
      this.logger.error('Task execution failed', { task_id: task.id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleAddSource(message: AgentMessage): Promise<void> {
    const { source_config } = message.data;
    
    try {
      const source_id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const task: CollectionTask = {
        id: source_id,
        source_type: source_config.type,
        source_config,
        schedule: source_config.schedule || '0 */5 * * * *',
        enabled: true,
        last_run: undefined,
        next_run: undefined
      };

      this.activeSources.set(source_id, task);
      this.collectionStats.set(source_id, {
        total_collected: 0,
        last_collection: null,
        errors: 0,
        average_processing_time: 0
      });

      this.logger.info('Source added', { source_id, source_type: source_config.type });
      await this.sendResponse(message, { success: true, source_id, task });
    } catch (error) {
      this.logger.error('Failed to add source', { error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleRemoveSource(message: AgentMessage): Promise<void> {
    const { source_id } = message.data;
    
    try {
      const deleted = this.activeSources.delete(source_id);
      this.collectionStats.delete(source_id);
      
      this.logger.info('Source removed', { source_id, deleted });
      await this.sendResponse(message, { success: true, deleted });
    } catch (error) {
      this.logger.error('Failed to remove source', { source_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleGetStats(message: AgentMessage): Promise<void> {
    const stats = {
      active_sources: this.activeSources.size,
      total_collected: this.getTotalCollectedCount(),
      sources: Array.from(this.collectionStats.entries()).map(([source_id, stat]) => ({
        source_id,
        ...stat
      })),
      rate_limits: this.getRateLimitStatus()
    };

    await this.sendResponse(message, stats);
  }

  private async handleConfigureCollector(message: AgentMessage): Promise<void> {
    const { collector_config } = message.data;
    
    try {
      const source_id = collector_config.name || `collector_${Date.now()}`;
      this.collectorConfigs.set(source_id, collector_config);
      
      this.logger.info('Collector configured', { source_id, type: collector_config.type });
      await this.sendResponse(message, { success: true, source_id, config: collector_config });
    } catch (error) {
      this.logger.error('Failed to configure collector', { error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleValidateCollector(message: AgentMessage): Promise<void> {
    const { source_id } = message.data;
    
    try {
      const collectorConfig = this.collectorConfigs.get(source_id);
      if (!collectorConfig) {
        throw new Error(`Collector configuration not found: ${source_id}`);
      }
      
      const isValid = await this.collectorFactory.validate(collectorConfig);
      
      await this.sendResponse(message, { 
        success: true, 
        source_id, 
        is_valid: isValid 
      });
    } catch (error) {
      this.logger.error('Failed to validate collector', { source_id, error });
      await this.sendResponse(message, { 
        success: false, 
        source_id, 
        is_valid: false, 
        error: error.message 
      });
    }
  }

  private async handleTestCollector(message: AgentMessage): Promise<void> {
    const { source_id } = message.data;
    
    try {
      const collectorConfig = this.collectorConfigs.get(source_id);
      if (!collectorConfig) {
        throw new Error(`Collector configuration not found: ${source_id}`);
      }
      
      const result = await this.collectorFactory.test(collectorConfig);
      
      await this.sendResponse(message, { 
        success: true, 
        source_id, 
        test_result: result 
      });
    } catch (error) {
      this.logger.error('Failed to test collector', { source_id, error });
      await this.sendResponse(message, { 
        success: false, 
        source_id, 
        error: error.message 
      });
    }
  }

  private async handleGetCollectorTypes(message: AgentMessage): Promise<void> {
    try {
      const types = this.collectorFactory.getAvailableTypes();
      
      await this.sendResponse(message, { 
        success: true, 
        collector_types: types 
      });
    } catch (error) {
      this.logger.error('Failed to get collector types', { error });
      await this.sendResponse(message, { 
        success: false, 
        error: error.message 
      });
    }
  }

  private async executeCollection(task: Task): Promise<any> {
    const { source_id, source_config } = task.data;
    
    // 检查速率限制
    if (!this.checkRateLimit(source_id)) {
      throw new Error('Rate limit exceeded');
    }

    const startTime = Date.now();
    
    try {
      // 获取采集器配置
      const collectorConfig = this.collectorConfigs.get(source_id);
      if (!collectorConfig) {
        throw new Error(`Collector configuration not found for source: ${source_id}`);
      }
      
      // 使用采集器工厂进行采集
      const result = await this.collectorFactory.collect(collectorConfig);
      
      // 更新统计信息
      this.updateCollectionStats(source_id, result.collected_count, result.processing_time);
      
      // 记录速率限制
      this.recordRateLimit(source_id);
      
      return {
        source_id,
        collected_count: result.collected_count,
        processing_time: result.processing_time,
        news_items: result.items,
        error: result.error,
        metadata: result.metadata
      };
    } catch (error) {
      // 更新错误统计
      this.incrementErrorCount(source_id);
      throw error;
    }
  }

  private async simulateCollection(source_config: any): Promise<NewsItem[]> {
    // 模拟采集延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    // 模拟生成新闻项
    const newsCount = Math.floor(Math.random() * 10) + 1;
    const newsItems: NewsItem[] = [];
    
    for (let i = 0; i < newsCount; i++) {
      newsItems.push({
        id: `news_${Date.now()}_${i}`,
        title: `News Item ${i + 1} from ${source_config.type}`,
        content: `This is sample content for news item ${i + 1}`,
        url: `https://example.com/news/${i + 1}`,
        source: source_config.name || 'Unknown Source',
        publish_time: new Date(Date.now() - Math.random() * 86400000),
        collected_at: new Date(),
        raw_data: { source_config, simulated: true }
      });
    }
    
    return newsItems;
  }

  private checkRateLimit(source_id: string): boolean {
    const now = Date.now();
    const requests = this.rateLimiter.get(source_id) || [];
    
    // 检查每分钟限制
    const minuteAgo = now - 60000;
    const recentRequests = requests.filter(time => time > minuteAgo);
    
    if (recentRequests.length >= this.config.rate_limit.requests_per_minute) {
      return false;
    }
    
    // 检查每小时限制
    const hourAgo = now - 3600000;
    const hourRequests = requests.filter(time => time > hourAgo);
    
    return hourRequests.length < this.config.rate_limit.requests_per_hour;
  }

  private recordRateLimit(source_id: string): void {
    const now = Date.now();
    const requests = this.rateLimiter.get(source_id) || [];
    requests.push(now);
    
    // 清理旧的记录
    const hourAgo = now - 3600000;
    const recentRequests = requests.filter(time => time > hourAgo);
    
    this.rateLimiter.set(source_id, recentRequests);
  }

  private getRateLimitStatus(): any {
    const status: any = {};
    
    for (const [source_id, requests] of this.rateLimiter) {
      const now = Date.now();
      const minuteAgo = now - 60000;
      const hourAgo = now - 3600000;
      
      status[source_id] = {
        requests_per_minute: requests.filter(time => time > minuteAgo).length,
        requests_per_hour: requests.filter(time => time > hourAgo).length,
        limit_per_minute: this.config.rate_limit.requests_per_minute,
        limit_per_hour: this.config.rate_limit.requests_per_hour
      };
    }
    
    return status;
  }

  private updateCollectionStats(source_id: string, count: number, processingTime: number): void {
    const stats = this.collectionStats.get(source_id) || {
      total_collected: 0,
      last_collection: null,
      errors: 0,
      average_processing_time: 0,
      processing_times: []
    };
    
    stats.total_collected += count;
    stats.last_collection = new Date();
    stats.processing_times = stats.processing_times || [];
    stats.processing_times.push(processingTime);
    
    // 保持最近100次的处理时间
    if (stats.processing_times.length > 100) {
      stats.processing_times = stats.processing_times.slice(-100);
    }
    
    // 计算平均处理时间
    stats.average_processing_time = stats.processing_times.reduce((sum, time) => sum + time, 0) / stats.processing_times.length;
    
    this.collectionStats.set(source_id, stats);
  }

  private incrementErrorCount(source_id: string): void {
    const stats = this.collectionStats.get(source_id) || {
      total_collected: 0,
      last_collection: null,
      errors: 0,
      average_processing_time: 0
    };
    
    stats.errors = (stats.errors || 0) + 1;
    this.collectionStats.set(source_id, stats);
  }

  private getTotalCollectedCount(): number {
    let total = 0;
    for (const stats of this.collectionStats.values()) {
      total += stats.total_collected || 0;
    }
    return total;
  }

  private async sendResponse(originalMessage: AgentMessage, data: any): Promise<void> {
    try {
      await this.communication.sendMessage(
        originalMessage.from,
        'response',
        {
          action: originalMessage.action,
          data,
          timestamp: Date.now()
        }
      );
    } catch (error) {
      this.logger.error('Failed to send response', { error });
    }
  }

  public async start(): Promise<void> {
    this.logger.info(`Starting Collector Agent on port ${this.config.port}`);
    
    // 启动通信服务
    this.communication.start();
    
    // 启动任务调度器
    this.taskScheduler.start();
    
    // 注册到协调代理
    const selfStatus = AgentUtils.createAgentStatus(
      this.config.agent_name,
      this.config.port,
      this.config.capabilities
    );
    
    await this.communication.registerToCoordinator(selfStatus);
    
    this.logger.info('Collector Agent started successfully');
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping Collector Agent');
    
    // 停止任务调度器
    this.taskScheduler.stop();
    
    // 停止通信服务
    this.communication.stop();
    
    this.logger.info('Collector Agent stopped');
  }

  public getStatus(): any {
    return {
      agent_name: this.config.agent_name,
      status: 'running',
      port: this.config.port,
      active_sources: this.activeSources.size,
      total_collected: this.getTotalCollectedCount(),
      capabilities: this.config.capabilities,
      uptime: Date.now()
    };
  }
}