"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_ACTIONS = exports.MESSAGE_TYPES = exports.HEARTBEAT_TIMEOUT = exports.HEALTH_CHECK_INTERVAL = exports.TASK_ROUTES = exports.AGENT_TYPES = exports.AGENT_PORTS = exports.DEFAULT_AGENT_CONFIG = void 0;
exports.DEFAULT_AGENT_CONFIG = {
    host: 'localhost',
    log_level: 'info'
};
exports.AGENT_PORTS = {
    coordinator: 3000,
    collector: 3001,
    processor: 3002,
    analyzer: 3003
};
exports.AGENT_TYPES = {
    coordinator: 'coordinator',
    collector: 'data-collection',
    processor: 'data-processing',
    analyzer: 'analysis'
};
exports.TASK_ROUTES = {
    'collect-news': 'collector',
    'process-content': 'processor',
    'analyze-sentiment': 'analyzer',
    'detect-risks': 'analyzer',
    'extract-entities': 'processor',
    'extract-events': 'processor'
};
exports.HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
exports.HEARTBEAT_TIMEOUT = 60000; // 60 seconds
exports.MESSAGE_TYPES = {
    REQUEST: 'request',
    RESPONSE: 'response',
    EVENT: 'event'
};
exports.AGENT_ACTIONS = {
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
};
//# sourceMappingURL=index.js.map