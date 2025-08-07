import { CommunicationProtocol } from '../../shared/communication';
import { AgentConfig, AgentMessage, NewsItem, ProcessedNews, ProcessingTask, Entity, Event } from '../../shared/types';
import { AGENT_ACTIONS, LoggerUtils, AgentUtils } from '../../shared/utils';
import { TaskScheduler } from '../../src/task';

export interface ProcessorConfig extends AgentConfig {
  max_concurrent_tasks: number;
  processing_timeout: number;
  entity_recognition: {
    enable_stock_codes: boolean;
    enable_companies: boolean;
    enable_persons: boolean;
    enable_locations: boolean;
    confidence_threshold: number;
  };
  event_extraction: {
    enable_triple_extraction: boolean;
    confidence_threshold: number;
  };
  content_cleaning: {
    remove_html: boolean;
    remove_ads: boolean;
    normalize_whitespace: boolean;
    min_content_length: number;
  };
}

export class ProcessorAgent {
  private config: ProcessorConfig;
  private communication: CommunicationProtocol;
  private taskScheduler: TaskScheduler;
  private logger = LoggerUtils;
  private processingQueue: ProcessingTask[] = [];
  private activeTasks: Map<string, ProcessingTask> = new Map();
  private processingStats: Map<string, any> = new Map();

  constructor(config: ProcessorConfig) {
    this.config = config;
    this.communication = new CommunicationProtocol(config.agent_name, config.port);
    this.taskScheduler = new TaskScheduler({
      max_concurrent_tasks: config.max_concurrent_tasks,
      default_timeout: config.processing_timeout,
      max_retries: 3,
      retry_delay: 2000,
      cleanup_interval: 3600000,
      task_retention_days: 7
    });
    
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // 健康检查
    this.communication.registerHandler('health_check', this.handleHealthCheck.bind(this));
    
    // 心跳
    this.communication.registerHandler('heartbeat', this.handleHeartbeat.bind(this));
    
    // 处理新闻
    this.communication.registerHandler('process_news', this.handleProcessNews.bind(this));
    
    // 提取实体
    this.communication.registerHandler('extract_entities', this.handleExtractEntities.bind(this));
    
    // 提取事件
    this.communication.registerHandler('extract_events', this.handleExtractEvents.bind(this));
    
    // 清洗内容
    this.communication.registerHandler('clean_content', this.handleCleanContent.bind(this));
    
    // 任务执行
    this.communication.registerHandler('execute_task', this.handleExecuteTask.bind(this));
    
    // 获取处理状态
    this.communication.registerHandler('get_processing_status', this.handleGetProcessingStatus.bind(this));
    
    // 获取统计信息
    this.communication.registerHandler('get_stats', this.handleGetStats.bind(this));
    
    // 批量处理
    this.communication.registerHandler('batch_process', this.handleBatchProcess.bind(this));
  }

