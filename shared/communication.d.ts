import { AgentStatus } from '../types';
export declare class CommunicationProtocol {
    private app;
    private agentName;
    private port;
    private messageHandlers;
    private connectedAgents;
    constructor(agentName: string, port: number);
    private setupMiddleware;
    private setupRoutes;
    private handleMessage;
    registerHandler(action: string, handler: Function): void;
    sendMessage(targetAgent: string, action: string, data: any): Promise<any>;
    broadcastMessage(action: string, data: any): Promise<any[]>;
    registerToCoordinator(agentStatus: AgentStatus): Promise<void>;
    getConnectedAgents(): AgentStatus[];
    isAgentConnected(agentName: string): boolean;
    start(): void;
    stop(): void;
}
//# sourceMappingURL=communication.d.ts.map