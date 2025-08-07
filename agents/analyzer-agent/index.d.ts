import { AgentConfig } from '../../shared/types';
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
export declare class AnalyzerAgent {
    private config;
    private communication;
    private taskScheduler;
    private logger;
    private analysisQueue;
    private activeTasks;
    private analysisStats;
    private riskAlerts;
    private sentimentHistory;
    private trendData;
    constructor(config: AnalyzerConfig);
    private setupMessageHandlers;
    private handleHealthCheck;
    private handleHeartbeat;
    private handleAnalyzeSentiment;
    private handleDetectRisks;
    private handleAnalyzeTrends;
    private handleGenerateReport;
    private handleExecuteTask;
    private handleGetAnalysisStatus;
    private handleGetStats;
    private handleGetRiskAlerts;
    private handleBatchAnalyze;
    private analyzeNewsItem;
    private analyzeSentiment;
    private detectRisks;
    private analyzeTrends;
    private generateReport;
    private executeSentimentAnalysis;
    private executeRiskDetection;
    private executeTrendAnalysis;
    private saveSentimentHistory;
    private groupNewsByEntities;
    private calculateSentimentTrend;
    private calculateFrequencyTrend;
    private generateSentimentReport;
    private generateRiskReport;
    private generateTrendReport;
    private generateSummaryReport;
    private updateAnalysisStats;
    private getTotalAnalyzedCount;
    private getAverageAnalysisTime;
    private getSuccessRate;
    private getRiskAlertsBySeverity;
    private getRiskAlertsByType;
    private getSentimentStats;
    private getTopRiskTypes;
    private chunkArray;
    private sendResponse;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): any;
}
//# sourceMappingURL=index.d.ts.map