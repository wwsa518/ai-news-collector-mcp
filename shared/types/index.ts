// 共享类型定义
export interface AgentConfig {
  agent_name: string;
  agent_type: string;
  capabilities: string[];
  dependencies: string[];
  port: number;
  host: string;
  log_level: string;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: 'request' | 'response' | 'event';
  action: string;
  data: any;
  timestamp: number;
  message_id: string;
}

export interface AgentStatus {
  agent_name: string;
  status: 'running' | 'stopped' | 'error';
  port: number;
  uptime: number;
  last_heartbeat: number;
  capabilities: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publish_time: Date;
  collected_at: Date;
  raw_data?: any;
}

export interface ProcessedNews extends NewsItem {
  cleaned_content: string;
  entities: Entity[];
  events: Event[];
  sentiment?: SentimentScore;
}

export interface Entity {
  id: string;
  type: 'stock_code' | 'company' | 'person' | 'location';
  value: string;
  confidence: number;
  start_pos: number;
  end_pos: number;
}

export interface Event {
  id: string;
  subject: string;
  action: string;
  object: string;
  confidence: number;
  timestamp: Date;
}

export interface SentimentScore {
  score: number; // -1 to 1
  confidence: number;
  label: 'positive' | 'negative' | 'neutral';
}

export interface CollectionTask {
  id: string;
  source_type: 'rss' | 'web' | 'api';
  source_config: any;
  schedule: string;
  enabled: boolean;
  last_run?: Date;
  next_run?: Date;
}

export interface ProcessingTask {
  id: string;
  news_id: string;
  processing_type: 'clean' | 'extract_entities' | 'extract_events' | 'analyze_sentiment';
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  completed_at?: Date;
}

export interface AnalysisTask {
  id: string;
  news_id: string;
  analysis_type: 'sentiment' | 'risk' | 'trend';
  parameters: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  created_at: Date;
  completed_at?: Date;
}

export interface RiskAlert {
  id: string;
  news_id: string;
  risk_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  created_at: Date;
  related_entities: string[];
}

export interface Task {
  id: string;
  type: string;
  subtype?: string;
  priority: number;
  status: TaskStatus;
  data: any;
  result?: any;
  error?: string;
  created_at: Date;
  updated_at: Date;
  assigned_agent?: string;
  assigned_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  retry_count: number;
  max_retries: number;
  timeout: number;
  tags: string[];
  metadata: Record<string, any>;
}

export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum TaskType {
  COLLECT_NEWS = 'collect_news',
  PROCESS_CONTENT = 'process_content',
  ANALYZE_SENTIMENT = 'analyze_sentiment',
  DETECT_RISKS = 'detect_risks',
  EXTRACT_ENTITIES = 'extract_entities',
  EXTRACT_EVENTS = 'extract_events',
  GENERATE_REPORT = 'generate_report',
  CLEANUP_DATA = 'cleanup_data'
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}