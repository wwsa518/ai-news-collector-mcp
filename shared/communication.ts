// 代理间通信协议
import express from 'express';
import { AgentMessage, AgentStatus } from './types';
import { AGENT_PORTS, MESSAGE_TYPES, AGENT_ACTIONS } from './config';

export class CommunicationProtocol {
  private app: express.Application;
  private agentName: string;
  private port: number;
  private messageHandlers: Map<string, Function> = new Map();
  private connectedAgents: Map<string, AgentStatus> = new Map();

  constructor(agentName: string, port: number) {
    this.agentName = agentName;
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS 支持
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // 消息接收端点
    this.app.post('/message', (req, res) => {
      const message: AgentMessage = req.body;
      this.handleMessage(message);
      res.json({ success: true, message_id: message.message_id });
    });

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        agent: this.agentName,
        port: this.port,
        timestamp: Date.now(),
        connected_agents: Array.from(this.connectedAgents.keys())
      });
    });

    // 代理注册端点
    this.app.post('/register', (req, res) => {
      const agentStatus: AgentStatus = req.body;
      this.connectedAgents.set(agentStatus.agent_name, agentStatus);
      res.json({ success: true });
    });

    // 代理发现端点
    this.app.get('/agents', (req, res) => {
      res.json({ agents: Array.from(this.connectedAgents.values()) });
    });
  }

  private handleMessage(message: AgentMessage): void {
    const handler = this.messageHandlers.get(message.action);
    if (handler) {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error handling message ${message.action}:`, error);
      }
    } else {
      console.warn(`No handler found for message action: ${message.action}`);
    }
  }

  // 注册消息处理器
  public registerHandler(action: string, handler: Function): void {
    this.messageHandlers.set(action, handler);
  }

  // 发送消息到其他代理
  public async sendMessage(
    targetAgent: string,
    action: string,
    data: any
  ): Promise<any> {
    const targetPort = AGENT_PORTS[targetAgent as keyof typeof AGENT_PORTS];
    if (!targetPort) {
      throw new Error(`Unknown target agent: ${targetAgent}`);
    }

    const message = {
      from: this.agentName,
      to: targetAgent,
      type: MESSAGE_TYPES.REQUEST,
      action,
      data,
      timestamp: Date.now(),
      message_id: `${this.agentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    try {
      const response = await fetch(`http://localhost:${targetPort}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to send message to ${targetAgent}:`, error);
      throw error;
    }
  }

  // 广播消息到所有代理
  public async broadcastMessage(action: string, data: any): Promise<any[]> {
    const promises = Array.from(this.connectedAgents.keys()).map(agentName => {
      if (agentName !== this.agentName) {
        return this.sendMessage(agentName, action, data).catch(error => {
          console.error(`Failed to broadcast to ${agentName}:`, error);
          return null;
        });
      }
      return Promise.resolve(null);
    });

    const results = await Promise.all(promises);
    return results.filter(result => result !== null);
  }

  // 注册到协调代理
  public async registerToCoordinator(agentStatus: AgentStatus): Promise<void> {
    try {
      await fetch(`http://localhost:${AGENT_PORTS.coordinator}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentStatus)
      });
    } catch (error) {
      console.error('Failed to register to coordinator:', error);
    }
  }

  // 获取连接的代理列表
  public getConnectedAgents(): AgentStatus[] {
    return Array.from(this.connectedAgents.values());
  }

  // 检查代理是否连接
  public isAgentConnected(agentName: string): boolean {
    return this.connectedAgents.has(agentName);
  }

  // 启动通信服务
  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`${this.agentName} communication server started on port ${this.port}`);
    });
  }

  // 停止通信服务
  public stop(): void {
    // 这里可以实现优雅停机逻辑
    console.log(`${this.agentName} communication server stopping...`);
  }
}