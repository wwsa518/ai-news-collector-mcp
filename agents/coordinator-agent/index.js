"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinatorAgent = void 0;
// 主协调代理
const communication_1 = require("../shared/communication");
const config_1 = require("../shared/config");
const utils_1 = require("../shared/utils");
class CoordinatorAgent {
    config;
    communication;
    connectedAgents = new Map();
    taskQueue = [];
    activeTasks = new Map();
    healthCheckInterval = null;
    constructor(config) {
        this.config = config;
        this.communication = new communication_1.CommunicationProtocol(config.agent_name, config.port);
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
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
    handleHealthCheck(message) {
        const response = utils_1.MessageUtils.createResponse(message, {
            status: 'healthy',
            timestamp: Date.now(),
            connected_agents: this.connectedAgents.size,
            active_tasks: this.activeTasks.size,
            queued_tasks: this.taskQueue.length
        });
        // 发送响应
        this.sendMessageToAgent(message.from, response);
    }
    handleHeartbeat(message) {
        const agentStatus = message.data;
        this.connectedAgents.set(agentStatus.agent_name, agentStatus);
        utils_1.LoggerUtils.info(`Heartbeat received from ${agentStatus.agent_name}`, {
            uptime: agentStatus.uptime,
            capabilities: agentStatus.capabilities
        });
    }
    handleTaskSubmission(message) {
        const task = message.data;
        this.taskQueue.push(task);
        utils_1.LoggerUtils.info(`Task submitted: ${task.id}`, {
            type: task.type,
            priority: task.priority
        });
        // 立即尝试分配任务
        this.assignTasks();
        const response = utils_1.MessageUtils.createResponse(message, {
            task_id: task.id,
            status: 'queued',
            queue_position: this.taskQueue.length
        });
        this.sendMessageToAgent(message.from, response);
    }
    handleTaskCompletion(message) {
        const { task_id, result } = message.data;
        this.activeTasks.delete(task_id);
        utils_1.LoggerUtils.info(`Task completed: ${task_id}`, {
            result: result
        });
        // 继续分配新任务
        this.assignTasks();
    }
    handleTaskFailure(message) {
        const { task_id, error } = message.data;
        this.activeTasks.delete(task_id);
        utils_1.LoggerUtils.error(`Task failed: ${task_id}`, {
            error: error
        });
        // 继续分配新任务
        this.assignTasks();
    }
    handleAgentRegistration(message) {
        const agentStatus = message.data;
        this.connectedAgents.set(agentStatus.agent_name, agentStatus);
        utils_1.LoggerUtils.info(`Agent registered: ${agentStatus.agent_name}`, {
            port: agentStatus.port,
            capabilities: agentStatus.capabilities
        });
    }
    handleGetAgentStatus(message) {
        const agents = Array.from(this.connectedAgents.values());
        const response = utils_1.MessageUtils.createResponse(message, agents);
        this.sendMessageToAgent(message.from, response);
    }
    handleGetTaskStatus(message) {
        const { task_id } = message.data;
        const task = this.activeTasks.get(task_id) ||
            this.taskQueue.find(t => t.id === task_id);
        const response = utils_1.MessageUtils.createResponse(message, {
            task_id,
            status: task ? task.status : 'not_found',
            task: task || null
        });
        this.sendMessageToAgent(message.from, response);
    }
    async sendMessageToAgent(targetAgent, message) {
        try {
            await this.communication.sendMessage(targetAgent, message.action, message);
        }
        catch (error) {
            utils_1.LoggerUtils.error(`Failed to send message to ${targetAgent}`, { error });
        }
    }
    assignTasks() {
        if (this.taskQueue.length === 0)
            return;
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
    findBestAgentForTask(task) {
        const targetType = config_1.TASK_ROUTES[task.type];
        if (!targetType)
            return null;
        // 找到能够处理该任务类型的代理
        const capableAgents = Array.from(this.connectedAgents.values()).filter(agent => {
            return agent.capabilities.includes(task.type) &&
                agent.status === 'running' &&
                agent.agent_name.includes(targetType);
        });
        if (capableAgents.length === 0)
            return null;
        // 选择负载最低的代理
        return capableAgents.reduce((best, current) => {
            const bestLoad = this.getAgentLoad(best.agent_name);
            const currentLoad = this.getAgentLoad(current.agent_name);
            return currentLoad < bestLoad ? current : best;
        }).agent_name;
    }
    getAgentLoad(agentName) {
        return Array.from(this.activeTasks.values()).filter(task => task.assigned_agent === agentName).length;
    }
    async assignTaskToAgent(task, agentName) {
        task.assigned_agent = agentName;
        task.status = 'assigned';
        task.assigned_at = Date.now();
        const message = utils_1.MessageUtils.createMessage(this.config.agent_name, agentName, 'request', 'execute_task', task);
        try {
            await this.communication.sendMessage(agentName, 'execute_task', task);
            utils_1.LoggerUtils.info(`Task assigned to ${agentName}: ${task.id}`);
        }
        catch (error) {
            utils_1.LoggerUtils.error(`Failed to assign task to ${agentName}`, { error });
            task.status = 'failed';
            this.activeTasks.delete(task.id);
        }
    }
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            this.checkAgentHealth();
        }, config_1.HEALTH_CHECK_INTERVAL);
    }
    async checkAgentHealth() {
        const deadAgents = [];
        for (const [agentName, status] of this.connectedAgents) {
            try {
                const response = await fetch(`http://localhost:${status.port}/health`);
                if (!response.ok) {
                    deadAgents.push(agentName);
                }
            }
            catch (error) {
                deadAgents.push(agentName);
            }
        }
        // 移除死亡的代理
        deadAgents.forEach(agentName => {
            this.connectedAgents.delete(agentName);
            utils_1.LoggerUtils.warn(`Agent ${agentName} is dead, removed from pool`);
            // 重新分配该代理的任务
            this.reassignAgentTasks(agentName);
        });
    }
    reassignAgentTasks(agentName) {
        const tasksToReassign = Array.from(this.activeTasks.values()).filter(task => task.assigned_agent === agentName);
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
    async start() {
        utils_1.LoggerUtils.info(`Starting Coordinator Agent on port ${this.config.port}`);
        // 启动通信服务
        this.communication.start();
        // 启动健康检查
        this.startHealthCheck();
        // 注册自身状态
        const selfStatus = utils_1.AgentUtils.createAgentStatus(this.config.agent_name, this.config.port, this.config.capabilities);
        this.connectedAgents.set(this.config.agent_name, selfStatus);
        utils_1.LoggerUtils.info('Coordinator Agent started successfully');
    }
    async stop() {
        utils_1.LoggerUtils.info('Stopping Coordinator Agent');
        // 停止健康检查
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        // 停止通信服务
        this.communication.stop();
        utils_1.LoggerUtils.info('Coordinator Agent stopped');
    }
    getStatus() {
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
exports.CoordinatorAgent = CoordinatorAgent;
//# sourceMappingURL=index.js.map