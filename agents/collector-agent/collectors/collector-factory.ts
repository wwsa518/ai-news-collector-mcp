// 采集器工厂
import { RSSCollector, RSSSourceConfig } from './rss-collector';
import { WebCollector, WebSourceConfig } from './web-collector';
import { APICollector, APISourceConfig } from './api-collector';
import { LoggerUtils } from '../../../shared/utils';

export interface CollectorConfig {
  type: 'rss' | 'web' | 'api';
  name: string;
  enabled: boolean;
  priority: number;
  schedule?: string;
  config: RSSSourceConfig | WebSourceConfig | APISourceConfig;
}

export interface CollectorResult {
  source: string;
  type: string;
  items: any[];
  collected_count: number;
  processing_time: number;
  error?: string;
  metadata?: any;
}

export abstract class BaseCollector {
  abstract collect(config: any): Promise<CollectorResult>;
  abstract validate(config: any): Promise<boolean>;
  abstract test(config: any): Promise<CollectorResult>;
}

export class CollectorFactory {
  private collectors: Map<string, BaseCollector> = new Map();

  constructor() {
    this.registerCollectors();
  }

  private registerCollectors(): void {
    // 注册RSS采集器
    this.collectors.set('rss', new RSSCollectorWrapper());
    
    // 注册网页采集器
    this.collectors.set('web', new WebCollectorWrapper());
    
    // 注册API采集器
    this.collectors.set('api', new APICollectorWrapper());
  }

  getCollector(type: string): BaseCollector | null {
    return this.collectors.get(type) || null;
  }

  getAvailableTypes(): string[] {
    return Array.from(this.collectors.keys());
  }

  async collect(config: CollectorConfig): Promise<CollectorResult> {
    const collector = this.getCollector(config.type);
    if (!collector) {
      return {
        source: config.name,
        type: config.type,
        items: [],
        collected_count: 0,
        processing_time: 0,
        error: `Unknown collector type: ${config.type}`
      };
    }

    try {
      LoggerUtils.info('Starting collection', { 
        source: config.name, 
        type: config.type 
      });
      
      const result = await collector.collect(config.config);
      
      LoggerUtils.info('Collection completed', {
        source: config.name,
        type: config.type,
        collected_count: result.collected_count,
        processing_time: result.processing_time
      });

      return {
        ...result,
        source: config.name,
        type: config.type
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      LoggerUtils.error('Collection failed', {
        source: config.name,
        type: config.type,
        error: errorMessage
      });

      return {
        source: config.name,
        type: config.type,
        items: [],
        collected_count: 0,
        processing_time: 0,
        error: errorMessage
      };
    }
  }

  async validate(config: CollectorConfig): Promise<boolean> {
    const collector = this.getCollector(config.type);
    if (!collector) {
      return false;
    }

    try {
      return await collector.validate(config.config);
    } catch (error) {
      LoggerUtils.error('Validation failed', {
        source: config.name,
        type: config.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async test(config: CollectorConfig): Promise<CollectorResult> {
    const collector = this.getCollector(config.type);
    if (!collector) {
      return {
        source: config.name,
        type: config.type,
        items: [],
        collected_count: 0,
        processing_time: 0,
        error: `Unknown collector type: ${config.type}`
      };
    }

    try {
      LoggerUtils.info('Testing collector', { 
        source: config.name, 
        type: config.type 
      });
      
      const result = await collector.test(config.config);
      
      LoggerUtils.info('Test completed', {
        source: config.name,
        type: config.type,
        collected_count: result.collected_count,
        processing_time: result.processing_time
      });

      return {
        ...result,
        source: config.name,
        type: config.type
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      LoggerUtils.error('Test failed', {
        source: config.name,
        type: config.type,
        error: errorMessage
      });

      return {
        source: config.name,
        type: config.type,
        items: [],
        collected_count: 0,
        processing_time: 0,
        error: errorMessage
      };
    }
  }
}

// RSS采集器包装器
class RSSCollectorWrapper extends BaseCollector {
  private rssCollector: RSSCollector;

  constructor() {
    super();
    this.rssCollector = new RSSCollector();
  }

  async collect(config: RSSSourceConfig): Promise<CollectorResult> {
    const result = await this.rssCollector.collectFromSource(config);
    return {
      source: result.source,
      type: 'rss',
      items: result.items,
      collected_count: result.collected_count,
      processing_time: result.processing_time,
      error: result.error
    };
  }

  async validate(config: RSSSourceConfig): Promise<boolean> {
    return await this.rssCollector.validateRSSSource(config.url);
  }

  async test(config: RSSSourceConfig): Promise<CollectorResult> {
    const result = await this.rssCollector.testRSSSource(config);
    return {
      source: result.source,
      type: 'rss',
      items: result.items,
      collected_count: result.collected_count,
      processing_time: result.processing_time,
      error: result.error
    };
  }
}

// 网页采集器包装器
class WebCollectorWrapper extends BaseCollector {
  private webCollector: WebCollector;

  constructor() {
    super();
    this.webCollector = new WebCollector();
  }

  async collect(config: WebSourceConfig): Promise<CollectorResult> {
    const result = await this.webCollector.collectFromSource(config);
    return {
      source: result.source,
      type: 'web',
      items: result.items,
      collected_count: result.collected_count,
      processing_time: result.processing_time,
      error: result.error
    };
  }

  async validate(config: WebSourceConfig): Promise<boolean> {
    return await this.webCollector.validateWebSource(config.url);
  }

  async test(config: WebSourceConfig): Promise<CollectorResult> {
    const result = await this.webCollector.testWebSource(config);
    return {
      source: result.source,
      type: 'web',
      items: result.items,
      collected_count: result.collected_count,
      processing_time: result.processing_time,
      error: result.error
    };
  }
}

// API采集器包装器
class APICollectorWrapper extends BaseCollector {
  private apiCollector: APICollector;

  constructor() {
    super();
    this.apiCollector = new APICollector();
  }

  async collect(config: APISourceConfig): Promise<CollectorResult> {
    const result = await this.apiCollector.collectFromSource(config);
    return {
      source: result.source,
      type: 'api',
      items: result.items,
      collected_count: result.collected_count,
      processing_time: result.processing_time,
      error: result.error,
      metadata: {
        rate_limit_remaining: result.rate_limit_remaining
      }
    };
  }

  async validate(config: APISourceConfig): Promise<boolean> {
    return await this.apiCollector.validateAPISource(config);
  }

  async test(config: APISourceConfig): Promise<CollectorResult> {
    const result = await this.apiCollector.testAPISource(config);
    return {
      source: result.source,
      type: 'api',
      items: result.items,
      collected_count: result.collected_count,
      processing_time: result.processing_time,
      error: result.error,
      metadata: {
        rate_limit_remaining: result.rate_limit_remaining
      }
    };
  }
}