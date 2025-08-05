// 基础类型定义
export interface SystemConfig {
  nodeEnv: string;
  port: number;
  apiPort: number;
  rsshubUrl: string;
  redis: RedisConfig;
  database: DatabaseConfig;
  pythonService: PythonServiceConfig;
  openaiApiKey?: string;
  logging: LoggingConfig;
  security: SecurityConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  path?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface PythonServiceConfig {
  url: string;
  enabled: boolean;
}

export interface LoggingConfig {
  level: string;
  file?: string;
}

export interface SecurityConfig {
  apiKey: string;
  corsOrigin: string;
}

// 新闻相关类型
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishedAt: Date;
  collectedAt: Date;
  source: string;
  url: string;
  category?: string;
  language?: string;
  sentiment?: SentimentScore;
  entities?: Entity[];
  tags?: string[];
}

export interface SentimentScore {
  score: number; // -1 to 1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface Entity {
  text: string;
  type: string;
  confidence: number;
  normalizedId?: string;
}

// MCP相关类型
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
  requestId: string;
  version: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 系统状态类型
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    pythonService: 'available' | 'unavailable';
  };
  lastCheck: Date;
}