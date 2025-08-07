import { AgentConfig } from '../shared/types';
export declare class CoordinatorAgent {
    private config;
    private communication;
    private connectedAgents;
    private taskQueue;
    private activeTasks;
    private healthCheckInterval;
    constructor(config: AgentConfig);
    private setupMessageHandlers;
    private handleHealthCheck;
    private handleHeartbeat;
    private handleTaskSubmission;
    private handleTaskCompletion;
    private handleTaskFailure;
    private handleAgentRegistration;
    private handleGetAgentStatus;
    private handleGetTaskStatus;
    private sendMessageToAgent;
    private assignTasks;
    private findBestAgentForTask;
    private getAgentLoad;
    private assignTaskToAgent;
    private startHealthCheck;
    private checkAgentHealth;
    private reassignAgentTasks;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): any;
}
//# sourceMappingURL=index.d.ts.map