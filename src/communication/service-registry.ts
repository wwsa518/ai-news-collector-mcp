// 服务发现和注册中心
import { AgentStatus, AgentMessage } from '../types';
import { LoggerUtils } from '../utils';

export interface ServiceRegistryConfig {
  heartbeat_interval: number;
  heartbeat_timeout: number;
  cleanup_interval: number;
  enable_health_checks: boolean;
  health_check_timeout: number;
}

export interface ServiceInstance {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  capabilities: string[];
  metadata: Record<string, any>;
  last_heartbeat: number;
  registered_at: number;
  health_check_url?: string;
  version?: string;
  tags: string[];
}

export interface ServiceQuery {
  name?: string;
  type?: string;
  capability?: string;
  tag?: string;
  status?: 'healthy' | 'unhealthy' | 'unknown';
  metadata?: Record<string, any>;
}

export class ServiceRegistry {
  private services: Map<string, ServiceInstance> = new Map();
  private config: ServiceRegistryConfig;
  private logger = LoggerUtils;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(config: ServiceRegistryConfig) {
    this.config = config;
    this.startPeriodicTasks();
  }

  // 注册服务
  public register(service: Omit<ServiceInstance, 'id' | 'registered_at' | 'last_heartbeat'>): string {
    const serviceId = this.generateServiceId(service.name, service.host, service.port);
    const existingService = this.services.get(serviceId);

    const serviceInstance: ServiceInstance = {
      ...service,
      id: serviceId,
      status: 'healthy',
      registered_at: Date.now(),
      last_heartbeat: Date.now()
    };

    this.services.set(serviceId, serviceInstance);

    if (existingService) {
      this.emit('service_updated', serviceInstance);
      this.logger.info('Service updated', { service_id: serviceId, name: service.name });
    } else {
      this.emit('service_registered', serviceInstance);
      this.logger.info('Service registered', { service_id: serviceId, name: service.name });
    }

    return serviceId;
  }

  // 注销服务
  public unregister(serviceId: string): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    this.services.delete(serviceId);
    this.emit('service_unregistered', service);
    this.logger.info('Service unregistered', { service_id: serviceId, name: service.name });

