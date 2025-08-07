"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessorAgent = void 0;
const communication_1 = require("../../shared/communication");
const utils_1 = require("../../shared/utils");
const task_1 = require("../../src/task");
class ProcessorAgent {
    config;
    communication;
    taskScheduler;
    logger = utils_1.LoggerUtils;
    processingQueue = [];
    activeTasks = new Map();
    processingStats = new Map();
    constructor(config) {
        this.config = config;
        this.communication = new communication_1.CommunicationProtocol(config.agent_name, config.port);
        this.taskScheduler = new task_1.TaskScheduler({
            max_concurrent_tasks: config.max_concurrent_tasks,
            default_timeout: config.processing_timeout,
            max_retries: 3,
            retry_delay: 2000,
            cleanup_interval: 3600000,
            task_retention_days: 7
        });
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
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
    async handleHealthCheck(message) {
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
    async handleHeartbeat(message) {
        const agentStatus = utils_1.AgentUtils.createAgentStatus(this.config.agent_name, this.config.port, this.config.capabilities);
        agentStatus.uptime = Date.now();
        await this.sendResponse(message, agentStatus);
    }
    async handleProcessNews(message) {
        const { news_items } = message.data;
        try {
            const results = [];
            for (const newsItem of news_items) {
                const processed = await this.processNewsItem(newsItem);
                results.push(processed);
            }
            await this.sendResponse(message, {
                success: true,
                processed_count: results.length,
                results
            });
        }
        catch (error) {
            this.logger.error('Failed to process news', { error });
            await this.sendResponse(message, { success: false, error: error.message });
        }
    }
    async handleExtractEntities(message) {
        const { text, news_id } = message.data;
        try {
            const entities = await this.extractEntities(text, news_id);
            await this.sendResponse(message, {
                success: true,
                entities,
                entity_count: entities.length
            });
        }
        catch (error) {
            this.logger.error('Failed to extract entities', { news_id, error });
            await this.sendResponse(message, { success: false, error: error.message });
        }
    }
    async handleExtractEvents(message) {
        const { text, news_id } = message.data;
        try {
            const events = await this.extractEvents(text, news_id);
            await this.sendResponse(message, {
                success: true,
                events,
                event_count: events.length
            });
        }
        catch (error) {
            this.logger.error('Failed to extract events', { news_id, error });
            await this.sendResponse(message, { success: false, error: error.message });
        }
    }
    async handleCleanContent(message) {
        const { content, news_id } = message.data;
        try {
            const cleaned = await this.cleanContent(content);
            await this.sendResponse(message, {
                success: true,
                cleaned_content: cleaned,
                original_length: content.length,
                cleaned_length: cleaned.length
            });
        }
        catch (error) {
            this.logger.error('Failed to clean content', { news_id, error });
            await this.sendResponse(message, { success: false, error: error.message });
        }
    }
    async handleExecuteTask(message) {
        const task = message.data;
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
        }
        catch (error) {
            this.logger.error('Task execution failed', { task_id: task.id, error });
            await this.sendResponse(message, { success: false, error: error.message });
        }
    }
    async handleGetProcessingStatus(message) {
        const status = {
            active_tasks: Array.from(this.activeTasks.values()),
            queue_size: this.processingQueue.length,
            processing_stats: Array.from(this.processingStats.entries())
        };
        await this.sendResponse(message, status);
    }
    async handleGetStats(message) {
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
    async handleBatchProcess(message) {
        const { news_items, batch_size = 10 } = message.data;
        try {
            const results = [];
            const batches = this.chunkArray(news_items, batch_size);
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                this.logger.info(`Processing batch ${i + 1}/${batches.length}`, {
                    batch_size: batch.length
                });
                const batchResults = await Promise.all(batch.map(item => this.processNewsItem(item)));
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
        }
        catch (error) {
            this.logger.error('Batch processing failed', { error });
            await this.sendResponse(message, { success: false, error: error.message });
        }
    }
    async processNewsItem(newsItem) {
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
            const processedNews = {
                ...newsItem,
                cleaned_content: cleanedContent,
                entities,
                events,
                sentiment
            };
            // 更新统计信息
            this.updateProcessingStats('process_news', Date.now() - startTime, true);
            return processedNews;
        }
        catch (error) {
            this.updateProcessingStats('process_news', Date.now() - startTime, false);
            throw error;
        }
    }
    async cleanContent(content) {
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
    async extractEntities(text, newsId) {
        const entities = [];
        if (!this.config.entity_recognition.enable_stock_codes &&
            !this.config.entity_recognition.enable_companies &&
            !this.config.entity_recognition.enable_persons &&
            !this.config.entity_recognition.enable_locations) {
            return entities;
        }
        // 模拟实体提取（实际应该调用NLP服务）
        const mockEntities = this.generateMockEntities(text, newsId);
        // 过滤低置信度实体
        return mockEntities.filter(entity => entity.confidence >= this.config.entity_recognition.confidence_threshold);
    }
    async extractEvents(text, newsId) {
        if (!this.config.event_extraction.enable_triple_extraction) {
            return [];
        }
        // 模拟事件提取（实际应该调用NLP服务）
        const mockEvents = this.generateMockEvents(text, newsId);
        // 过滤低置信度事件
        return mockEvents.filter(event => event.confidence >= this.config.event_extraction.confidence_threshold);
    }
    async analyzeSentiment(text) {
        // 模拟情感分析（实际应该调用AI服务）
        const score = Math.random() * 2 - 1; // -1 to 1
        let label;
        if (score > 0.2)
            label = 'positive';
        else if (score < -0.2)
            label = 'negative';
        else
            label = 'neutral';
        return {
            score,
            confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1
            label
        };
    }
    generateMockEntities(text, newsId) {
        const entities = [];
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
    generateMockEvents(text, newsId) {
        const events = [];
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
    async executeProcessing(task) {
        const { news_item } = task.data;
        const processed = await this.processNewsItem(news_item);
        return {
            task_id: task.id,
            processed_news: processed,
            processing_time: Date.now() - task.created_at
        };
    }
    async executeEntityExtraction(task) {
        const { text, news_id } = task.data;
        const entities = await this.extractEntities(text, news_id);
        return {
            task_id: task.id,
            entities,
            entity_count: entities.length
        };
    }
    async executeEventExtraction(task) {
        const { text, news_id } = task.data;
        const events = await this.extractEvents(text, news_id);
        return {
            task_id: task.id,
            events,
            event_count: events.length
        };
    }
    updateProcessingStats(operation, processingTime, success) {
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
        }
        else {
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
    getTotalProcessedCount() {
        let total = 0;
        for (const stats of this.processingStats.values()) {
            total += stats.total_count || 0;
        }
        return total;
    }
    getAverageProcessingTime() {
        let totalTime = 0;
        let totalCount = 0;
        for (const stats of this.processingStats.values()) {
            totalTime += stats.total_processing_time || 0;
            totalCount += stats.total_count || 0;
        }
        return totalCount > 0 ? totalTime / totalCount : 0;
    }
    getSuccessRate() {
        let totalSuccess = 0;
        let totalCount = 0;
        for (const stats of this.processingStats.values()) {
            totalSuccess += stats.success_count || 0;
            totalCount += stats.total_count || 0;
        }
        return totalCount > 0 ? totalSuccess / totalCount : 0;
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    async sendResponse(originalMessage, data) {
        try {
            await this.communication.sendMessage(originalMessage.from, 'response', {
                action: originalMessage.action,
                data,
                timestamp: Date.now()
            });
        }
        catch (error) {
            this.logger.error('Failed to send response', { error });
        }
    }
    async start() {
        this.logger.info(`Starting Processor Agent on port ${this.config.port}`);
        // 启动通信服务
        this.communication.start();
        // 启动任务调度器
        this.taskScheduler.start();
        // 注册到协调代理
        const selfStatus = utils_1.AgentUtils.createAgentStatus(this.config.agent_name, this.config.port, this.config.capabilities);
        await this.communication.registerToCoordinator(selfStatus);
        this.logger.info('Processor Agent started successfully');
    }
    async stop() {
        this.logger.info('Stopping Processor Agent');
        // 停止任务调度器
        this.taskScheduler.stop();
        // 停止通信服务
        this.communication.stop();
        this.logger.info('Processor Agent stopped');
    }
    getStatus() {
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
exports.ProcessorAgent = ProcessorAgent;
//# sourceMappingURL=index.js.map