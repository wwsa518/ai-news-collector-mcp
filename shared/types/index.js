"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskPriority = exports.TaskType = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["QUEUED"] = "queued";
    TaskStatus["ASSIGNED"] = "assigned";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
    TaskStatus["TIMEOUT"] = "timeout";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskType;
(function (TaskType) {
    TaskType["COLLECT_NEWS"] = "collect_news";
    TaskType["PROCESS_CONTENT"] = "process_content";
    TaskType["ANALYZE_SENTIMENT"] = "analyze_sentiment";
    TaskType["DETECT_RISKS"] = "detect_risks";
    TaskType["EXTRACT_ENTITIES"] = "extract_entities";
    TaskType["EXTRACT_EVENTS"] = "extract_events";
    TaskType["GENERATE_REPORT"] = "generate_report";
    TaskType["CLEANUP_DATA"] = "cleanup_data";
})(TaskType || (exports.TaskType = TaskType = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["LOW"] = 1] = "LOW";
    TaskPriority[TaskPriority["NORMAL"] = 2] = "NORMAL";
    TaskPriority[TaskPriority["HIGH"] = 3] = "HIGH";
    TaskPriority[TaskPriority["CRITICAL"] = 4] = "CRITICAL";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
//# sourceMappingURL=index.js.map