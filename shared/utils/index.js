"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerUtils = exports.ValidationUtils = exports.TimeUtils = exports.AgentUtils = exports.MessageUtils = void 0;
// 共享工具函数
const uuid_1 = require("uuid");
class MessageUtils {
    static createMessage(from, to, type, action, data) {
        return {
            from,
            to,
            type,
            action,
            data,
            timestamp: Date.now(),
            message_id: (0, uuid_1.v4)()
        };
    }
    static createResponse(originalMessage, data, isError = false) {
        return {
            from: originalMessage.to,
            to: originalMessage.from,
            type: 'response',
            action: originalMessage.action,
            data: isError ? { error: data } : data,
            timestamp: Date.now(),
            message_id: (0, uuid_1.v4)()
        };
    }
}
exports.MessageUtils = MessageUtils;
class AgentUtils {
    static generateAgentId(agentName) {
        return `${agentName}-${(0, uuid_1.v4)().slice(0, 8)}`;
    }
    static createAgentStatus(agentName, port, capabilities, status = 'running') {
        return {
            agent_name: agentName,
            status,
            port,
            uptime: 0,
            last_heartbeat: Date.now(),
            capabilities
        };
    }
    static parseCapabilities(capabilities) {
        return capabilities.reduce((acc, capability) => {
            acc[capability] = true;
            return acc;
        }, {});
    }
}
exports.AgentUtils = AgentUtils;
class TimeUtils {
    static formatTimestamp(timestamp) {
        return new Date(timestamp).toISOString();
    }
    static parseISODate(dateString) {
        return new Date(dateString);
    }
    static getDelay(startTime) {
        return Date.now() - startTime;
    }
}
exports.TimeUtils = TimeUtils;
class ValidationUtils {
    static isValidPort(port) {
        return port > 0 && port <= 65535;
    }
    static isValidAgentName(name) {
        return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;
    }
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.ValidationUtils = ValidationUtils;
class LoggerUtils {
    static getTimestamp() {
        return new Date().toISOString();
    }
    static formatLog(level, message, meta) {
        const timestamp = this.getTimestamp();
        const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    }
    static log(level, message, meta) {
        console.log(this.formatLog(level, message, meta));
    }
    static info(message, meta) {
        this.log('info', message, meta);
    }
    static error(message, meta) {
        this.log('error', message, meta);
    }
    static warn(message, meta) {
        this.log('warn', message, meta);
    }
    static debug(message, meta) {
        this.log('debug', message, meta);
    }
}
exports.LoggerUtils = LoggerUtils;
//# sourceMappingURL=index.js.map