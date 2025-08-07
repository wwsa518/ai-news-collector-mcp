// 增强的通信协议
import express, { Request, Response, NextFunction } from 'express';
import { AgentMessage, AgentStatus } from '../../shared/types';
import { AGENT_PORTS, MESSAGE_TYPES, AGENT_ACTIONS } from '../../shared/config';
import { LoggerUtils, ValidationUtils } from '../../shared/utils';

export interface ConnectionConfig {
  max_connections: number;
  connection_timeout: number;
  request_timeout: number;
  keep_alive: boolean;
  enable_compression: boolean;
  enable_cors: boolean;
  rate_limit: {
    enabled: boolean;
    max_requests: number;
    time_window: number;
  };
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failure_threshold: number;
  recovery_timeout: number;
  monitoring_period: number;
}

export class EnhancedCommunicationProtocol {
  private app: express.Application;
  private agentName: string;
  private port: number;
  private config: ConnectionConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;
  private messageHandlers: Map<string, Function> = new Map();
  private connectedAgents: Map<string, AgentStatus> = new Map();
  private connectionPool: Map<string, any> = new Map();
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private rateLimiter: Map<string, number[]> = new Map();
  private logger = LoggerUtils;

  constructor(
    agentName: string, 
    port: number, 
    connectionConfig?: Partial<ConnectionConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.agentName = agentName;
    this.port = port;
    
    // 默认连接配置
    this.config = {
      max_connections: 100,
      connection_timeout: 30000,
      request_timeout: 10000,
      keep_alive: true,
      enable_compression: true,
      enable_cors: true,
      rate_limit: {
        enabled: true,
        max_requests: 100,
        time_window: 60000
      },
      ...connectionConfig
    };

    // 默认熔断器配置
    this.circuitBreakerConfig = {
      enabled: true,
      failure_threshold: 5,
      recovery_timeout: 30000,
      monitoring_period: 60000,
      ...circuitBreakerConfig
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeCircuitBreaker();
  }

  private setupMiddleware(): void {
    // 基础中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 请求日志
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.debug('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // 压缩
    if (this.config.enable_compression) {
      const compression = require('compression');
      this.app.use(compression());
    }

    // CORS
    if (this.config.enable_cors) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
        res.header('Access-Control-Max-Age', '86400');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // 限流
    if (this.config.rate_limit.enabled) {
      this.app.use(this.rateLimitMiddleware.bind(this));
    }

    // 请求ID
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || this.generateRequestId();
      next();
    });

    // 错误处理中间件
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Middleware error', { error: err.message, stack: err.stack });
      res.status(500).json({
        error: 'Internal Server Error',
        request_id: req.headers['x-request-id']
      });
    });
  }

  private setupRoutes(): void {
    // 消息接收端点
    this.app.post('/message', this.validateMessage.bind(this), this.handleMessage.bind(this));

    // 批量消息端点
    this.app.post('/messages/batch', this.validateBatchMessages.bind(this), this.handleBatchMessages.bind(this));

    // 健康检查端点
    this.app.get('/health', this.handleHealthCheck.bind(this));
    this.app.get('/health/detailed', this.handleDetailedHealthCheck.bind(this));

    // 代理注册端点
    this.app.post('/register', this.handleAgentRegistration.bind(this));
    this.app.put('/register/:agentName', this.handleAgentUpdate.bind(this));
    this.app.delete('/register/:agentName', this.handleAgentUnregistration.bind(this));

    // 代理发现端点
    this.app.get('/agents', this.handleGetAgents.bind(this));
    this.app.get('/agents/:agentName', this.handleGetAgent.bind(this));

    // 连接池管理
    this.app.get('/connections', this.handleGetConnections.bind(this));
    this.app.delete('/connections/:connectionId', this.handleCloseConnection.bind(this));

    // 统计信息
    this.app.get('/stats', this.handleGetStats.bind(this));
    this.app.get('/stats/messages', this.handleMessageStats.bind(this));

    // 测试端点
    this.app.post('/test/echo', this.handleEchoTest.bind(this));
    this.app.post('/test/load', this.handleLoadTest.bind(this));
  }

  private initializeCircuitBreaker(): void {
    if (!this.circuitBreakerConfig.enabled) return;

    // 初始化熔断器状态
    setInterval(() => {
      this.checkCircuitBreakerRecovery();
    }, this.circuitBreakerConfig.monitoring_period);
  }

  private validateMessage(req: Request, res: Response, next: NextFunction): void {
    const message: AgentMessage = req.body;
    
    // 验证必需字段
    const requiredFields = ['from', 'to', 'type', 'action', 'timestamp', 'message_id'];
    for (const field of requiredFields) {
      if (!message[field]) {
        return res.status(400).json({
          error: `Missing required field: ${field}`,
          request_id: req.headers['x-request-id']
        });
      }
    }

    // 验证消息类型
    if (!Object.values(MESSAGE_TYPES).includes(message.type)) {
      return res.status(400).json({
        error: `Invalid message type: ${message.type}`,
        request_id: req.headers['x-request-id']
      });
    }

    // 验证时间戳（防止重放攻击）
    const now = Date.now();
    if (Math.abs(now - message.timestamp) > 300000) { // 5分钟
      return res.status(400).json({
        error: 'Message timestamp too old or too new',
        request_id: req.headers['x-request-id']
      });
    }

    next();
  }

  private validateBatchMessages(req: Request, res: Response, next: NextFunction): void {
    const messages: AgentMessage[] = req.body;
    
    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Messages must be an array',
        request_id: req.headers['x-request-id']
      });
    }

    if (messages.length > 100) {
      return res.status(400).json({
        error: 'Batch size cannot exceed 100 messages',
        request_id: req.headers['x-request-id']
      });
    }

    // 验证每个消息
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const requiredFields = ['from', 'to', 'type', 'action', 'timestamp', 'message_id'];
      
      for (const field of requiredFields) {
        if (!message[field]) {
          return res.status(400).json({
            error: `Message ${i} missing required field: ${field}`,
            request_id: req.headers['x-request-id']
          });
        }
      }
    }

    next();
  }

  private async handleMessage(req: Request, res: Response): Promise<void> {
    const message: AgentMessage = req.body;
    const requestId = req.headers['x-request-id'];

    try {
      // 检查熔断器
      if (this.isCircuitBreakerOpen(message.from)) {
        throw new Error('Circuit breaker is open for agent: ' + message.from);
      }

      // 处理消息
      this.handleMessageInternal(message);

      res.json({
        success: true,
        message_id: message.message_id,
        request_id: requestId,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Failed to handle message', { 
        message_id: message.message_id, 
        error: error.message,
        request_id: requestId
      });

      // 更新熔断器状态
      this.updateCircuitBreaker(message.from, false);

      res.status(500).json({
        success: false,
        error: error.message,
        message_id: message.message_id,
        request_id: requestId
      });
    }
  }

  private async handleBatchMessages(req: Request, res: Response): Promise<void> {
    const messages: AgentMessage[] = req.body;
    const requestId = req.headers['x-request-id'];
    
    const results: any[] = [];
    
    for (const message of messages) {
      try {
        // 检查熔断器
        if (this.isCircuitBreakerOpen(message.from)) {
          results.push({
            message_id: message.message_id,
            success: false,
            error: 'Circuit breaker is open'
          });
          continue;
        }

        // 处理消息
        this.handleMessageInternal(message);
        this.updateCircuitBreaker(message.from, true);

        results.push({
          message_id: message.message_id,
          success: true
        });
      } catch (error) {
        this.logger.error('Failed to handle batch message', { 
          message_id: message.message_id, 
          error: error.message 
        });

        this.updateCircuitBreaker(message.from, false);

        results.push({
          message_id: message.message_id,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results,
      total_messages: messages.length,
      successful_messages: results.filter(r => r.success).length,
      request_id: requestId,
      timestamp: Date.now()
    });
  }

  private handleMessageInternal(message: AgentMessage): void {
    const handler = this.messageHandlers.get(message.action);
    if (handler) {
      try {
        handler(message);
      } catch (error) {
        this.logger.error(`Error handling message ${message.action}:`, error);
        throw error;
      }
    } else {
      this.logger.warn(`No handler found for message action: ${message.action}`);
    }
  }

  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      agent: this.agentName,
      port: this.port,
      timestamp: Date.now(),
      uptime: Date.now(),
      connected_agents: this.connectedAgents.size,
      active_connections: this.connectionPool.size,
      circuit_breaker_status: this.getCircuitBreakerStatus()
    });
  }

  private async handleDetailedHealthCheck(req: Request, res: Response): Promise<void> {
    const health = {
      status: 'healthy',
      agent: this.agentName,
      port: this.port,
      timestamp: Date.now(),
      uptime: Date.now(),
      connected_agents: Array.from(this.connectedAgents.values()),
      active_connections: Array.from(this.connectionPool.keys()),
      circuit_breaker_status: this.getCircuitBreakerStatus(),
      rate_limit_status: this.getRateLimitStatus(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage()
    };

    res.json(health);
  }

  private async handleAgentRegistration(req: Request, res: Response): Promise<void> {
    const agentStatus: AgentStatus = req.body;
    
    try {
      // 验证代理状态
      if (!this.validateAgentStatus(agentStatus)) {
        return res.status(400).json({ error: 'Invalid agent status' });
      }

      this.connectedAgents.set(agentStatus.agent_name, agentStatus);
      this.initializeCircuitBreakerForAgent(agentStatus.agent_name);

      this.logger.info(`Agent registered: ${agentStatus.agent_name}`, {
        port: agentStatus.port,
        capabilities: agentStatus.capabilities
      });

      res.json({ success: true });
    } catch (error) {
      this.logger.error('Failed to register agent', { error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async handleAgentUpdate(req: Request, res: Response): Promise<void> {
    const agentName = req.params.agentName;
    const updates = req.body;

    try {
      const currentStatus = this.connectedAgents.get(agentName);
      if (!currentStatus) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const updatedStatus = { ...currentStatus, ...updates };
      this.connectedAgents.set(agentName, updatedStatus);

      this.logger.info(`Agent updated: ${agentName}`, updates);

      res.json({ success: true, agent: updatedStatus });
    } catch (error) {
      this.logger.error('Failed to update agent', { agentName, error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async handleAgentUnregistration(req: Request, res: Response): Promise<void> {
    const agentName = req.params.agentName;

    try {
      const deleted = this.connectedAgents.delete(agentName);
      this.circuitBreaker.delete(agentName);
      this.rateLimiter.delete(agentName);

      this.logger.info(`Agent unregistered: ${agentName}`, { deleted });

      res.json({ success: true, deleted });
    } catch (error) {
      this.logger.error('Failed to unregister agent', { agentName, error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async handleGetAgents(req: Request, res: Response): Promise<void> {
    const agents = Array.from(this.connectedAgents.values());
    res.json({ agents, count: agents.length });
  }

  private async handleGetAgent(req: Request, res: Response): Promise<void> {
    const agentName = req.params.agentName;
    const agent = this.connectedAgents.get(agentName);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent });
  }

  private async handleGetConnections(req: Request, res: Response): Promise<void> {
    const connections = Array.from(this.connectionPool.entries()).map(([id, conn]) => ({
      id,
      ...conn
    }));

    res.json({ connections, count: connections.length });
  }

  private async handleCloseConnection(req: Request, res: Response): Promise<void> {
    const connectionId = req.params.connectionId;

    try {
      const deleted = this.connectionPool.delete(connectionId);
      
      if (deleted) {
        // 关闭连接
        const conn = this.connectionPool.get(connectionId);
        if (conn && conn.close) {
          conn.close();
        }
      }

      res.json({ success: true, deleted });
    } catch (error) {
      this.logger.error('Failed to close connection', { connectionId, error });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async handleGetStats(req: Request, res: Response): Promise<void> {
    const stats = {
      agent: this.agentName,
      port: this.port,
      uptime: Date.now(),
      connected_agents: this.connectedAgents.size,
      active_connections: this.connectionPool.size,
      message_handlers: this.messageHandlers.size,
      circuit_breaker_states: this.getCircuitBreakerStatus(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage()
    };

    res.json(stats);
  }

  private async handleMessageStats(req: Request, res: Response): Promise<void> {
    // 这里应该实现消息统计
    res.json({
      total_messages: 0,
      successful_messages: 0,
      failed_messages: 0,
      average_processing_time: 0
    });
  }

  private async handleEchoTest(req: Request, res: Response): Promise<void> {
    const { message, delay = 0 } = req.body;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    res.json({
      echo: message,
      timestamp: Date.now(),
      agent: this.agentName,
      port: this.port
    });
  }

  private async handleLoadTest(req: Request, res: Response): Promise<void> {
    const { iterations = 100, concurrent = 10 } = req.body;

    const startTime = Date.now();
    const results: any[] = [];

    const runIteration = async (index: number): Promise<any> => {
      const iterStart = Date.now();
      try {
        // 模拟负载测试
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        return {
          iteration: index,
          success: true,
          duration: Date.now() - iterStart
        };
      } catch (error) {
        return {
          iteration: index,
          success: false,
          error: error.message,
          duration: Date.now() - iterStart
        };
      }
    };

    const promises = [];
    for (let i = 0; i < concurrent; i++) {
      for (let j = 0; j < Math.ceil(iterations / concurrent); j++) {
        const index = i * Math.ceil(iterations / concurrent) + j;
        if (index < iterations) {
          promises.push(runIteration(index));
        }
      }
    }

    const allResults = await Promise.all(promises);
    const successful = allResults.filter(r => r.success);
    const failed = allResults.filter(r => !r.success);

    res.json({
      total_iterations: iterations,
      concurrent_requests: concurrent,
      successful: successful.length,
      failed: failed.length,
      success_rate: successful.length / iterations,
      average_duration: successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
      total_duration: Date.now() - startTime,
      results: allResults
    });
  }

  // 熔断器相关方法
  private initializeCircuitBreakerForAgent(agentName: string): void {
    if (!this.circuitBreakerConfig.enabled) return;

    this.circuitBreaker.set(agentName, {
      state: 'CLOSED',
      failures: 0,
      last_failure_time: 0,
      success_count: 0
    });
  }

  private updateCircuitBreaker(agentName: string, success: boolean): void {
    if (!this.circuitBreakerConfig.enabled) return;

    const breaker = this.circuitBreaker.get(agentName);
    if (!breaker) return;

    if (success) {
      breaker.failures = 0;
      breaker.success_count++;
      
      if (breaker.state === 'HALF_OPEN' && breaker.success_count >= 3) {
        breaker.state = 'CLOSED';
        breaker.success_count = 0;
        this.logger.info(`Circuit breaker closed for agent: ${agentName}`);
      }
    } else {
      breaker.failures++;
      breaker.last_failure_time = Date.now();
      breaker.success_count = 0;

      if (breaker.failures >= this.circuitBreakerConfig.failure_threshold) {
        breaker.state = 'OPEN';
        this.logger.warn(`Circuit breaker opened for agent: ${agentName}`);
      }
    }
  }

  private isCircuitBreakerOpen(agentName: string): boolean {
    if (!this.circuitBreakerConfig.enabled) return false;

    const breaker = this.circuitBreaker.get(agentName);
    if (!breaker) return false;

    if (breaker.state === 'OPEN') {
      const now = Date.now();
      if (now - breaker.last_failure_time > this.circuitBreakerConfig.recovery_timeout) {
        breaker.state = 'HALF_OPEN';
        breaker.success_count = 0;
        this.logger.info(`Circuit breaker half-open for agent: ${agentName}`);
        return false;
      }
      return true;
    }

    return false;
  }

  private checkCircuitBreakerRecovery(): void {
    const now = Date.now();
    
    for (const [agentName, breaker] of this.circuitBreaker) {
      if (breaker.state === 'OPEN' && 
          now - breaker.last_failure_time > this.circuitBreakerConfig.recovery_timeout) {
        breaker.state = 'HALF_OPEN';
        breaker.success_count = 0;
        this.logger.info(`Circuit breaker half-open for agent: ${agentName}`);
      }
    }
  }

  private getCircuitBreakerStatus(): any {
    const status: any = {};
    
    for (const [agentName, breaker] of this.circuitBreaker) {
      status[agentName] = {
        state: breaker.state,
        failures: breaker.failures,
        last_failure_time: breaker.last_failure_time,
        success_count: breaker.success_count
      };
    }
    
    return status;
  }

  // 限流相关方法
  private rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const clientIp = req.ip;
    const now = Date.now();
    const windowStart = now - this.config.rate_limit.time_window;
    
    let requests = this.rateLimiter.get(clientIp) || [];
    requests = requests.filter(time => time > windowStart);
    
    if (requests.length >= this.config.rate_limit.max_requests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        request_id: req.headers['x-request-id']
      });
    }
    
    requests.push(now);
    this.rateLimiter.set(clientIp, requests);
    
    next();
  }

  private getRateLimitStatus(): any {
    const now = Date.now();
    const windowStart = now - this.config.rate_limit.time_window;
    const status: any = {};
    
    for (const [ip, requests] of this.rateLimiter) {
      const recentRequests = requests.filter(time => time > windowStart);
      status[ip] = {
        requests: recentRequests.length,
        limit: this.config.rate_limit.max_requests,
        window: this.config.rate_limit.time_window
      };
    }
    
    return status;
  }

  // 工具方法
  private validateAgentStatus(agentStatus: AgentStatus): boolean {
    return ValidationUtils.isValidAgentName(agentStatus.agent_name) &&
           ValidationUtils.isValidPort(agentStatus.port) &&
           Array.isArray(agentStatus.capabilities);
  }

  private generateRequestId(): string {
    return `${this.agentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 公共方法
  public registerHandler(action: string, handler: Function): void {
    this.messageHandlers.set(action, handler);
  }

  public async sendMessage(
    targetAgent: string,
    action: string,
    data: any
  ): Promise<any> {
    const targetPort = AGENT_PORTS[targetAgent as keyof typeof AGENT_PORTS];
    if (!targetPort) {
      throw new Error(`Unknown target agent: ${targetAgent}`);
    }

    // 检查熔断器
    if (this.isCircuitBreakerOpen(targetAgent)) {
      throw new Error(`Circuit breaker is open for agent: ${targetAgent}`);
    }

    const message = {
      from: this.agentName,
      to: targetAgent,
      type: MESSAGE_TYPES.REQUEST,
      action,
      data,
      timestamp: Date.now(),
      message_id: this.generateRequestId()
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.request_timeout);

      const response = await fetch(`http://localhost:${targetPort}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': message.message_id
        },
        body: JSON.stringify(message),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const result = await response.json();
      this.updateCircuitBreaker(targetAgent, true);
      
      return result;
    } catch (error) {
      this.updateCircuitBreaker(targetAgent, false);
      this.logger.error(`Failed to send message to ${targetAgent}:`, error);
      throw error;
    }
  }

  public async sendBatchMessages(
    messages: Array<{ targetAgent: string; action: string; data: any }>
  ): Promise<any[]> {
    // 按目标代理分组
    const groupedMessages = new Map<string, any[]>();
    
    for (const msg of messages) {
      if (!groupedMessages.has(msg.targetAgent)) {
        groupedMessages.set(msg.targetAgent, []);
      }
      groupedMessages.get(msg.targetAgent)!.push({
        from: this.agentName,
        to: msg.targetAgent,
        type: MESSAGE_TYPES.REQUEST,
        action: msg.action,
        data: msg.data,
        timestamp: Date.now(),
        message_id: this.generateRequestId()
      });
    }

    const results: any[] = [];
    
    for (const [targetAgent, batch] of groupedMessages) {
      try {
        const result = await this.sendBatchToAgent(targetAgent, batch);
        results.push({ targetAgent, success: true, result });
      } catch (error) {
        results.push({ targetAgent, success: false, error: error.message });
      }
    }

    return results;
  }

  private async sendBatchToAgent(targetAgent: string, messages: any[]): Promise<any> {
    const targetPort = AGENT_PORTS[targetAgent as keyof typeof AGENT_PORTS];
    if (!targetPort) {
      throw new Error(`Unknown target agent: ${targetAgent}`);
    }

    // 检查熔断器
    if (this.isCircuitBreakerOpen(targetAgent)) {
      throw new Error(`Circuit breaker is open for agent: ${targetAgent}`);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.request_timeout);

      const response = await fetch(`http://localhost:${targetPort}/messages/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messages),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to send batch messages: ${response.statusText}`);
      }

      const result = await response.json();
      this.updateCircuitBreaker(targetAgent, true);
      
      return result;
    } catch (error) {
      this.updateCircuitBreaker(targetAgent, false);
      this.logger.error(`Failed to send batch messages to ${targetAgent}:`, error);
      throw error;
    }
  }

  public async broadcastMessage(action: string, data: any): Promise<any[]> {
    const messages = Array.from(this.connectedAgents.keys())
      .filter(agentName => agentName !== this.agentName)
      .map(agentName => ({ targetAgent: agentName, action, data }));

    return await this.sendBatchMessages(messages);
  }

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
      this.logger.error('Failed to register to coordinator:', error);
    }
  }

  public getConnectedAgents(): AgentStatus[] {
    return Array.from(this.connectedAgents.values());
  }

  public isAgentConnected(agentName: string): boolean {
    return this.connectedAgents.has(agentName);
  }

  public start(): void {
    this.app.listen(this.port, () => {
      this.logger.info(`Enhanced communication server started on port ${this.port}`);
    });
  }

  public stop(): void {
    this.logger.info(`Enhanced communication server stopping...`);
    // 这里可以实现优雅停机逻辑
  }
}

// 熔断器状态接口
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  last_failure_time: number;
  success_count: number;
}