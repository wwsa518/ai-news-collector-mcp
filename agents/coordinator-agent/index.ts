// 主协调代理
import { CommunicationProtocol } from '../shared/communication';
import { AgentConfig, AgentMessage, AgentStatus, Task } from '../shared/types';
import { AGENT_PORTS, TASK_ROUTES, HEALTH_CHECK_INTERVAL } from '../shared/config';
import { MessageUtils, AgentUtils, LoggerUtils } from '../shared/utils';

export class CoordinatorAgent {
  private config: AgentConfig;
  private communication: CommunicationProtocol;
  private connectedAgents: Map<string, AgentStatus> = new Map();
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, Task> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.communication = new CommunicationProtocol(config.agent_name, config.port);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // 健康检查
    this.communication.registerHandler('health_check', this.handleHealthCheck.bind(this));
    
    // 心跳
    this.communication.registerHandler('heartbeat', this.handleHeartbeat.bind(this));
    
    // 任务提交
    this.communication.registerHandler('submit_task', this.handleTaskSubmission.bind(this));
    
    // 任务完成
    this.communication.registerHandler('task_completed', this.handleTaskCompletion.bind(this));
    
    // 任务失败
    this.communication.registerHandler('task_failed', this.handleTaskFailure.bind(this));
    
    // 代理注册
    this.communication.registerHandler('register_agent', this.handleAgentRegistration.bind(this));
    
    // 获取代理状态
    this.communication.registerHandler('get_agent_status', this.handleGetAgentStatus.bind(this));
    
