import { CommunicationProtocol } from '../../shared/communication';
import { AgentConfig, AgentMessage, ProcessedNews, AnalysisTask, RiskAlert, SentimentScore } from '../../shared/types';
import { AGENT_ACTIONS, LoggerUtils, AgentUtils } from '../../shared/utils';
import { TaskScheduler } from '../../src/task';

export interface AnalyzerConfig extends AgentConfig {
  max_concurrent_tasks: number;
  analysis_timeout: number;
  sentiment_analysis: {
    model_type: string;
    confidence_threshold: number;
    batch_size: number;
  };
  risk_detection: {
    enable_financial_risks: boolean;
    enable_reputation_risks: boolean;
    enable_market_risks: boolean;
    severity_threshold: number;
  };
  trend_analysis: {
    time_window: number;
    min_events_for_trend: number;
    confidence_threshold: number;
  };
}

export class AnalyzerAgent {
  private config: AnalyzerConfig;
  private communication: CommunicationProtocol;
  private taskScheduler: TaskScheduler;
  private logger = LoggerUtils;
  private analysisQueue: AnalysisTask[] = [];
  private activeTasks: Map<string, AnalysisTask> = new Map();
  private analysisStats: Map<string, any> = new Map();
  private riskAlerts: RiskAlert[] = [];
  private sentimentHistory: Map<string, SentimentScore[]> = new Map();
  private trendData: Map<string, any[]> = new Map();

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.communication = new CommunicationProtocol(config.agent_name, config.port);
    this.taskScheduler = new TaskScheduler({
      max_concurrent_tasks: config.max_concurrent_tasks,
      default_timeout: config.analysis_timeout,
      max_retries: 3,
      retry_delay: 3000,
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
    
    // 分析情感
    this.communication.registerHandler('analyze_sentiment', this.handleAnalyzeSentiment.bind(this));
    
    // 检测风险
    this.communication.registerHandler('detect_risks', this.handleDetectRisks.bind(this));
    
    // 分析趋势
    this.communication.registerHandler('analyze_trends', this.handleAnalyzeTrends.bind(this));
    
    // 生成报告
    this.communication.registerHandler('generate_report', this.handleGenerateReport.bind(this));
    
    // 任务执行
    this.communication.registerHandler('execute_task', this.handleExecuteTask.bind(this));
    
    // 获取分析状态
    this.communication.registerHandler('get_analysis_status', this.handleGetAnalysisStatus.bind(this));
    
    // 获取统计信息
    this.communication.registerHandler('get_stats', this.handleGetStats.bind(this));
    
    // 获取风险告警
    this.communication.registerHandler('get_risk_alerts', this.handleGetRiskAlerts.bind(this));
    
    // 批量分析
    this.communication.registerHandler('batch_analyze', this.handleBatchAnalyze.bind(this));
  }

  private async handleHealthCheck(message: AgentMessage): Promise<void> {
    const response = {
      status: 'healthy',
      timestamp: Date.now(),
      active_tasks: this.activeTasks.size,
      queue_size: this.analysisQueue.length,
      total_analyzed: this.getTotalAnalyzedCount(),
      risk_alerts_count: this.riskAlerts.length,
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

  private async handleAnalyzeSentiment(message: AgentMessage): Promise<void> {
    const { text, news_id, entity_id } = message.data;
    
    try {
      const sentiment = await this.analyzeSentiment(text, news_id, entity_id);
      
      // 保存情感历史
      this.saveSentimentHistory(news_id, sentiment);
      
      await this.sendResponse(message, { 
        success: true, 
        sentiment,
        confidence: sentiment.confidence 
      });
    } catch (error) {
      this.logger.error('Failed to analyze sentiment', { news_id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleDetectRisks(message: AgentMessage): Promise<void> {
    const { news_item, processed_news } = message.data;
    
    try {
      const risks = await this.detectRisks(news_item, processed_news);
      
      // 保存风险告警
      risks.forEach(risk => this.riskAlerts.push(risk));
      
      await this.sendResponse(message, { 
        success: true, 
        risks,
        risk_count: risks.length 
      });
    } catch (error) {
      this.logger.error('Failed to detect risks', { news_id: news_item.id, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleAnalyzeTrends(message: AgentMessage): Promise<void> {
    const { news_items, time_window } = message.data;
    
    try {
      const trends = await this.analyzeTrends(news_items, time_window);
      
      await this.sendResponse(message, { 
        success: true, 
        trends,
        trend_count: trends.length 
      });
    } catch (error) {
      this.logger.error('Failed to analyze trends', { error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleGenerateReport(message: AgentMessage): Promise<void> {
    const { report_type, time_range, filters } = message.data;
    
    try {
      const report = await this.generateReport(report_type, time_range, filters);
      
      await this.sendResponse(message, { 
        success: true, 
        report,
        generated_at: new Date().toISOString() 
      });
    } catch (error) {
      this.logger.error('Failed to generate report', { report_type, error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async handleExecuteTask(message: AgentMessage): Promise<void> {
    const task: AnalysisTask = message.data;
    
    try {
      this.logger.info('Executing analysis task', { task_id: task.id, type: task.type });
      
      let result;
      switch (task.type) {
        case 'sentiment':
          result = await this.executeSentimentAnalysis(task);
          break;
        case 'risk':
          result = await this.executeRiskDetection(task);
          break;
        case 'trend':
          result = await this.executeTrendAnalysis(task);
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

  private async handleGetAnalysisStatus(message: AgentMessage): Promise<void> {
    const status = {
      active_tasks: Array.from(this.activeTasks.values()),
      queue_size: this.analysisQueue.length,
      analysis_stats: Array.from(this.analysisStats.entries()),
      risk_alerts_count: this.riskAlerts.length,
      sentiment_history_size: this.sentimentHistory.size
    };

    await this.sendResponse(message, status);
  }

  private async handleGetStats(message: AgentMessage): Promise<void> {
    const stats = {
      total_analyzed: this.getTotalAnalyzedCount(),
      active_tasks: this.activeTasks.size,
      queue_size: this.analysisQueue.length,
      average_analysis_time: this.getAverageAnalysisTime(),
      success_rate: this.getSuccessRate(),
      risk_alerts: {
        total: this.riskAlerts.length,
        by_severity: this.getRiskAlertsBySeverity(),
        by_type: this.getRiskAlertsByType()
      },
      sentiment_stats: this.getSentimentStats(),
      analysis_capabilities: {
        sentiment_analysis: this.config.sentiment_analysis,
        risk_detection: this.config.risk_detection,
        trend_analysis: this.config.trend_analysis
      }
    };

    await this.sendResponse(message, stats);
  }

  private async handleGetRiskAlerts(message: AgentMessage): Promise<void> {
    const { severity, limit = 50, offset = 0 } = message.data;
    
    let alerts = this.riskAlerts;
    
    // 按严重程度过滤
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // 分页
    const paginatedAlerts = alerts.slice(offset, offset + limit);
    
    await this.sendResponse(message, { 
      alerts: paginatedAlerts,
      total: alerts.length,
      offset,
      limit
    });
  }

  private async handleBatchAnalyze(message: AgentMessage): Promise<void> {
    const { news_items, analysis_types, batch_size = 5 } = message.data;
    
    try {
      const results: any[] = [];
      const batches = this.chunkArray(news_items, batch_size);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.info(`Processing analysis batch ${i + 1}/${batches.length}`, { 
          batch_size: batch.length 
        });
        
        const batchResults = await Promise.all(
          batch.map(item => this.analyzeNewsItem(item, analysis_types))
        );
        
        results.push(...batchResults);
        
        // 批次间添加延迟
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      await this.sendResponse(message, { 
        success: true, 
        analyzed_count: results.length,
        results 
      });
    } catch (error) {
      this.logger.error('Batch analysis failed', { error });
      await this.sendResponse(message, { success: false, error: error.message });
    }
  }

  private async analyzeNewsItem(newsItem: ProcessedNews, analysisTypes: string[]): Promise<any> {
    const startTime = Date.now();
    const result: any = {
      news_id: newsItem.id,
      analysis_results: {}
    };
    
    try {
      // 情感分析
      if (analysisTypes.includes('sentiment')) {
        result.analysis_results.sentiment = await this.analyzeSentiment(
          newsItem.cleaned_content, 
          newsItem.id
        );
      }
      
      // 风险检测
      if (analysisTypes.includes('risk')) {
        result.analysis_results.risks = await this.detectRisks(newsItem, newsItem);
      }
      
      // 趋势分析（如果有足够的历史数据）
      if (analysisTypes.includes('trend')) {
        result.analysis_results.trends = await this.analyzeTrends([newsItem]);
      }
      
      this.updateAnalysisStats('batch_analyze', Date.now() - startTime, true);
      
      return result;
    } catch (error) {
      this.updateAnalysisStats('batch_analyze', Date.now() - startTime, false);
      throw error;
    }
  }

  private async analyzeSentiment(text: string, newsId: string, entityId?: string): Promise<SentimentScore> {
    // 模拟情感分析（实际应该调用AI服务）
    const score = Math.random() * 2 - 1; // -1 to 1
    let label: 'positive' | 'negative' | 'neutral';
    
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    else label = 'neutral';
    
    const sentiment: SentimentScore = {
      score,
      confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1
      label
    };
    
    // 检查置信度阈值
    if (sentiment.confidence < this.config.sentiment_analysis.confidence_threshold) {
      throw new Error('Sentiment analysis confidence too low');
    }
    
    return sentiment;
  }

  private async detectRisks(newsItem: ProcessedNews, processedNews: ProcessedNews): Promise<RiskAlert[]> {
    const risks: RiskAlert[] = [];
    
    if (!this.config.risk_detection.enable_financial_risks &&
        !this.config.risk_detection.enable_reputation_risks &&
        !this.config.risk_detection.enable_market_risks) {
      return risks;
    }
    
    // 模拟风险检测（实际应该使用更复杂的算法）
    const riskScore = Math.random();
    
    if (riskScore > this.config.risk_detection.severity_threshold) {
      const riskTypes = ['financial', 'reputation', 'market'];
      const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
      
      const riskType = riskTypes[Math.floor(Math.random() * riskTypes.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      
      // 检查是否启用对应的风险类型
      if ((riskType === 'financial' && this.config.risk_detection.enable_financial_risks) ||
          (riskType === 'reputation' && this.config.risk_detection.enable_reputation_risks) ||
          (riskType === 'market' && this.config.risk_detection.enable_market_risks)) {
        
        const relatedEntities = processedNews.entities.map(e => e.value);
        
        risks.push({
          id: `risk_${newsItem.id}_${Date.now()}`,
          news_id: newsItem.id,
          risk_type: riskType,
          severity,
          description: `Detected ${riskType} risk in news: ${newsItem.title}`,
          confidence: riskScore,
          created_at: new Date(),
          related_entities: relatedEntities
        });
      }
    }
    
    return risks;
  }

  private async analyzeTrends(newsItems: ProcessedNews[], timeWindow?: number): Promise<any[]> {
    const window = timeWindow || this.config.trend_analysis.time_window;
    
    // 模拟趋势分析（实际应该使用时间序列分析）
    const trends: any[] = [];
    
    if (newsItems.length >= this.config.trend_analysis.min_events_for_trend) {
      // 按实体分组
      const entityGroups = this.groupNewsByEntities(newsItems);
      
      for (const [entity, items] of entityGroups.entries()) {
        if (items.length >= this.config.trend_analysis.min_events_for_trend) {
          const sentimentTrend = this.calculateSentimentTrend(items);
          const frequencyTrend = this.calculateFrequencyTrend(items);
          
          if (sentimentTrend.significance > this.config.trend_analysis.confidence_threshold ||
              frequencyTrend.significance > this.config.trend_analysis.confidence_threshold) {
            
            trends.push({
              entity,
              sentiment_trend: sentimentTrend,
              frequency_trend: frequencyTrend,
              time_window: window,
              confidence: Math.max(sentimentTrend.significance, frequencyTrend.significance),
              news_count: items.length
            });
          }
        }
      }
    }
    
    return trends;
  }

  private async generateReport(reportType: string, timeRange: any, filters: any): Promise<any> {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeRange.days * 24 * 60 * 60 * 1000);
    
    switch (reportType) {
      case 'sentiment':
        return this.generateSentimentReport(startTime, now, filters);
      case 'risk':
        return this.generateRiskReport(startTime, now, filters);
      case 'trend':
        return this.generateTrendReport(startTime, now, filters);
      case 'summary':
        return this.generateSummaryReport(startTime, now, filters);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  private async executeSentimentAnalysis(task: AnalysisTask): Promise<any> {
    const { text, news_id } = task.parameters;
    const sentiment = await this.analyzeSentiment(text, news_id);
    
    return {
      task_id: task.id,
      sentiment,
      analysis_time: Date.now() - task.created_at.getTime()
    };
  }

  private async executeRiskDetection(task: AnalysisTask): Promise<any> {
    const { news_item, processed_news } = task.parameters;
    const risks = await this.detectRisks(news_item, processed_news);
    
    return {
      task_id: task.id,
      risks,
      risk_count: risks.length,
      analysis_time: Date.now() - task.created_at.getTime()
    };
  }

  private async executeTrendAnalysis(task: AnalysisTask): Promise<any> {
    const { news_items, time_window } = task.parameters;
    const trends = await this.analyzeTrends(news_items, time_window);
    
    return {
      task_id: task.id,
      trends,
      trend_count: trends.length,
      analysis_time: Date.now() - task.created_at.getTime()
    };
  }

  private saveSentimentHistory(newsId: string, sentiment: SentimentScore): void {
    const history = this.sentimentHistory.get(newsId) || [];
    history.push(sentiment);
    
    // 保持最近100条记录
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.sentimentHistory.set(newsId, history);
  }

  private groupNewsByEntities(newsItems: ProcessedNews[]): Map<string, ProcessedNews[]> {
    const groups = new Map<string, ProcessedNews[]>();
    
    for (const item of newsItems) {
      for (const entity of item.entities) {
        if (!groups.has(entity.value)) {
          groups.set(entity.value, []);
        }
        groups.get(entity.value)!.push(item);
      }
    }
    
    return groups;
  }

  private calculateSentimentTrend(items: ProcessedNews[]): any {
    // 简化的趋势计算（实际应该使用更复杂的算法）
    const sentiments = items.map(item => item.sentiment?.score || 0);
    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
    
    return {
      direction: avgSentiment > 0 ? 'positive' : avgSentiment < 0 ? 'negative' : 'neutral',
      strength: Math.abs(avgSentiment),
      significance: 1 - (variance / 4), // 简化的显著性计算
      data_points: sentiments.length
    };
  }

  private calculateFrequencyTrend(items: ProcessedNews[]): any {
    // 简化的频率趋势计算
    const timeSpan = Math.max(...items.map(item => item.publish_time.getTime())) - 
                     Math.min(...items.map(item => item.publish_time.getTime()));
    const frequency = items.length / (timeSpan / (24 * 60 * 60 * 1000)); // 每天频率
    
    return {
      frequency,
      trend: frequency > 2 ? 'increasing' : frequency < 0.5 ? 'decreasing' : 'stable',
      significance: Math.min(frequency / 5, 1), // 简化的显著性
      time_span_days: timeSpan / (24 * 60 * 60 * 1000)
    };
  }

  private generateSentimentReport(startTime: Date, endTime: Date, filters: any): any {
    // 模拟生成情感报告
    return {
      report_type: 'sentiment',
      time_range: { start: startTime, end: endTime },
      summary: {
        total_analyzed: 100,
        positive_percentage: 45,
        negative_percentage: 25,
        neutral_percentage: 30,
        average_sentiment: 0.2
      },
      trends: [
        { period: 'morning', sentiment: 0.15 },
        { period: 'afternoon', sentiment: 0.25 },
        { period: 'evening', sentiment: 0.18 }
      ],
      generated_at: new Date().toISOString()
    };
  }

  private generateRiskReport(startTime: Date, endTime: Date, filters: any): any {
    const risks = this.riskAlerts.filter(risk => 
      risk.created_at >= startTime && risk.created_at <= endTime
    );
    
    return {
      report_type: 'risk',
      time_range: { start: startTime, end: endTime },
      summary: {
        total_risks: risks.length,
        high_severity: risks.filter(r => r.severity === 'high').length,
        medium_severity: risks.filter(r => r.severity === 'medium').length,
        low_severity: risks.filter(r => r.severity === 'low').length
      },
      top_risk_types: this.getTopRiskTypes(risks),
      generated_at: new Date().toISOString()
    };
  }

  private generateTrendReport(startTime: Date, endTime: Date, filters: any): any {
    return {
      report_type: 'trend',
      time_range: { start: startTime, end: endTime },
      summary: {
        emerging_trends: 3,
        declining_trends: 1,
        stable_trends: 5
      },
      trends: [
        { entity: 'Tech Sector', trend: 'positive', confidence: 0.8 },
        { entity: 'Market Volatility', trend: 'increasing', confidence: 0.7 }
      ],
      generated_at: new Date().toISOString()
    };
  }

  private generateSummaryReport(startTime: Date, endTime: Date, filters: any): any {
    return {
      report_type: 'summary',
      time_range: { start: startTime, end: endTime },
      sentiment: this.generateSentimentReport(startTime, endTime, filters).summary,
      risks: this.generateRiskReport(startTime, endTime, filters).summary,
      trends: this.generateTrendReport(startTime, endTime, filters).summary,
      generated_at: new Date().toISOString()
    };
  }

  private updateAnalysisStats(operation: string, analysisTime: number, success: boolean): void {
    const stats = this.analysisStats.get(operation) || {
      total_count: 0,
      success_count: 0,
      error_count: 0,
      total_analysis_time: 0,
      average_analysis_time: 0,
      analysis_times: []
    };
    
    stats.total_count++;
    if (success) {
      stats.success_count++;
    } else {
      stats.error_count++;
    }
    
    stats.total_analysis_time += analysisTime;
    stats.analysis_times = stats.analysis_times || [];
    stats.analysis_times.push(analysisTime);
    
    // 保持最近100次的分析时间
    if (stats.analysis_times.length > 100) {
      stats.analysis_times = stats.analysis_times.slice(-100);
    }
    
    stats.average_analysis_time = stats.total_analysis_time / stats.total_count;
    
    this.analysisStats.set(operation, stats);
  }

  private getTotalAnalyzedCount(): number {
    let total = 0;
    for (const stats of this.analysisStats.values()) {
      total += stats.total_count || 0;
    }
    return total;
  }

  private getAverageAnalysisTime(): number {
    let totalTime = 0;
    let totalCount = 0;
    
    for (const stats of this.analysisStats.values()) {
      totalTime += stats.total_analysis_time || 0;
      totalCount += stats.total_count || 0;
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  private getSuccessRate(): number {
    let totalSuccess = 0;
    let totalCount = 0;
    
    for (const stats of this.analysisStats.values()) {
      totalSuccess += stats.success_count || 0;
      totalCount += stats.total_count || 0;
    }
    
    return totalCount > 0 ? totalSuccess / totalCount : 0;
  }

  private getRiskAlertsBySeverity(): any {
    const severityCount = { critical: 0, high: 0, medium: 0, low: 0 };
    
    for (const alert of this.riskAlerts) {
      severityCount[alert.severity]++;
    }
    
    return severityCount;
  }

  private getRiskAlertsByType(): any {
    const typeCount: any = {};
    
    for (const alert of this.riskAlerts) {
      typeCount[alert.risk_type] = (typeCount[alert.risk_type] || 0) + 1;
    }
    
    return typeCount;
  }

  private getSentimentStats(): any {
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;
    
    for (const history of this.sentimentHistory.values()) {
      for (const sentiment of history) {
        if (sentiment.label === 'positive') totalPositive++;
        else if (sentiment.label === 'negative') totalNegative++;
        else totalNeutral++;
      }
    }
    
    const total = totalPositive + totalNegative + totalNeutral;
    
    return {
      total_analyses: total,
      positive_percentage: total > 0 ? (totalPositive / total) * 100 : 0,
      negative_percentage: total > 0 ? (totalNegative / total) * 100 : 0,
      neutral_percentage: total > 0 ? (totalNeutral / total) * 100 : 0
    };
  }

  private getTopRiskTypes(risks: RiskAlert[]): any[] {
    const typeCount: any = {};
    
    for (const risk of risks) {
      typeCount[risk.risk_type] = (typeCount[risk.risk_type] || 0) + 1;
    }
    
    return Object.entries(typeCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
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
    this.logger.info(`Starting Analyzer Agent on port ${this.config.port}`);
    
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
    
    this.logger.info('Analyzer Agent started successfully');
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping Analyzer Agent');
    
    // 停止任务调度器
    this.taskScheduler.stop();
    
    // 停止通信服务
    this.communication.stop();
    
    this.logger.info('Analyzer Agent stopped');
  }

  public getStatus(): any {
    return {
      agent_name: this.config.agent_name,
      status: 'running',
      port: this.config.port,
      active_tasks: this.activeTasks.size,
      queue_size: this.analysisQueue.length,
      total_analyzed: this.getTotalAnalyzedCount(),
      risk_alerts_count: this.riskAlerts.length,
      capabilities: this.config.capabilities,
      uptime: Date.now()
    };
  }
}