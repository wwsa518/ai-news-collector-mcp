import { AgentConfig } from '../../shared/types';
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
export declare class CollectorAgent {
    private config;
    private communication;
    private taskScheduler;
    private logger;
    private activeSources;
    private collectionStats;
    private rateLimiter;
    constructor(config: CollectorConfig);
    private setupMessageHandlers;
    private handleHealthCheck;
    private handleHeartbeat;
    private handleStartCollection;
    private handleStopCollection;
    private handleGetCollectionStatus;
    private handleExecuteTask;
    private handleAddSource;
    private handleRemoveSource;
    private handleGetStats;
    private executeCollection;
    private simulateCollection;
    private checkRateLimit;
    private recordRateLimit;
    private getRateLimitStatus;
    private updateCollectionStats;
    private incrementErrorCount;
    private getTotalCollectedCount;
    private sendResponse;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): any;
}
//# sourceMappingURL=index.d.ts.map