  private async handleHealthCheck(message: AgentMessage): Promise<void> {
    const response = {
      status: 'healthy',
      timestamp: Date.now(),
      active_tasks: this.activeTasks.size,
      queue_size: this.processingQueue.length,
      total_processed: this.getTotalProcessedCount(),
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

  private async handleProcessNews(message: AgentMessage): Promise<void> {
    const { news_items } = message.data;
    
    try {
      const results: ProcessedNews[] = [];
      
      for (const newsItem of news_items) {
        const processed = await this.processNewsItem(newsItem);
        results.push(processed);
      }
      
      await this.sendResponse(message, { 
        success: true, 
        processed_count: results.length,
        results 
      });
    } catch (error) {
      this.logger.error('Failed to process news', { error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleExtractEntities(message: AgentMessage): Promise<void> {
    const { text, news_id } = message.data;
    
    try {
      const entities = await this.extractEntities(text, news_id);
      
      await this.sendResponse(message, { 
        success: true, 
        entities,
        entity_count: entities.length 
      });
    } catch (error) {
      this.logger.error('Failed to extract entities', { news_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleExtractEvents(message: AgentMessage): Promise<void> {
    const { text, news_id } = message.data;
    
    try {
      const events = await this.extractEvents(text, news_id);
      
      await this.sendResponse(message, { 
        success: true, 
        events,
        event_count: events.length 
      });
    } catch (error) {
      this.logger.error('Failed to extract events', { news_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleCleanContent(message: AgentMessage): Promise<void> {
    const { content, news_id } = message.data;
    
    try {
      const cleaned = await this.cleanContent(content);
      
      await this.sendResponse(message, { 
        success: true, 
        cleaned_content: cleaned,
        original_length: content.length,
        cleaned_length: cleaned.length 
      });
    } catch (error) {
      this.logger.error('Failed to clean content', { news_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleExecuteTask(message: AgentMessage): Promise<void> {
    const task: any = message.data;
    
    try {
      this.logger.info('Executing processing task', { task_id: task.id, type: task.type });
      
      let result;
      switch (task.type) {
        case 'process_content':
          result = await this.executeProcessing(task);
          break;
        case 'extract_entities':
          result = await this.executeEntityExtraction(task);
          break;
        case 'extract_events':
          result = await this.executeEventExtraction(task);
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

  private async handleGetProcessingStatus(message: AgentMessage): Promise<void> {
    const status = {
      active_tasks: Array.from(this.activeTasks.values()),
      queue_size: this.processingQueue.length,
      processing_stats: Array.from(this.processingStats.entries())
    };

    await this.sendResponse(message, status);
  }

  private async handleGetStats(message: AgentMessage): Promise<void> {
    const stats = {
      total_processed: this.getTotalProcessedCount(),
      active_tasks: this.activeTasks.size,
      queue_size: this.processingQueue.length,
      average_processing_time: this.getAverageProcessingTime(),
      success_rate: this.getSuccessRate(),
      processing_capabilities: {
        entity_recognition: this.config.entity_recognition,
        event_extraction: this.config.event_extraction,
        content_cleaning: this.config.content_cleaning
      }
    };

    await this.sendResponse(message, stats);
  }

  private async handleBatchProcess(message: AgentMessage): Promise<void> {
    const { news_items, batch_size = 10 } = message.data;
    
    try {
      const results: ProcessedNews[] = [];
      const batches = this.chunkArray(news_items, batch_size);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.info(`Processing batch ${i + 1}/${batches.length}`, { 
          batch_size: batch.length 
        });
        
        const batchResults = await Promise.all(
          batch.map(item => this.processNewsItem(item))
        );
        
        results.push(...batchResults);
        
        // 批次间添加小延迟避免过载
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      await this.sendResponse(message, { 
        success: true, 
        processed_count: results.length,
        results 
      });
    } catch (error) {
      this.logger.error('Batch processing failed', { error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async processNewsItem(newsItem: NewsItem): Promise<ProcessedNews> {
    const startTime = Date.now();
    
    try {
      // 1. 清洗内容
      const cleanedContent = await this.cleanContent(newsItem.content);
      
      // 2. 提取实体
      const entities = await this.extractEntities(cleanedContent, newsItem.id);
      
      // 3. 提取事件
      const events = await this.extractEvents(cleanedContent, newsItem.id);
      
      // 4. 分析情感（如果有配置）
      let sentiment;
      if (this.config.capabilities.includes('sentiment_analysis')) {
        sentiment = await this.analyzeSentiment(cleanedContent);
      }
      
      const processedNews: ProcessedNews = {
        ...newsItem,
        cleaned_content: cleanedContent,
        entities,
        events,
        sentiment
      };
      
      // 更新统计信息
      this.updateProcessingStats('process_news', Date.now() - startTime, true);
      
      return processedNews;
    } catch (error) {
      this.updateProcessingStats('process_news', Date.now() - startTime, false);
      throw error;
    }
  }

  private async cleanContent(content: string): Promise<string> {
    let cleaned = content;
    
    // 移除HTML标签
    if (this.config.content_cleaning.remove_html) {
      cleaned = cleaned.replace(/<[^>]*>/g, '');
    }
    
    // 移除广告
    if (this.config.content_cleaning.remove_ads) {
      cleaned = cleaned.replace(/广告|ADV|ADVERTISEMENT/gi, '');
    }
    
    // 标准化空白字符
    if (this.config.content_cleaning.normalize_whitespace) {
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
    }
    
    // 检查最小内容长度
    if (cleaned.length < this.config.content_cleaning.min_content_length) {
      throw new Error('Content too short after cleaning');
    }
    
    return cleaned;
  }

  private async extractEntities(text: string, newsId: string): Promise<Entity[]> {
    const entities: Entity[] = [];
    
    if (!this.config.entity_recognition.enable_stock_codes &&
        !this.config.entity_recognition.enable_companies &&
        !this.config.entity_recognition.enable_persons &&
        !this.config.entity_recognition.enable_locations) {
      return entities;
    }
    
    // 模拟实体提取（实际应该调用NLP服务）
    const mockEntities = this.generateMockEntities(text, newsId);
    
    // 过滤低置信度实体
    return mockEntities.filter(entity => 
      entity.confidence >= this.config.entity_recognition.confidence_threshold
    );
  }

  private async extractEvents(text: string, newsId: string): Promise<Event[]> {
    if (!this.config.event_extraction.enable_triple_extraction) {
      return [];
    }
    
    // 模拟事件提取（实际应该调用NLP服务）
    const mockEvents = this.generateMockEvents(text, newsId);
    
    // 过滤低置信度事件
    return mockEvents.filter(event => 
      event.confidence >= this.config.event_extraction.confidence_threshold
    );
  }

  private async analyzeSentiment(text: string): Promise<any> {
    // 模拟情感分析（实际应该调用AI服务）
    const score = Math.random() * 2 - 1; // -1 to 1
    let label: 'positive' | 'negative' | 'neutral';
    
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    else label = 'neutral';
    
    return {
      score,
      confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1
      label
    };
  }

  private generateMockEntities(text: string, newsId: string): Entity[] {
    const entities: Entity[] = [];
    
    // 模拟股票代码
    if (this.config.entity_recognition.enable_stock_codes) {
      const stockCodes = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
      const randomStock = stockCodes[Math.floor(Math.random() * stockCodes.length)];
      entities.push({
        id: `entity_${newsId}_stock`,
        type: 'stock_code',
        value: randomStock,
        confidence: Math.random() * 0.3 + 0.7,
        start_pos: Math.floor(Math.random() * 100),
        end_pos: Math.floor(Math.random() * 100) + 5
      });
    }
    
    // 模拟公司名称
    if (this.config.entity_recognition.enable_companies) {
      const companies = ['Apple', 'Google', 'Microsoft', 'Tesla', 'Amazon'];
      const randomCompany = companies[Math.floor(Math.random() * companies.length)];
      entities.push({
        id: `entity_${newsId}_company`,
        type: 'company',
        value: randomCompany,
        confidence: Math.random() * 0.3 + 0.7,
        start_pos: Math.floor(Math.random() * 100),
        end_pos: Math.floor(Math.random() * 100) + 5
      });
    }
    
    return entities;
  }

  private generateMockEvents(text: string, newsId: string): Event[] {
    const events: Event[] = [];
    
    // 模拟事件三元组
    const subjects = ['Apple', 'Google', 'Microsoft'];
    const actions = ['announced', 'released', 'launched', 'acquired'];
    const objects = ['new product', 'software update', 'service', 'company'];
    
    if (Math.random() > 0.5) {
      events.push({
        id: `event_${newsId}_1`,
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        object: objects[Math.floor(Math.random() * objects.length)],
        confidence: Math.random() * 0.4 + 0.6,
        timestamp: new Date()
      });
    }
    
    return events;
  }

  private async executeProcessing(task: any): Promise<any> {
    const { news_item } = task.data;
    const processed = await this.processNewsItem(news_item);
    
    return {
      task_id: task.id,
      processed_news: processed,
      processing_time: Date.now() - task.created_at
    };
  }

  private async executeEntityExtraction(task: any): Promise<any> {
    const { text, news_id } = task.data;
    const entities = await this.extractEntities(text, news_id);
    
    return {
      task_id: task.id,
      entities,
      entity_count: entities.length
    };
  }

  private async executeEventExtraction(task: any): Promise<any> {
    const { text, news_id } = task.data;
    const events = await this.extractEvents(text, news_id);
    
    return {
      task_id: task.id,
      events,
      event_count: events.length
    };
  }

  private updateProcessingStats(operation: string, processingTime: number, success: boolean): void {
    const stats = this.processingStats.get(operation) || {
      total_count: 0,
      success_count: 0,
      error_count: 0,
      total_processing_time: 0,
      average_processing_time: 0,
      processing_times: []
    };
    
    stats.total_count++;
    if (success) {
      stats.success_count++;
    } else {
      stats.error_count++;
    }
    
    stats.total_processing_time += processingTime;
    stats.processing_times = stats.processing_times || [];
    stats.processing_times.push(processingTime);
    
    // 保持最近100次的处理时间
    if (stats.processing_times.length > 100) {
      stats.processing_times = stats.processing_times.slice(-100);
    }
    
    stats.average_processing_time = stats.total_processing_time / stats.total_count;
    
    this.processingStats.set(operation, stats);
  }

  private getTotalProcessedCount(): number {
    let total = 0;
    for (const stats of this.processingStats.values()) {
      total += stats.total_count || 0;
    }
    return total;
  }

  private getAverageProcessingTime(): number {
    let totalTime = 0;
    let totalCount = 0;
    
    for (const stats of this.processingStats.values()) {
      totalTime += stats.total_processing_time || 0;
      totalCount += stats.total_count || 0;
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  private getSuccessRate(): number {
    let totalSuccess = 0;
    let totalCount = 0;
    
    for (const stats of this.processingStats.values()) {
      totalSuccess += stats.success_count || 0;
      totalCount += stats.total_count || 0;
    }
    
    return totalCount > 0 ? totalSuccess / totalCount : 0;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
    this.logger.info(`Starting Processor Agent on port ${this.config.port}`);
    
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
    
    this.logger.info('Processor Agent started successfully');
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping Processor Agent');
    
    // 停止任务调度器
    this.taskScheduler.stop();
    
    // 停止通信服务
    this.communication.stop();
    
    this.logger.info('Processor Agent stopped');
  }

  public getStatus(): any {
    return {
      agent_name: this.config.agent_name,
      status: 'running',
      port: this.config.port,
      active_tasks: this.activeTasks.size,
      queue_size: this.processingQueue.length,
      total_processed: this.getTotalProcessedCount(),
      capabilities: this.config.capabilities,
      uptime: Date.now()
    };
  }
}