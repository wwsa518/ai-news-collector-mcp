// API采集器
import axios from 'axios';
import { NewsItem } from '../../../shared/types';
import { LoggerUtils } from '../../../shared/utils';

export interface APISourceConfig {
  url: string;
  name: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apikey?: string;
    header?: string;
  };
  response_path?: string; // JSON路径，例如 'data.items'
  mapping?: {
    title?: string;
    content?: string;
    url?: string;
    date?: string;
    author?: string;
    id?: string;
  };
  category?: string;
  language?: string;
  update_frequency?: number;
  max_items?: number;
  rate_limit?: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
}

export interface APICollectorResult {
  source: string;
  items: NewsItem[];
  collected_count: number;
  processing_time: number;
  error?: string;
  rate_limit_remaining?: {
    per_minute: number;
    per_hour: number;
  };
}

export class APICollector {
  private userAgent: string;
  private timeout: number;
  private rateLimiter: Map<string, { minute: number[]; hour: number[] }> = new Map();

  constructor(userAgent: string = 'AI-News-Collector/1.0', timeout: number = 30000) {
    this.userAgent = userAgent;
    this.timeout = timeout;
  }

  async collectFromSource(config: APISourceConfig): Promise<APICollectorResult> {
    const startTime = Date.now();
    
    try {
      LoggerUtils.info('Starting API collection', { source: config.name, url: config.url });
      
      // 检查速率限制
      if (!this.checkRateLimit(config.name, config.rate_limit)) {
        throw new Error('Rate limit exceeded');
      }
      
      // 获取API数据
      const response = await this.fetchAPI(config);
      
      const processingTime = Date.now() - startTime;
      
      // 解析API响应
      const newsItems = await this.parseAPIResponse(response.data, config);
      
      // 限制条目数量
      const limitedItems = config.max_items 
        ? newsItems.slice(0, config.max_items) 
        : newsItems;

      // 记录速率限制
      this.recordRateLimit(config.name);
      const rateLimitRemaining = this.getRateLimitRemaining(config.name, config.rate_limit);
      
      LoggerUtils.info('API collection completed', {
        source: config.name,
        collected_count: limitedItems.length,
        processing_time: processingTime,
        rate_limit_remaining: rateLimitRemaining
      });

      return {
        source: config.name,
        items: limitedItems,
        collected_count: limitedItems.length,
        processing_time: processingTime,
        rate_limit_remaining: rateLimitRemaining
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      LoggerUtils.error('API collection failed', {
        source: config.name,
        error: errorMessage,
        processing_time: processingTime
      });

      return {
        source: config.name,
        items: [],
        collected_count: 0,
        processing_time: processingTime,
        error: errorMessage
      };
    }
  }

  private async fetchAPI(config: APISourceConfig) {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...config.headers
    };

    // 添加认证
    if (config.auth) {
      this.addAuthHeaders(headers, config.auth);
    }

    const requestConfig: any = {
      method: config.method || 'GET',
      url: config.url,
      timeout: this.timeout,
      headers,
      validateStatus: (status) => status < 500
    };

    if (config.params) {
      requestConfig.params = config.params;
    }

    if (config.data && (config.method === 'POST' || config.method === 'PUT')) {
      requestConfig.data = config.data;
    }

    const response = await axios(requestConfig);

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  private addAuthHeaders(headers: Record<string, string>, auth: APISourceConfig['auth']): void {
    if (!auth) return;

    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }
        break;
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'apikey':
        if (auth.apikey && auth.header) {
          headers[auth.header] = auth.apikey;
        }
        break;
    }
  }

  private async parseAPIResponse(responseData: any, config: APISourceConfig): Promise<NewsItem[]> {
    try {
      const items: NewsItem[] = [];
      
      // 提取数据项
      let dataItems = responseData;
      if (config.response_path) {
        dataItems = this.extractDataByPath(responseData, config.response_path);
      }

      // 确保数据是数组
      if (!Array.isArray(dataItems)) {
        if (typeof dataItems === 'object' && dataItems !== null) {
          dataItems = [dataItems];
        } else {
          LoggerUtils.warn('API response is not an array or object', { source: config.name });
          return [];
        }
      }

      // 默认映射
      const mapping = config.mapping || {
        title: 'title',
        content: 'content',
        url: 'url',
        date: 'publishedAt',
        id: 'id'
      };

      // 处理每个数据项
      for (const itemData of dataItems) {
        try {
          const newsItem = this.createNewsItemFromAPI(itemData, mapping, config);
          if (newsItem) {
            items.push(newsItem);
          }
        } catch (error) {
          LoggerUtils.warn('Failed to create news item from API data', { 
            source: config.name, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return items;
    } catch (error) {
      LoggerUtils.error('Failed to parse API response', { 
        source: config.name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  private extractDataByPath(data: any, path: string): any {
    const keys = path.split('.');
    let result = data;
    
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        LoggerUtils.warn('Path not found in API response', { source: path, key });
        return data;
      }
    }
    
    return result;
  }

  private createNewsItemFromAPI(itemData: any, mapping: Record<string, string>, config: APISourceConfig): NewsItem | null {
    try {
      const title = this.extractFieldValue(itemData, mapping.title || 'title');
      const url = this.extractFieldValue(itemData, mapping.url || 'url');
      
      if (!title || !url) {
        return null;
      }

      const content = this.extractFieldValue(itemData, mapping.content || 'content') || '';
      const dateStr = this.extractFieldValue(itemData, mapping.date || 'publishedAt') || '';
      const id = this.extractFieldValue(itemData, mapping.id || 'id') || '';

      // 解析日期
      const publishTime = dateStr ? new Date(dateStr) : new Date();
      if (isNaN(publishTime.getTime())) {
        LoggerUtils.warn('Invalid date format, using current time', { 
          source: config.name, 
          date: dateStr 
        });
      }

      // 生成唯一ID
      const itemId = id || `api_${config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        id: itemId,
        title,
        content,
        url,
        source: config.name,
        publish_time: publishTime,
        collected_at: new Date(),
        raw_data: {
          source_config: config,
          api_response: itemData,
          category: config.category,
          language: config.language
        }
      };
    } catch (error) {
      LoggerUtils.error('Failed to create news item from API data', { 
        source: config.name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  private extractFieldValue(data: any, fieldPath: string): string {
    if (!data || !fieldPath) return '';
    
    // 处理嵌套字段路径，例如 'author.name'
    const keys = fieldPath.split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return '';
      }
    }
    
    return String(value || '').trim();
  }

  private checkRateLimit(sourceName: string, rateLimit?: APISourceConfig['rate_limit']): boolean {
    if (!rateLimit) return true;

    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    const limits = this.rateLimiter.get(sourceName) || { minute: [], hour: [] };
    
    // 检查每分钟限制
    const recentMinuteRequests = limits.minute.filter(time => time > minuteAgo);
    if (recentMinuteRequests.length >= (rateLimit.requests_per_minute || 60)) {
      return false;
    }
    
    // 检查每小时限制
    const recentHourRequests = limits.hour.filter(time => time > hourAgo);
    if (recentHourRequests.length >= (rateLimit.requests_per_hour || 1000)) {
      return false;
    }
    
    return true;
  }

  private recordRateLimit(sourceName: string): void {
    const now = Date.now();
    const limits = this.rateLimiter.get(sourceName) || { minute: [], hour: [] };
    
    limits.minute.push(now);
    limits.hour.push(now);
    
    // 清理过期的记录
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;
    
    limits.minute = limits.minute.filter(time => time > minuteAgo);
    limits.hour = limits.hour.filter(time => time > hourAgo);
    
    this.rateLimiter.set(sourceName, limits);
  }

  private getRateLimitRemaining(sourceName: string, rateLimit?: APISourceConfig['rate_limit']) {
    if (!rateLimit) {
      return { per_minute: -1, per_hour: -1 };
    }

    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    const limits = this.rateLimiter.get(sourceName) || { minute: [], hour: [] };
    
    const recentMinuteRequests = limits.minute.filter(time => time > minuteAgo).length;
    const recentHourRequests = limits.hour.filter(time => time > hourAgo).length;
    
    return {
      per_minute: Math.max(0, (rateLimit.requests_per_minute || 60) - recentMinuteRequests),
      per_hour: Math.max(0, (rateLimit.requests_per_hour || 1000) - recentHourRequests)
    };
  }

  async validateAPISource(config: APISourceConfig): Promise<boolean> {
    try {
      const testConfig = { ...config, max_items: 1 };
      const result = await this.collectFromSource(testConfig);
      return result.collected_count > 0 && !result.error;
    } catch (error) {
      return false;
    }
  }

  async testAPISource(config: APISourceConfig): Promise<APICollectorResult> {
    // 限制测试时的条目数量
    const testConfig = { ...config, max_items: 3 };
    return await this.collectFromSource(testConfig);
  }
}