// 任务类型定义
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

export interface TaskFilter {
  status?: TaskStatus[];
  type?: TaskType[];
  assigned_agent?: string;
  created_after?: Date;
  created_before?: Date;
  tags?: string[];
  priority?: TaskPriority;
}

export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  average_processing_time: number;
  success_rate: number;
}

export interface TaskConfig {
  max_concurrent_tasks: number;
  default_timeout: number;
  max_retries: number;
  retry_delay: number;
  cleanup_interval: number;
  task_retention_days: number;
}