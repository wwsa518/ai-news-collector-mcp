// 网页采集器
import axios from 'axios';
import { NewsItem } from '../../../shared/types';
import { LoggerUtils } from '../../../shared/utils';

export interface WebSourceConfig {
  url: string;
  name: string;
  selectors?: {
    title?: string;
    content?: string;
    link?: string;
    date?: string;
    author?: string;
  };
  category?: string;
  language?: string;
  update_frequency?: number;
  max_items?: number;
  user_agent?: string;
  headers?: Record<string, string>;
  proxy?: string;
}

export interface WebCollectorResult {
  source: string;
  items: NewsItem[];
  collected_count: number;
  processing_time: number;
  error?: string;
}

export class WebCollector {
  private userAgent: string;
  private timeout: number;

  constructor(userAgent: string = 'AI-News-Collector/1.0', timeout: number = 30000) {
    this.userAgent = userAgent;
    this.timeout = timeout;
  }

  async collectFromSource(config: WebSourceConfig): Promise<WebCollectorResult> {
    const startTime = Date.now();
    
    try {
      LoggerUtils.info('Starting web collection', { source: config.name, url: config.url });
      
      // 获取网页内容
      const response = await this.fetchWebPage(config);
      
      const processingTime = Date.now() - startTime;
      
      // 解析网页内容
      const newsItems = await this.parseWebContent(response.data, config);
      
      // 限制条目数量
      const limitedItems = config.max_items 
        ? newsItems.slice(0, config.max_items) 
        : newsItems;
      
      LoggerUtils.info('Web collection completed', {
        source: config.name,
        collected_count: limitedItems.length,
        processing_time: processingTime
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
      
      LoggerUtils.error('Web collection failed', {
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

  private async fetchWebPage(config: WebSourceConfig) {
    const headers: Record<string, string> = {
      'User-Agent': config.user_agent || this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      ...config.headers
    };

    const response = await axios.get(config.url, {
      timeout: this.timeout,
      headers,
      validateStatus: (status) => status < 500,
      responseType: 'text'
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  private async parseWebContent(html: string, config: WebSourceConfig): Promise<NewsItem[]> {
    try {
      const items: NewsItem[] = [];
      
      // 使用配置的选择器或自动检测
      const selectors = config.selectors || this.autoDetectSelectors(html);
      
      // 提取新闻项
      const newsItemsData = this.extractNewsItems(html, selectors);
      
      for (const itemData of newsItemsData) {
        try {
          const newsItem = this.createNewsItem(itemData, config);
          if (newsItem) {
            items.push(newsItem);
          }
        } catch (error) {
          LoggerUtils.warn('Failed to create news item from web data', { 
            source: config.name, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return items;
    } catch (error) {
      LoggerUtils.error('Failed to parse web content', { 
        source: config.name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  private autoDetectSelectors(html: string): Record<string, string> {
    // 简单的自动检测选择器逻辑
    const selectors: Record<string, string> = {
      title: 'title, h1, h2, h3, .title, .headline, [class*="title"]',
      content: 'p, .content, .article, .text, [class*="content"]',
      link: 'a, .link, [href]',
      date: 'time, .date, .time, [datetime], [class*="date"]'
    };

    // 检测新闻列表项
    if (html.includes('article')) {
      selectors.content = 'article';
    } else if (html.includes('news-item')) {
      selectors.content = '.news-item';
    } else if (html.includes('post')) {
      selectors.content = '.post';
    }

    return selectors;
  }

  private extractNewsItems(html: string, selectors: Record<string, string>): any[] {
    const items: any[] = [];
    
    try {
      // 简化的HTML解析实现
      // 在实际项目中，应该使用cheerio或jsdom等库
      
      // 提取标题
      const titleRegex = new RegExp(`<(${selectors.title.replace(/,/g, '|')})[^>]*>(.*?)</\\1>`, 'gis');
      const titleMatches = [...html.matchAll(titleRegex)];
      
      // 提取链接
      const linkRegex = /href="([^"]*?)"/gi;
      const linkMatches = [...html.matchAll(linkRegex)];
      
      // 提取内容段落
      const contentRegex = /<p[^>]*>(.*?)<\/p>/gis;
      const contentMatches = [...html.matchAll(contentRegex)];
      
      // 组合数据
      const maxItems = Math.min(titleMatches.length, linkMatches.length, contentMatches.length);
      
      for (let i = 0; i < maxItems; i++) {
        items.push({
          title: this.cleanHTML(titleMatches[i]?.[2] || ''),
          url: this.resolveURL(linkMatches[i]?.[1] || ''),
          content: this.cleanHTML(contentMatches[i]?.[1] || ''),
          raw_html: titleMatches[i]?.[0] || ''
        });
      }
      
    } catch (error) {
      LoggerUtils.error('Failed to extract news items', { error });
    }
    
    return items;
  }

  private createNewsItem(itemData: any, config: WebSourceConfig): NewsItem | null {
    try {
      const { title, url, content } = itemData;
      
      if (!title || !url) {
        return null;
      }

      // 生成唯一ID
      const id = `web_${config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        id,
        title,
        content: content || '',
        url,
        source: config.name,
        publish_time: new Date(),
        collected_at: new Date(),
        raw_data: {
          source_config: config,
          raw_html: itemData.raw_html || '',
          category: config.category,
          language: config.language
        }
      };
    } catch (error) {
      LoggerUtils.error('Failed to create news item', { 
        source: config.name, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  private cleanHTML(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveURL(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    return url;
  }

  async validateWebSource(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        headers: {
          'User-Agent': this.userAgent,
        }
      });

      const contentType = response.headers['content-type'] || '';
      return contentType.includes('html') || response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async testWebSource(config: WebSourceConfig): Promise<WebCollectorResult> {
    // 限制测试时的条目数量
    const testConfig = { ...config, max_items: 3 };
    return await this.collectFromSource(testConfig);
  }
}