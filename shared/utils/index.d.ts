import { AgentMessage, AgentStatus } from '../types';
export declare class MessageUtils {
    static createMessage(from: string, to: string, type: 'request' | 'response' | 'event', action: string, data: any): AgentMessage;
    static createResponse(originalMessage: AgentMessage, data: any, isError?: boolean): AgentMessage;
}
export declare class AgentUtils {
    static generateAgentId(agentName: string): string;
    static createAgentStatus(agentName: string, port: number, capabilities: string[], status?: 'running' | 'stopped' | 'error'): AgentStatus;
    static parseCapabilities(capabilities: string[]): Record<string, boolean>;
}
export declare class TimeUtils {
    static formatTimestamp(timestamp: number): string;
    static parseISODate(dateString: string): Date;
    static getDelay(startTime: number): number;
}
export declare class ValidationUtils {
    static isValidPort(port: number): boolean;
    static isValidAgentName(name: string): boolean;
    static isValidUrl(url: string): boolean;
}
export declare class LoggerUtils {
    private static getTimestamp;
    static formatLog(level: string, message: string, meta?: any): string;
    static log(level: string, message: string, meta?: any): void;
    static info(message: string, meta?: any): void;
    static error(message: string, meta?: any): void;
    static warn(message: string, meta?: any): void;
    static debug(message: string, meta?: any): void;
}
//# sourceMappingURL=index.d.ts.map