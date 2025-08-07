import { Task, TaskStatus, TaskConfig } from './types';
import { TaskQueue } from './task-queue';
import { TaskRouter, LoadBalancer, TaskPriorityManager } from './task-router';
import { LoggerUtils } from '../shared/utils';

export class TaskScheduler {
  private taskQueue: TaskQueue;
  private taskRouter: TaskRouter;
  private loadBalancer: LoadBalancer;
  private priorityManager: TaskPriorityManager;
  private config: TaskConfig;
  private logger = LoggerUtils;
  private schedulingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private timeoutInterval: NodeJS.Timeout | null = null;

  constructor(config: TaskConfig) {
    this.config = config;
    this.taskQueue = new TaskQueue(config);
    this.taskRouter = new TaskRouter();
    this.loadBalancer = new LoadBalancer();
    this.priorityManager = new TaskPriorityManager();
  }

  // 启动调度器
  start(): void {
    this.logger.info('Starting task scheduler');

    // 任务调度循环
    this.schedulingInterval = setInterval(() => {
      this.scheduleTasks();
    }, 1000); // 每秒调度一次

    // 清理循环
    this.cleanupInterval = setInterval(() => {
      this.taskQueue.cleanup();
    }, this.config.cleanup_interval);

    // 超时检查循环
    this.timeoutInterval = setInterval(() => {
      this.taskQueue.checkTimeouts();
    }, 5000); // 每5秒检查一次超时

    this.logger.info('Task scheduler started');
  }

  // 停止调度器
  stop(): void {
    this.logger.info('Stopping task scheduler');

    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.timeoutInterval) {
      clearInterval(this.timeoutInterval);
      this.timeoutInterval = null;
    }

    this.logger.info('Task scheduler stopped');
  }

  // 调度任务
  private async scheduleTasks(): Promise<void> {
    try {
      // 获取队列状态
      const queueStatus = this.taskQueue.getQueueStatus();
      
      // 如果队列已满，跳过调度
      if (queueStatus.processing >= queueStatus.max_concurrent) {
        return;
      }

      // 获取可用槽位
      const availableSlots = queueStatus.max_concurrent - queueStatus.processing;
      
      for (let i = 0; i < availableSlots; i++) {
        await this.scheduleNextTask();
      }
    } catch (error) {
      this.logger.error('Error in task scheduling', { error });
    }
  }

  // 调度下一个任务
  private async scheduleNextTask(): Promise<void> {
    try {
      // 获取下一个任务
      const task = await this.taskQueue.dequeue();
      if (!task) {
        return;
      }

      // 路由任务
      const capableAgents = this.taskRouter.routeTask(task);
      if (capableAgents.length === 0) {
        await this.taskQueue.failTask(task.id, 'No capable agents available');
        return;
      }

      // 选择最佳代理
      const selectedAgent = this.loadBalancer.selectBestAgent(capableAgents);
      if (!selectedAgent) {
        await this.taskQueue.failTask(task.id, 'No healthy agents available');
        return;
      }

      // 分配任务给代理
      await this.assignTaskToAgent(task, selectedAgent);
    } catch (error) {
      this.logger.error('Error scheduling next task', { error });
    }
  }

  // 分配任务给代理
  private async assignTaskToAgent(task: Task, agentId: string): Promise<void> {
    try {
      // 更新负载均衡器
      const currentLoad = this.loadBalancer.getAgentLoads().get(agentId) || 0;
      this.loadBalancer.updateAgentLoad(agentId, currentLoad + 1);

      // 这里应该通过通信协议发送任务给代理
      // 现在只是标记任务已分配
      await this.taskQueue.startTask(task.id);

      this.logger.info('Task assigned to agent', {
        task_id: task.id,
        agent_id: agentId,
        task_type: task.type
      });

      // 模拟任务执行（实际应该等待代理完成）
      // 这里只是示例，实际实现需要通过通信协议
      this.simulateTaskExecution(task, agentId);
    } catch (error) {
      this.logger.error('Error assigning task to agent', {
        task_id: task.id,
        agent_id: agentId,
        error
      });
      await this.taskQueue.failTask(task.id, `Assignment failed: ${error}`);
    }
  }

  // 模拟任务执行（实际实现中应该移除）
  private async simulateTaskExecution(task: Task, agentId: string): Promise<void> {
    try {
      // 模拟处理时间
      const processingTime = Math.random() * 10000 + 1000; // 1-11秒
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // 模拟成功完成
      const result = {
        processed_by: agentId,
        processing_time: processingTime,
        timestamp: new Date().toISOString()
      };

      await this.taskQueue.completeTask(task.id, result);

      // 更新负载均衡器
      const currentLoad = this.loadBalancer.getAgentLoads().get(agentId) || 0;
      this.loadBalancer.updateAgentLoad(agentId, Math.max(0, currentLoad - 1));

    } catch (error) {
      await this.taskQueue.failTask(task.id, `Execution failed: ${error}`);
      
      // 更新负载均衡器
      const currentLoad = this.loadBalancer.getAgentLoads().get(agentId) || 0;
      this.loadBalancer.updateAgentLoad(agentId, Math.max(0, currentLoad - 1));
    }
  }

  // 创建任务
  async createTask(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'retry_count' | 'status'>): Promise<Task> {
    // 计算优先级
    const priority = this.priorityManager.calculatePriority(taskData);
    
    // 创建任务
    const task = await this.taskQueue.enqueue({
      ...taskData,
      priority,
      max_retries: taskData.max_retries || this.config.max_retries,
      timeout: taskData.timeout || this.config.default_timeout
    });

    this.logger.info('Task created', {
      task_id: task.id,
      type: task.type,
      priority: task.priority
    });

    return task;
  }

  // 获取任务状态
  async getTask(taskId: string): Promise<Task | null> {
    return await this.taskQueue.getTask(taskId);
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<void> {
    await this.taskQueue.cancelTask(taskId);
    this.logger.info('Task cancelled', { task_id: taskId });
  }

  // 获取统计信息
  getStats() {
    return this.taskQueue.getStats();
  }

  // 获取队列状态
  getQueueStatus() {
    return this.taskQueue.getQueueStatus();
  }

  // 更新代理状态
  updateAgentStatus(agentId: string, isHealthy: boolean): void {
    this.loadBalancer.updateAgentStatus(agentId, isHealthy);
    this.logger.info('Agent status updated', {
      agent_id: agentId,
      is_healthy: isHealthy
    });
  }

  // 获取代理负载信息
  getAgentLoads(): Map<string, number> {
    return this.loadBalancer.getAgentLoads();
  }

  // 获取代理状态信息
  getAgentStatus(): Map<string, boolean> {
    return this.loadBalancer.getAgentStatus();
  }

  // 获取路由信息
  getRoutes() {
    return this.taskRouter.getAllRoutes();
  }

  // 添加路由规则
  addRoute(taskType: string, agents: string[]): void {
    this.taskRouter.addRoute(taskType as any, agents);
    this.logger.info('Route added', { task_type: taskType, agents });
  }

  // 获取代理能力
  getAgentCapabilities(agentType: string): string[] {
    return this.taskRouter.getAgentCapabilities(agentType as any);
  }
}