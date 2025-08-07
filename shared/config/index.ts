// 共享配置定义
import { AgentConfig } from '../types';

export const DEFAULT_AGENT_CONFIG: Partial<AgentConfig> = {
  host: 'localhost',
  log_level: 'info'
};

export const AGENT_PORTS = {
  coordinator: 3000,
  collector: 3001,
  processor: 3002,
  analyzer: 3003
};

export const AGENT_TYPES = {
  coordinator: 'coordinator',
  collector: 'data-collection',
  processor: 'data-processing',
  analyzer: 'analysis'
};

export const TASK_ROUTES = {
  'collect-news': 'collector',
  'process-content': 'processor',
  'analyze-sentiment': 'analyzer',
  'detect-risks': 'analyzer',
  'extract-entities': 'processor',
  'extract-events': 'processor'
};

export const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
export const HEARTBEAT_TIMEOUT = 60000; // 60 seconds

export const MESSAGE_TYPES = {
  REQUEST: 'request',
  RESPONSE: 'response',
  EVENT: 'event'
} as const;

export const AGENT_ACTIONS = {
  // 通用动作
  HEALTH_CHECK: 'health_check',
  HEARTBEAT: 'heartbeat',
  SHUTDOWN: 'shutdown',
  RESTART: 'restart',
  
  // 数据采集动作
  START_COLLECTION: 'start_collection',
  STOP_COLLECTION: 'stop_collection',
  GET_COLLECTION_STATUS: 'get_collection_status',
  
  // 数据处理动作
  PROCESS_NEWS: 'process_news',
  EXTRACT_ENTITIES: 'extract_entities',
  EXTRACT_EVENTS: 'extract_events',
  
  // 分析动作
  ANALYZE_SENTIMENT: 'analyze_sentiment',
  DETECT_RISKS: 'detect_risks',
  GENERATE_REPORT: 'generate_report'
} as const;