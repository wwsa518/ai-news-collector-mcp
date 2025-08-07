// 新闻仓库
import { NewsItem, ProcessedNews } from '../../shared/types';
import { LoggerUtils } from '../../shared/utils';

export interface NewsFilter {
  source?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  has_entities?: boolean;
  has_events?: boolean;
  tags?: string[];
}

export interface NewsStats {
  total_news: number;
  by_source: Record<string, number>;
  by_date: Record<string, number>;
  average_sentiment: number;
  sentiment_distribution: Record<string, number>;
  top_entities: Array<{ entity: string; count: number }>;
}

export class NewsRepository {
  private db: any; // 这里应该是数据库连接
  private logger = LoggerUtils;
  private cache: Map<string, NewsItem[]> = new Map();
  private cacheTimeout: number = 300000; // 5分钟缓存

  constructor(db: any) {
    this.db = db;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // 创建新闻表
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS news (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          url TEXT NOT NULL,
          source TEXT NOT NULL,
          publish_time DATETIME NOT NULL,
          collected_at DATETIME NOT NULL,
          raw_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
        CREATE INDEX IF NOT EXISTS idx_news_publish_time ON news(publish_time);
        CREATE INDEX IF NOT EXISTS idx_news_collected_at ON news(collected_at);
      `);

      this.logger.info('News repository initialized');
    } catch (error) {
      this.logger.error('Failed to initialize news repository', { error });
      throw error;
    }
  }

  // 保存新闻
  async save(newsItem: NewsItem): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO news (
          id, title, content, url, source, publish_time, collected_at, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        newsItem.id,
        newsItem.title,
        newsItem.content,
        newsItem.url,
        newsItem.source,
        newsItem.publish_time.toISOString(),
        newsItem.collected_at.toISOString(),
        JSON.stringify(newsItem.raw_data)
      );

      this.clearCache();
      this.logger.debug('News item saved', { news_id: newsItem.id });
    } catch (error) {
      this.logger.error('Failed to save news item', { news_id: newsItem.id, error });
      throw error;
    }
  }

  // 批量保存新闻
  async saveBatch(newsItems: NewsItem[]): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO news (
          id, title, content, url, source, publish_time, collected_at, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((items: NewsItem[]) => {
        for (const item of items) {
          stmt.run(
            item.id,
            item.title,
            item.content,
            item.url,
            item.source,
            item.publish_time.toISOString(),
            item.collected_at.toISOString(),
            JSON.stringify(item.raw_data)
          );
        }
      });

      insertMany(newsItems);
      this.clearCache();
      this.logger.info('Batch news items saved', { count: newsItems.length });
    } catch (error) {
      this.logger.error('Failed to save batch news items', { error });
      throw error;
    }
  }

  // 获取新闻
  async getNews(filter?: NewsFilter): Promise<NewsItem[]> {
    const cacheKey = this.generateCacheKey(filter);
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached[0].collected_at.getTime() < this.cacheTimeout) {
        return cached;
      }
    }

    try {
      let query = 'SELECT * FROM news WHERE 1=1';
      const params: any[] = [];

      if (filter) {
        if (filter.source) {
          query += ' AND source = ?';
          params.push(filter.source);
        }

        if (filter.start_date) {
          query += ' AND publish_time >= ?';
          params.push(filter.start_date.toISOString());
        }

        if (filter.end_date) {
          query += ' AND publish_time <= ?';
          params.push(filter.end_date.toISOString());
        }

        if (filter.limit) {
          query += ' LIMIT ?';
          params.push(filter.limit);
        }

        if (filter.offset) {
          query += ' OFFSET ?';
          params.push(filter.offset);
        }
      }

      query += ' ORDER BY publish_time DESC';

      const rows = this.db.prepare(query).all(...params);
      const newsItems: NewsItem[] = rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        url: row.url,
        source: row.source,
        publish_time: new Date(row.publish_time),
        collected_at: new Date(row.collected_at),
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      }));

      // 缓存结果
      this.cache.set(cacheKey, newsItems);

      return newsItems;
    } catch (error) {
      this.logger.error('Failed to get news', { error });
      throw error;
    }
  }

  // 获取单条新闻
  async getNewsById(id: string): Promise<NewsItem | null> {
    try {
      const row = this.db.prepare('SELECT * FROM news WHERE id = ?').get(id);
      
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        url: row.url,
        source: row.source,
        publish_time: new Date(row.publish_time),
        collected_at: new Date(row.collected_at),
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get news by id', { news_id: id, error });
      throw error;
    }
  }

  // 删除新闻
  async deleteNews(id: string): Promise<boolean> {
    try {
      const result = this.db.prepare('DELETE FROM news WHERE id = ?').run(id);
      this.clearCache();
      
      if (result.changes > 0) {
        this.logger.info('News item deleted', { news_id: id });
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to delete news item', { news_id: id, error });
      throw error;
    }
  }

  // 获取新闻统计
  async getStats(startDate?: Date, endDate?: Date): Promise<NewsStats> {
    try {
      let dateFilter = '';
      const params: any[] = [];

      if (startDate || endDate) {
        dateFilter = ' WHERE ';
        if (startDate) {
          dateFilter += 'publish_time >= ?';
          params.push(startDate.toISOString());
        }
        if (endDate) {
          if (startDate) dateFilter += ' AND ';
          dateFilter += 'publish_time <= ?';
          params.push(endDate.toISOString());
        }
      }

      // 总数
      const totalQuery = `SELECT COUNT(*) as count FROM news${dateFilter}`;
      const totalResult = this.db.prepare(totalQuery).get(...params);
      const totalNews = totalResult.count;

      // 按来源统计
      const sourceQuery = `SELECT source, COUNT(*) as count FROM news${dateFilter} GROUP BY source`;
      const sourceRows = this.db.prepare(sourceQuery).all(...params);
      const bySource = sourceRows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.source] = row.count;
        return acc;
      }, {});

      // 按日期统计
      const dateQuery = `SELECT DATE(publish_time) as date, COUNT(*) as count FROM news${dateFilter} GROUP BY DATE(publish_time)`;
      const dateRows = this.db.prepare(dateQuery).all(...params);
      const byDate = dateRows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.date] = row.count;
        return acc;
      }, {});

      return {
        total_news: totalNews,
        by_source: bySource,
        by_date: byDate,
        average_sentiment: 0, // 需要关联processed_news表
        sentiment_distribution: {},
        top_entities: []
      };
    } catch (error) {
      this.logger.error('Failed to get news stats', { error });
      throw error;
    }
  }

  // 搜索新闻
  async searchNews(query: string, filter?: NewsFilter): Promise<NewsItem[]> {
    try {
      let sqlQuery = 'SELECT * FROM news WHERE (title LIKE ? OR content LIKE ?)';
      const params = [`%${query}%`, `%${query}%`];

      if (filter) {
        if (filter.source) {
          sqlQuery += ' AND source = ?';
          params.push(filter.source);
        }

        if (filter.start_date) {
          sqlQuery += ' AND publish_time >= ?';
          params.push(filter.start_date.toISOString());
        }

        if (filter.end_date) {
          sqlQuery += ' AND publish_time <= ?';
          params.push(filter.end_date.toISOString());
        }
      }

      sqlQuery += ' ORDER BY publish_time DESC';

      if (filter?.limit) {
        sqlQuery += ' LIMIT ?';
        params.push(filter.limit);
      }

      const rows = this.db.prepare(sqlQuery).all(...params);
      
      return rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        url: row.url,
        source: row.source,
        publish_time: new Date(row.publish_time),
        collected_at: new Date(row.collected_at),
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      }));
    } catch (error) {
      this.logger.error('Failed to search news', { query, error });
      throw error;
    }
  }

  // 清理旧新闻
  async cleanup(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = this.db.prepare(
        'DELETE FROM news WHERE publish_time < ?'
      ).run(cutoffDate.toISOString());

      this.clearCache();
      
      this.logger.info('Old news cleaned up', { 
        deleted_count: result.changes,
        cutoff_date: cutoffDate.toISOString()
      });

      return result.changes;
    } catch (error) {
      this.logger.error('Failed to cleanup old news', { error });
      throw error;
    }
  }

  // 获取最近的新闻
  async getRecentNews(limit: number = 10): Promise<NewsItem[]> {
    return this.getNews({ limit });
  }

  // 按来源获取新闻
  async getNewsBySource(source: string, limit?: number): Promise<NewsItem[]> {
    return this.getNews({ source, limit });
  }

  // 按时间范围获取新闻
  async getNewsByDateRange(startDate: Date, endDate: Date, limit?: number): Promise<NewsItem[]> {
    return this.getNews({ start_date: startDate, end_date: endDate, limit });
  }

  private clearCache(): void {
    this.cache.clear();
  }

  private generateCacheKey(filter?: NewsFilter): string {
    return JSON.stringify(filter || {});
  }
}