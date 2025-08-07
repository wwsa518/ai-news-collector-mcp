import { AgentConfig } from '../types';
export declare const DEFAULT_AGENT_CONFIG: Partial<AgentConfig>;
export declare const AGENT_PORTS: {
    coordinator: number;
    collector: number;
    processor: number;
    analyzer: number;
};
export declare const AGENT_TYPES: {
    coordinator: string;
    collector: string;
    processor: string;
    analyzer: string;
};
export declare const TASK_ROUTES: {
    'collect-news': string;
    'process-content': string;
    'analyze-sentiment': string;
    'detect-risks': string;
    'extract-entities': string;
    'extract-events': string;
};
export declare const HEALTH_CHECK_INTERVAL = 30000;
export declare const HEARTBEAT_TIMEOUT = 60000;
export declare const MESSAGE_TYPES: {
    readonly REQUEST: "request";
    readonly RESPONSE: "response";
    readonly EVENT: "event";
};
export declare const AGENT_ACTIONS: {
    readonly HEALTH_CHECK: "health_check";
    readonly HEARTBEAT: "heartbeat";
    readonly SHUTDOWN: "shutdown";
    readonly RESTART: "restart";
    readonly START_COLLECTION: "start_collection";
    readonly STOP_COLLECTION: "stop_collection";
    readonly GET_COLLECTION_STATUS: "get_collection_status";
    readonly PROCESS_NEWS: "process_news";
    readonly EXTRACT_ENTITIES: "extract_entities";
    readonly EXTRACT_EVENTS: "extract_events";
    readonly ANALYZE_SENTIMENT: "analyze_sentiment";
    readonly DETECT_RISKS: "detect_risks";
    readonly GENERATE_REPORT: "generate_report";
};
//# sourceMappingURL=index.d.ts.map