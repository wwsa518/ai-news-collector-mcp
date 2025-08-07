// RSS采集器
import axios from 'axios';
import { NewsItem } from '../../../shared/types';
import { LoggerUtils } from '../../../shared/utils';

export interface RSSSourceConfig {
  url: string;
  name: string;
  category?: string;
  language?: string;
  update_frequency?: number;
  max_items?: number;
  user_agent?: string;
}

export interface RSSCollectorResult {
  source: string;
  items: NewsItem[];
  collected_count: number;
  processing_time: number;
  error?: string;
}

export class RSSCollector {
  private userAgent: string;
  private timeout: number;

  constructor(userAgent: string = 'AI-News-Collector/1.0', timeout: number = 30000) {
    this.userAgent = userAgent;
    this.timeout = timeout;
  }

  async collectFromSource(config: RSSSourceConfig): Promise<RSSCollectorResult> {
    const startTime = Date.now();
    
    try {
      LoggerUtils.info('Starting RSS collection', { source: config.name, url: config.url });
      
      // 获取RSS内容
      const response = await axios.get(config.url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': config.user_agent || this.userAgent,
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
        validateStatus: (status) => status < 500
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 解析RSS内容
      const rssContent = response.data;
      const newsItems = await this.parseRSSContent(rssContent, config);
      
      const processingTime = Date.now() - startTime;
      
      // 限制条目数量
      const limitedItems = config.max_items 
        ? newsItems.slice(0, config.max_items) 
        : newsItems;
      
      LoggerUtils.info('RSS collection completed', {
        source: config.name,
        collected_count: limitedItems.length,
        processing_time
      });

      return {
        source: config.name,
        items: limitedItems,
        collected_count: limitedItems.length,
        processing_time: processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      LoggerUtils.error('RSS collection failed', {
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

  private async parseRSSContent(content: string, config: RSSSourceConfig): Promise<NewsItem[]> {
    try {
      // 简单的RSS解析实现
      const items: NewsItem[] = [];
      
      // 提取item标签
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const itemMatches = content.match(itemRegex);
      
      if (!itemMatches) {
        LoggerUtils.warn('No items found in RSS content', { source: config.name });
        return items;
      }

      for (const itemMatch of itemMatches) {
        try {
          const newsItem = this.parseRSSItem(itemMatch, config);
          if (newsItem) {
            items.push(newsItem);
          }
        } catch (error) {
          LoggerUtils.warn('Failed to parse RSS item', { 
            source: config.name, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return items;
    } catch (error) {
      LoggerUtils.error('Failed to parse RSS content', { 
        source: config.name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  private parseRSSItem(itemContent: string, config: RSSSourceConfig): NewsItem | null {
    try {
      // 提取标题
      const titleMatch = itemContent.match(/<title>(.*?)<\/title>/s);
      const title = titleMatch ? this.cleanHTML(titleMatch[1]) : '';
      
      if (!title) {
        return null;
      }

      // 提取链接
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/s);
      const url = linkMatch ? this.cleanHTML(linkMatch[1]) : '';
      
      if (!url) {
        return null;
      }

      // 提取描述
      const descriptionMatch = itemContent.match(/<description>(.*?)<\/description>/s);
      const content = descriptionMatch ? this.cleanHTML(descriptionMatch[1]) : '';

      // 提取发布时间
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/s);
      const publishTime = pubDateMatch ? new Date(this.cleanHTML(pubDateMatch[1])) : new Date();

      // 生成唯一ID
      const id = `rss_${config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        id,
        title,
        content,
        url,
        source: config.name,
        publish_time: publishTime,
        collected_at: new Date(),
        raw_data: {
          source_config: config,
          raw_content: itemContent,
          category: config.category,
          language: config.language
        }
      };
    } catch (error) {
      LoggerUtils.error('Failed to parse RSS item', { 
        source: config.name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  private cleanHTML(html: string): string {
    return html
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  async validateRSSSource(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        headers: {
          'User-Agent': this.userAgent,
        }
      });

      const contentType = response.headers['content-type'] || '';
      return contentType.includes('rss') || contentType.includes('xml') || response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async testRSSSource(config: RSSSourceConfig): Promise<RSSCollectorResult> {
    // 限制测试时的条目数量
    const testConfig = { ...config, max_items: 3 };
    return await this.collectFromSource(testConfig);
  }
}