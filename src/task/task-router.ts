import { Task, TaskType, TaskPriority } from './types';
import { AGENT_PORTS, TASK_ROUTES } from '../shared/config';

export class TaskRouter {
  private routeTable: Map<string, string[]> = new Map();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 初始化路由表
    this.routeTable.set(TaskType.COLLECT_NEWS, ['collector']);
    this.routeTable.set(TaskType.PROCESS_CONTENT, ['processor']);
    this.routeTable.set(TaskType.ANALYZE_SENTIMENT, ['analyzer']);
    this.routeTable.set(TaskType.DETECT_RISKS, ['analyzer']);
    this.routeTable.set(TaskType.EXTRACT_ENTITIES, ['processor']);
    this.routeTable.set(TaskType.EXTRACT_EVENTS, ['processor']);
    this.routeTable.set(TaskType.GENERATE_REPORT, ['analyzer']);
    this.routeTable.set(TaskType.CLEANUP_DATA, ['processor']);
  }

  // 路由任务到合适的代理
  routeTask(task: Task): string[] {
    const capableAgents = this.routeTable.get(task.type) || [];
    
    // 根据任务子类型进一步细化路由
    if (task.subtype) {
      return this.routeBySubtype(task.type, task.subtype, capableAgents);
    }

    return capableAgents;
  }

  // 根据子类型路由
  private routeBySubtype(taskType: TaskType, subtype: string, capableAgents: string[]): string[] {
    // 这里可以根据具体的子类型返回更精确的代理列表
    switch (taskType) {
      case TaskType.COLLECT_NEWS:
        if (subtype === 'rss') return ['collector'];
        if (subtype === 'web') return ['collector'];
        if (subtype === 'api') return ['collector'];
        break;
      
      case TaskType.PROCESS_CONTENT:
        if (subtype === 'clean') return ['processor'];
        if (subtype === 'extract') return ['processor'];
        break;
      
      case TaskType.ANALYZE_SENTIMENT:
        if (subtype === 'basic') return ['analyzer'];
        if (subtype === 'advanced') return ['analyzer'];
        break;
    }

    return capableAgents;
  }

  // 检查代理是否能处理任务类型
  canAgentHandleTask(agentType: string, taskType: TaskType): boolean {
    const capableAgents = this.routeTable.get(taskType) || [];
    return capableAgents.includes(agentType);
  }

  // 获取代理能处理的所有任务类型
  getAgentCapabilities(agentType: string): TaskType[] {
    const capabilities: TaskType[] = [];
    
    for (const [taskType, agents] of this.routeTable) {
      if (agents.includes(agentType)) {
        capabilities.push(taskType as TaskType);
      }
    }

    return capabilities;
  }

  // 添加新的路由规则
  addRoute(taskType: TaskType, agents: string[]): void {
    this.routeTable.set(taskType, agents);
  }

  // 移除路由规则
  removeRoute(taskType: TaskType): void {
    this.routeTable.delete(taskType);
  }

  // 获取所有路由规则
  getAllRoutes(): Map<TaskType, string[]> {
    const routes = new Map<TaskType, string[]>();
    
    for (const [taskType, agents] of this.routeTable) {
      routes.set(taskType as TaskType, [...agents]);
    }

    return routes;
  }
}

export class LoadBalancer {
  private agentLoads: Map<string, number> = new Map();
  private agentStatus: Map<string, boolean> = new Map();

  // 更新代理负载
  updateAgentLoad(agentId: string, load: number): void {
    this.agentLoads.set(agentId, load);
  }

  // 更新代理状态
  updateAgentStatus(agentId: string, isHealthy: boolean): void {
    this.agentStatus.set(agentId, isHealthy);
  }

  // 选择最佳代理
  selectBestAgent(candidateAgents: string[]): string | null {
    if (candidateAgents.length === 0) {
      return null;
    }

    // 过滤出健康的代理
    const healthyAgents = candidateAgents.filter(agentId => 
      this.agentStatus.get(agentId) !== false
    );

    if (healthyAgents.length === 0) {
      return null;
    }

    // 选择负载最低的代理
    let bestAgent = healthyAgents[0];
    let lowestLoad = this.agentLoads.get(bestAgent) || 0;

    for (let i = 1; i < healthyAgents.length; i++) {
      const currentLoad = this.agentLoads.get(healthyAgents[i]) || 0;
      if (currentLoad < lowestLoad) {
        lowestLoad = currentLoad;
        bestAgent = healthyAgents[i];
      }
    }

    return bestAgent;
  }

  // 获取代理负载信息
  getAgentLoads(): Map<string, number> {
    return new Map(this.agentLoads);
  }

  // 获取代理状态信息
  getAgentStatus(): Map<string, boolean> {
    return new Map(this.agentStatus);
  }

  // 重置代理负载
  resetAgentLoad(agentId: string): void {
    this.agentLoads.delete(agentId);
  }

  // 移除代理
  removeAgent(agentId: string): void {
    this.agentLoads.delete(agentId);
    this.agentStatus.delete(agentId);
  }
}

export class TaskPriorityManager {
  // 计算任务优先级
  calculatePriority(task: Partial<Task>): TaskPriority {
    // 基础优先级
    let priority = TaskPriority.NORMAL;

    // 根据任务类型调整优先级
    switch (task.type) {
      case TaskType.DETECT_RISKS:
        priority = TaskPriority.HIGH;
        break;
      case TaskType.COLLECT_NEWS:
        priority = TaskPriority.NORMAL;
        break;
      case TaskType.PROCESS_CONTENT:
        priority = TaskPriority.NORMAL;
        break;
      case TaskType.ANALYZE_SENTIMENT:
        priority = TaskPriority.NORMAL;
        break;
    }

    // 根据标签调整优先级
    if (task.tags?.includes('urgent')) {
      priority = Math.min(priority + 1, TaskPriority.CRITICAL);
    }

    if (task.tags?.includes('low-priority')) {
      priority = Math.max(priority - 1, TaskPriority.LOW);
    }

    // 根据超时时间调整优先级
    if (task.timeout && task.timeout < 30000) { // 30秒内
      priority = Math.min(priority + 1, TaskPriority.CRITICAL);
    }

    return priority;
  }

  // 比较任务优先级
  compareTasks(taskA: Task, taskB: Task): number {
    if (taskA.priority !== taskB.priority) {
      return taskB.priority - taskA.priority;
    }

    // 优先级相同，按创建时间排序
    return taskA.created_at.getTime() - taskB.created_at.getTime();
  }

  // 获取优先级描述
  getPriorityDescription(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.LOW:
        return 'Low';
      case TaskPriority.NORMAL:
        return 'Normal';
      case TaskPriority.HIGH:
        return 'High';
      case TaskPriority.CRITICAL:
        return 'Critical';
      default:
        return 'Unknown';
    }
  }
}