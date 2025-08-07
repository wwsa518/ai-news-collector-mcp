import { Task, TaskStatus, TaskType, TaskPriority, TaskConfig } from './types';
import { v4 as uuidv4 } from 'uuid';
import { LoggerUtils } from '../shared/utils';

export class TaskQueue {
  private queue: Task[] = [];
  private processing: Map<string, Task> = new Map();
  private completed: Map<string, Task> = new Map();
  private config: TaskConfig;
  private logger = LoggerUtils;

  constructor(config: TaskConfig) {
    this.config = config;
  }

  // 添加任务到队列
  async enqueue(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'retry_count' | 'status'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date(),
      retry_count: 0,
      status: TaskStatus.PENDING
    };

    this.queue.push(newTask);
    this.queue.sort((a, b) => b.priority - a.priority); // 按优先级排序

    this.logger.info('Task enqueued', {
      task_id: newTask.id,
      type: newTask.type,
      priority: newTask.priority
    });

    return newTask;
  }

  // 从队列中获取下一个任务
  async dequeue(agentId?: string): Promise<Task | null> {
    if (this.queue.length === 0) {
      return null;
    }

    // 检查并发限制
    if (this.processing.size >= this.config.max_concurrent_tasks) {
      return null;
    }

    const task = this.queue.shift()!;
    task.status = TaskStatus.ASSIGNED;
    task.assigned_agent = agentId;
    task.assigned_at = new Date();
    task.updated_at = new Date();

    this.processing.set(task.id, task);

    this.logger.info('Task dequeued', {
      task_id: task.id,
      agent_id: agentId,
      type: task.type
    });

    return task;
  }

  // 开始执行任务
  async startTask(taskId: string): Promise<void> {
    const task = this.processing.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in processing`);
    }

    task.status = TaskStatus.RUNNING;
    task.started_at = new Date();
    task.updated_at = new Date();

    this.logger.info('Task started', { task_id: taskId });
  }

  // 完成任务
  async completeTask(taskId: string, result?: any): Promise<void> {
    const task = this.processing.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in processing`);
    }

    task.status = TaskStatus.COMPLETED;
    task.result = result;
    task.completed_at = new Date();
    task.updated_at = new Date();

    this.processing.delete(taskId);
    this.completed.set(taskId, task);

    this.logger.info('Task completed', {
      task_id: taskId,
      duration: task.completed_at.getTime() - (task.started_at?.getTime() || task.assigned_at!.getTime())
    });
  }

  // 任务失败
  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.processing.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in processing`);
    }

    task.retry_count++;
    task.error = error;
    task.updated_at = new Date();

    if (task.retry_count >= task.max_retries) {
      task.status = TaskStatus.FAILED;
      task.completed_at = new Date();
      this.processing.delete(taskId);
      this.completed.set(taskId, task);
      this.logger.error('Task failed permanently', { task_id: taskId, error });
    } else {
      // 重新排队
      task.status = TaskStatus.PENDING;
      task.assigned_agent = undefined;
      task.assigned_at = undefined;
      task.started_at = undefined;
      this.processing.delete(taskId);
      this.queue.push(task);
      this.logger.warn('Task failed, retrying', { 
        task_id: taskId, 
        retry_count: task.retry_count,
        error 
      });
    }
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<void> {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.status = TaskStatus.CANCELLED;
      task.updated_at = new Date();
      this.completed.set(taskId, task);
      return;
    }

    // 从处理中移除
    const processingTask = this.processing.get(taskId);
    if (processingTask) {
      processingTask.status = TaskStatus.CANCELLED;
      processingTask.updated_at = new Date();
      processingTask.completed_at = new Date();
      this.processing.delete(taskId);
      this.completed.set(taskId, processingTask);
    }
  }

  // 获取任务状态
  async getTask(taskId: string): Promise<Task | null> {
    // 检查队列
    const queuedTask = this.queue.find(t => t.id === taskId);
    if (queuedTask) return queuedTask;

    // 检查处理中
    const processingTask = this.processing.get(taskId);
    if (processingTask) return processingTask;

    // 检查已完成
    return this.completed.get(taskId) || null;
  }

  // 获取队列状态
  getQueueStatus() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      max_concurrent: this.config.max_concurrent_tasks
    };
  }

  // 获取统计信息
  getStats() {
    const completedTasks = Array.from(this.completed.values());
    const successfulTasks = completedTasks.filter(t => t.status === TaskStatus.COMPLETED);
    const failedTasks = completedTasks.filter(t => t.status === TaskStatus.FAILED);

    const totalProcessingTime = successfulTasks.reduce((sum, task) => {
      const startTime = task.started_at?.getTime() || task.assigned_at!.getTime();
      const endTime = task.completed_at!.getTime();
      return sum + (endTime - startTime);
    }, 0);

    return {
      total_tasks: completedTasks.length,
      successful_tasks: successfulTasks.length,
      failed_tasks: failedTasks.length,
      success_rate: successfulTasks.length / completedTasks.length || 0,
      average_processing_time: successfulTasks.length > 0 ? totalProcessingTime / successfulTasks.length : 0,
      queue_status: this.getQueueStatus()
    };
  }

  // 清理过期任务
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.task_retention_days * 24 * 60 * 60 * 1000);
    
    const tasksToRemove = Array.from(this.completed.entries())
      .filter(([_, task]) => task.completed_at! < cutoffDate);

    for (const [taskId, _] of tasksToRemove) {
      this.completed.delete(taskId);
    }

    this.logger.info('Cleaned up completed tasks', { 
      removed_count: tasksToRemove.length 
    });
  }

  // 获取代理的任务
  async getAgentTasks(agentId: string): Promise<Task[]> {
    return Array.from(this.processing.values()).filter(task => task.assigned_agent === agentId);
  }

  // 超时检查
  async checkTimeouts(): Promise<void> {
    const now = new Date();
    const timedOutTasks: string[] = [];

    for (const [taskId, task] of this.processing) {
      if (task.started_at && now.getTime() - task.started_at.getTime() > task.timeout) {
        timedOutTasks.push(taskId);
      }
    }

    for (const taskId of timedOutTasks) {
      await this.failTask(taskId, 'Task timeout');
    }

    if (timedOutTasks.length > 0) {
      this.logger.warn('Tasks timed out', { count: timedOutTasks.length });
    }
  }
}