// 共享工具函数
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, AgentStatus } from '../types';

export class MessageUtils {
  static createMessage(
    from: string,
    to: string,
    type: 'request' | 'response' | 'event',
    action: string,
    data: any
  ): AgentMessage {
    return {
      from,
      to,
      type,
      action,
      data,
      timestamp: Date.now(),
      message_id: uuidv4()
    };
  }

  static createResponse(
    originalMessage: AgentMessage,
    data: any,
    isError = false
  ): AgentMessage {
    return {
      from: originalMessage.to,
      to: originalMessage.from,
      type: 'response',
      action: originalMessage.action,
      data: isError ? { error: data } : data,
      timestamp: Date.now(),
      message_id: uuidv4()
    };
  }
}

export class AgentUtils {
  static generateAgentId(agentName: string): string {
    return `${agentName}-${uuidv4().slice(0, 8)}`;
  }

  static createAgentStatus(
    agentName: string,
    port: number,
    capabilities: string[],
    status: 'running' | 'stopped' | 'error' = 'running'
  ): AgentStatus {
    return {
      agent_name: agentName,
      status,
      port,
      uptime: 0,
      last_heartbeat: Date.now(),
      capabilities
    };
  }

  static parseCapabilities(capabilities: string[]): Record<string, boolean> {
    return capabilities.reduce((acc, capability) => {
      acc[capability] = true;
      return acc;
    }, {} as Record<string, boolean>);
  }
}

export class TimeUtils {
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  static parseISODate(dateString: string): Date {
    return new Date(dateString);
  }

  static getDelay(startTime: number): number {
    return Date.now() - startTime;
  }
}

export class ValidationUtils {
  static isValidPort(port: number): boolean {
    return port > 0 && port <= 65535;
  }

  static isValidAgentName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export class LoggerUtils {
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  static formatLog(level: string, message: string, meta?: any): string {
    const timestamp = this.getTimestamp();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  static log(level: string, message: string, meta?: any): void {
    console.log(this.formatLog(level, message, meta));
  }

  static info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  static error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  static warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  static debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }
}