    // 获取任务状态
    this.communication.registerHandler('get_task_status', this.handleGetTaskStatus.bind(this));
  }

  private handleHealthCheck(message: AgentMessage): void {
    const response = MessageUtils.createResponse(message, {
      status: 'healthy',
      timestamp: Date.now(),
      connected_agents: this.connectedAgents.size,
      active_tasks: this.activeTasks.size,
      queued_tasks: this.taskQueue.length
    });
    
    // 发送响应
    this.sendMessageToAgent(message.from, response);
  }

  private handleHeartbeat(message: AgentMessage): void {
    const agentStatus: AgentStatus = message.data;
    this.connectedAgents.set(agentStatus.agent_name, agentStatus);
    
    LoggerUtils.info(`Heartbeat received from ${agentStatus.agent_name}`, {
      uptime: agentStatus.uptime,
      capabilities: agentStatus.capabilities
    });
  }

  private handleTaskSubmission(message: AgentMessage): void {
    const task: Task = message.data;
    this.taskQueue.push(task);
    
    LoggerUtils.info(`Task submitted: ${task.id}`, {
      type: task.type,
      priority: task.priority
    });
    
    // 立即尝试分配任务
    this.assignTasks();
    
    const response = MessageUtils.createResponse(message, {
      task_id: task.id,
      status: 'queued',
      queue_position: this.taskQueue.length
    });
    
    this.sendMessageToAgent(message.from, response);
  }

  private handleTaskCompletion(message: AgentMessage): void {
    const { task_id, result } = message.data;
    this.activeTasks.delete(task_id);
    
    LoggerUtils.info(`Task completed: ${task_id}`, {
      result: result
    });
    
    // 继续分配新任务
    this.assignTasks();
  }

  private handleTaskFailure(message: AgentMessage): void {
    const { task_id, error } = message.data;
    this.activeTasks.delete(task_id);
    
    LoggerUtils.error(`Task failed: ${task_id}`, {
      error: error
    });
    
    // 继续分配新任务
    this.assignTasks();
  }

  private handleAgentRegistration(message: AgentMessage): void {
    const agentStatus: AgentStatus = message.data;
    this.connectedAgents.set(agentStatus.agent_name, agentStatus);
    
    LoggerUtils.info(`Agent registered: ${agentStatus.agent_name}`, {
      port: agentStatus.port,
      capabilities: agentStatus.capabilities
    });
  }

  private handleGetAgentStatus(message: AgentMessage): void {
    const agents = Array.from(this.connectedAgents.values());
    const response = MessageUtils.createResponse(message, agents);
    this.sendMessageToAgent(message.from, response);
  }

  private handleGetTaskStatus(message: AgentMessage): void {
    const { task_id } = message.data;
    const task = this.activeTasks.get(task_id) || 
                 this.taskQueue.find(t => t.id === task_id);
    
    const response = MessageUtils.createResponse(message, {
      task_id,
      status: task ? task.status : 'not_found',
      task: task || null
    });
    
    this.sendMessageToAgent(message.from, response);
  }

  private async sendMessageToAgent(targetAgent: string, message: AgentMessage): Promise<void> {
    try {
      await this.communication.sendMessage(targetAgent, message.action, message);
    } catch (error) {
      LoggerUtils.error(`Failed to send message to ${targetAgent}`, { error });
    }
  }

  private assignTasks(): void {
    if (this.taskQueue.length === 0) return;

    // 按优先级排序任务
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    for (let i = this.taskQueue.length - 1; i >= 0; i--) {
      const task = this.taskQueue[i];
      const targetAgent = this.findBestAgentForTask(task);
      
      if (targetAgent) {
        this.assignTaskToAgent(task, targetAgent);
        this.taskQueue.splice(i, 1);
        this.activeTasks.set(task.id, task);
      }
    }
  }

  private findBestAgentForTask(task: Task): string | null {
    const targetType = TASK_ROUTES[task.type as keyof typeof TASK_ROUTES];
    if (!targetType) return null;

    // 找到能够处理该任务类型的代理
    const capableAgents = Array.from(this.connectedAgents.values()).filter(agent => {
      return agent.capabilities.includes(task.type) && 
             agent.status === 'running' &&
             agent.agent_name.includes(targetType);
    });

    if (capableAgents.length === 0) return null;

    // 选择负载最低的代理
    return capableAgents.reduce((best, current) => {
      const bestLoad = this.getAgentLoad(best.agent_name);
      const currentLoad = this.getAgentLoad(current.agent_name);
      return currentLoad < bestLoad ? current : best;
    }).agent_name;
  }

  private getAgentLoad(agentName: string): number {
    return Array.from(this.activeTasks.values()).filter(task => 
      task.assigned_agent === agentName
    ).length;
  }

  private async assignTaskToAgent(task: Task, agentName: string): Promise<void> {
    task.assigned_agent = agentName;
    task.status = 'assigned';
    task.assigned_at = Date.now();

    const message = MessageUtils.createMessage(
      this.config.agent_name,
      agentName,
      'request',
      'execute_task',
      task
    );

    try {
      await this.communication.sendMessage(agentName, 'execute_task', task);
      LoggerUtils.info(`Task assigned to ${agentName}: ${task.id}`);
    } catch (error) {
      LoggerUtils.error(`Failed to assign task to ${agentName}`, { error });
      task.status = 'failed';
      this.activeTasks.delete(task.id);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkAgentHealth();
    }, HEALTH_CHECK_INTERVAL);
  }

  private async checkAgentHealth(): Promise<void> {
    const deadAgents: string[] = [];
    
    for (const [agentName, status] of this.connectedAgents) {
      try {
        const response = await fetch(`http://localhost:${status.port}/health`);
        if (!response.ok) {
          deadAgents.push(agentName);
        }
      } catch (error) {
        deadAgents.push(agentName);
      }
    }

    // 移除死亡的代理
    deadAgents.forEach(agentName => {
      this.connectedAgents.delete(agentName);
      LoggerUtils.warn(`Agent ${agentName} is dead, removed from pool`);
      
      // 重新分配该代理的任务
      this.reassignAgentTasks(agentName);
    });
  }

  private reassignAgentTasks(agentName: string): void {
    const tasksToReassign = Array.from(this.activeTasks.values()).filter(
      task => task.assigned_agent === agentName
    );

    tasksToReassign.forEach(task => {
      this.activeTasks.delete(task.id);
      task.status = 'pending';
      task.assigned_agent = undefined;
      task.assigned_at = undefined;
      this.taskQueue.push(task);
    });

    // 尝试重新分配任务
    this.assignTasks();
  }

  public async start(): Promise<void> {
    LoggerUtils.info(`Starting Coordinator Agent on port ${this.config.port}`);
    
    // 启动通信服务
    this.communication.start();
    
    // 启动健康检查
    this.startHealthCheck();
    
    // 注册自身状态
    const selfStatus = AgentUtils.createAgentStatus(
      this.config.agent_name,
      this.config.port,
      this.config.capabilities
    );
    
    this.connectedAgents.set(this.config.agent_name, selfStatus);
    
    LoggerUtils.info('Coordinator Agent started successfully');
  }

  public async stop(): Promise<void> {
    LoggerUtils.info('Stopping Coordinator Agent');
    
    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // 停止通信服务
    this.communication.stop();
    
    LoggerUtils.info('Coordinator Agent stopped');
  }

  public getStatus(): any {
    return {
      agent_name: this.config.agent_name,
      status: 'running',
      port: this.config.port,
      connected_agents: this.connectedAgents.size,
      active_tasks: this.activeTasks.size,
      queued_tasks: this.taskQueue.length,
      uptime: Date.now()
    };
  }
}