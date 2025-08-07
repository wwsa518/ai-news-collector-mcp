import { AgentConfig } from '../../shared/types';
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
export declare class ProcessorAgent {
    private config;
    private communication;
    private taskScheduler;
    private logger;
    private processingQueue;
    private activeTasks;
    private processingStats;
    constructor(config: ProcessorConfig);
    private setupMessageHandlers;
    private handleHealthCheck;
    private handleHeartbeat;
    private handleProcessNews;
    private handleExtractEntities;
    private handleExtractEvents;
    private handleCleanContent;
    private handleExecuteTask;
    private handleGetProcessingStatus;
    private handleGetStats;
    private handleBatchProcess;
    private processNewsItem;
    private cleanContent;
    private extractEntities;
    private extractEvents;
    private analyzeSentiment;
    private generateMockEntities;
    private generateMockEvents;
    private executeProcessing;
    private executeEntityExtraction;
    private executeEventExtraction;
    private updateProcessingStats;
    private getTotalProcessedCount;
    private getAverageProcessingTime;
    private getSuccessRate;
    private chunkArray;
    private sendResponse;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): any;
}
//# sourceMappingURL=index.d.ts.map