    return true;
  }

  // 更新心跳
  public heartbeat(serviceId: string, status?: 'healthy' | 'unhealthy'): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    const oldStatus = service.status;
    service.last_heartbeat = Date.now();
    if (status) {
      service.status = status;
    }

    if (oldStatus !== service.status) {
      this.emit('service_status_changed', service, oldStatus);
      this.logger.info('Service status changed', { 
        service_id: serviceId, 
        old_status: oldStatus, 
        new_status: service.status 
      });
    }

    return true;
  }

  // 查询服务
  public query(query: ServiceQuery): ServiceInstance[] {
    return Array.from(this.services.values()).filter(service => {
      if (query.name && service.name !== query.name) return false;
      if (query.type && service.type !== query.type) return false;
      if (query.capability && !service.capabilities.includes(query.capability)) return false;
      if (query.tag && !service.tags.includes(query.tag)) return false;
      if (query.status && service.status !== query.status) return false;
      
      if (query.metadata) {
        for (const [key, value] of Object.entries(query.metadata)) {
          if (service.metadata[key] !== value) return false;
        }
      }

      return true;
    });
  }

  // 获取服务
  public getService(serviceId: string): ServiceInstance | null {
    return this.services.get(serviceId) || null;
  }

  // 获取所有服务
  public getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values());
  }

  // 按类型获取服务
  public getServicesByType(type: string): ServiceInstance[] {
    return Array.from(this.services.values()).filter(service => service.type === type);
  }

  // 按能力获取服务
  public getServicesByCapability(capability: string): ServiceInstance[] {
    return Array.from(this.services.values()).filter(service => 
      service.capabilities.includes(capability)
    );
  }

  // 获取健康的服务
  public getHealthyServices(): ServiceInstance[] {
    return Array.from(this.services.values()).filter(service => service.status === 'healthy');
  }

  // 选择服务（负载均衡）
  public selectService(query: ServiceQuery, strategy: 'random' | 'round-robin' | 'least-loaded' = 'random'): ServiceInstance | null {
    const candidates = this.query(query);
    if (candidates.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'random':
        return candidates[Math.floor(Math.random() * candidates.length)];
      
      case 'round-robin':
        // 简化的轮询实现
        const index = Math.floor(Date.now() / 1000) % candidates.length;
        return candidates[index];
      
      case 'least-loaded':
        // 这里应该根据实际负载选择，现在简化为随机
        return candidates[Math.floor(Math.random() * candidates.length)];
      
      default:
        return candidates[0];
    }
  }

  // 更新服务元数据
  public updateMetadata(serviceId: string, metadata: Record<string, any>): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    const oldMetadata = { ...service.metadata };
    service.metadata = { ...service.metadata, ...metadata };

    this.emit('service_metadata_updated', service, oldMetadata);
    this.logger.info('Service metadata updated', { service_id: serviceId });

    return true;
  }

  // 添加标签
  public addTag(serviceId: string, tag: string): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    if (!service.tags.includes(tag)) {
      service.tags.push(tag);
      this.emit('service_tag_added', service, tag);
      this.logger.info('Service tag added', { service_id: serviceId, tag });
    }

    return true;
  }

  // 移除标签
  public removeTag(serviceId: string, tag: string): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    const index = service.tags.indexOf(tag);
    if (index !== -1) {
      service.tags.splice(index, 1);
      this.emit('service_tag_removed', service, tag);
      this.logger.info('Service tag removed', { service_id: serviceId, tag });
    }

    return true;
  }

  // 获取统计信息
  public getStats(): any {
    const services = Array.from(this.services.values());
    const byType = new Map<string, number>();
    const byStatus = new Map<string, number>();

    for (const service of services) {
      byType.set(service.type, (byType.get(service.type) || 0) + 1);
      byStatus.set(service.status, (byStatus.get(service.status) || 0) + 1);
    }

    return {
      total_services: services.length,
      by_type: Object.fromEntries(byType),
      by_status: Object.fromEntries(byStatus),
      average_uptime: this.calculateAverageUptime(),
      top_capabilities: this.getTopCapabilities()
    };
  }

  // 健康检查
  public async performHealthChecks(): Promise<void> {
    if (!this.config.enable_health_checks) {
      return;
    }

    const services = Array.from(this.services.values());
    const promises = services.map(service => this.checkServiceHealth(service));

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      this.logger.error('Error during health checks', { error });
    }
  }

  private async checkServiceHealth(service: ServiceInstance): Promise<void> {
    if (!service.health_check_url) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.health_check_timeout);

      const response = await fetch(service.health_check_url, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;
      const newStatus = isHealthy ? 'healthy' : 'unhealthy';
      
      if (service.status !== newStatus) {
        this.heartbeat(service.id, newStatus);
      }
    } catch (error) {
      if (service.status !== 'unhealthy') {
        this.heartbeat(service.id, 'unhealthy');
      }
      this.logger.warn('Health check failed', { service_id: service.id, error });
    }
  }

  // 清理过期服务
  private cleanupExpiredServices(): void {
    const now = Date.now();
    const expiredServices: string[] = [];

    for (const [serviceId, service] of this.services) {
      if (now - service.last_heartbeat > this.config.heartbeat_timeout) {
        expiredServices.push(serviceId);
      }
    }

    for (const serviceId of expiredServices) {
      const service = this.services.get(serviceId);
      if (service) {
        this.services.delete(serviceId);
        this.emit('service_expired', service);
        this.logger.warn('Service expired', { service_id: serviceId, name: service.name });
      }
    }

    if (expiredServices.length > 0) {
      this.logger.info('Cleaned up expired services', { count: expiredServices.length });
    }
  }

  // 启动周期性任务
  private startPeriodicTasks(): void {
    // 心跳监控
    this.heartbeatInterval = setInterval(() => {
      this.cleanupExpiredServices();
    }, this.config.cleanup_interval);

    // 健康检查
    if (this.config.enable_health_checks) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthChecks();
      }, this.config.heartbeat_interval);
    }

    this.logger.info('Service registry periodic tasks started');
  }

  // 停止周期性任务
  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.logger.info('Service registry stopped');
  }

  // 事件处理
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          this.logger.error('Event handler error', { event, error });
        }
      });
    }
  }

  // 工具方法
  private generateServiceId(name: string, host: string, port: number): string {
    return `${name}-${host}-${port}-${Date.now()}`;
  }

  private calculateAverageUptime(): number {
    const now = Date.now();
    const services = Array.from(this.services.values());
    
    if (services.length === 0) {
      return 0;
    }

    const totalUptime = services.reduce((sum, service) => {
      return sum + (now - service.registered_at);
    }, 0);

    return totalUptime / services.length;
  }

  private getTopCapabilities(): Array<{ capability: string; count: number }> {
    const capabilityCount = new Map<string, number>();
    
    for (const service of this.services.values()) {
      for (const capability of service.capabilities) {
        capabilityCount.set(capability, (capabilityCount.get(capability) || 0) + 1);
      }
    }

    return Array.from(capabilityCount.entries())
      .map(([capability, count]) => ({ capability, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

// 服务发现客户端
export class ServiceDiscovery {
  private registry: ServiceRegistry;
  private localCache: Map<string, ServiceInstance[]> = new Map();
  private cacheTimeout: number;
  private logger = LoggerUtils;

  constructor(registry: ServiceRegistry, cacheTimeout: number = 30000) {
    this.registry = registry;
    this.cacheTimeout = cacheTimeout;
  }

  // 发现服务
  public async discover(query: ServiceQuery, useCache: boolean = true): Promise<ServiceInstance[]> {
    const cacheKey = this.generateCacheKey(query);
    
    if (useCache) {
      const cached = this.localCache.get(cacheKey);
      if (cached && Date.now() - cached[0].last_heartbeat < this.cacheTimeout) {
        return cached;
      }
    }

    const services = this.registry.query(query);
    this.localCache.set(cacheKey, services);

    return services;
  }

  // 发现健康的服务
  public async discoverHealthy(query: ServiceQuery): Promise<ServiceInstance[]> {
    const healthyQuery = { ...query, status: 'healthy' as const };
    return await this.discover(healthyQuery);
  }

  // 选择服务
  public async selectService(query: ServiceQuery, strategy: 'random' | 'round-robin' | 'least-loaded' = 'random'): Promise<ServiceInstance | null> {
    const services = await this.discoverHealthy(query);
    if (services.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'random':
        return services[Math.floor(Math.random() * services.length)];
      
      case 'round-robin':
        const index = Math.floor(Date.now() / 1000) % services.length;
        return services[index];
      
      case 'least-loaded':
        // 简化实现，实际应该根据服务负载
        return services[Math.floor(Math.random() * services.length)];
      
      default:
        return services[0];
    }
  }

  // 监听服务变化
  public onServiceChanged(callback: (services: ServiceInstance[]) => void): void {
    this.registry.on('service_registered', () => {
      callback(this.registry.getAllServices());
    });

    this.registry.on('service_unregistered', () => {
      callback(this.registry.getAllServices());
    });

    this.registry.on('service_status_changed', () => {
      callback(this.registry.getAllServices());
    });
  }

  // 清除缓存
  public clearCache(): void {
    this.localCache.clear();
  }

  private generateCacheKey(query: ServiceQuery): string {
    return JSON.stringify({
      name: query.name,
      type: query.type,
      capability: query.capability,
      tag: query.tag,
      status: query.status,
      metadata: query.metadata
    });
  }
}