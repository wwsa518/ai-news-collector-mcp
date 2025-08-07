"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectorAgent = void 0;
const index_1 = require("./index");
Object.defineProperty(exports, "CollectorAgent", { enumerable: true, get: function () { return index_1.CollectorAgent; } });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 加载配置文件
function loadConfig() {
    const configPath = process.env.AGENT_CONFIG || './agents/collector-agent/config.json';
    const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
    const baseConfig = JSON.parse(configData);
    // 添加代理特定的默认配置
    return {
        ...baseConfig,
        max_concurrent_sources: baseConfig.max_concurrent_sources || 10,
        collection_timeout: baseConfig.collection_timeout || 60000,
        retry_attempts: baseConfig.retry_attempts || 3,
        retry_delay: baseConfig.retry_delay || 5000,
        user_agent: baseConfig.user_agent || 'AI-News-Collector/1.0',
        rate_limit: baseConfig.rate_limit || {
            requests_per_minute: 60,
            requests_per_hour: 1000
        }
    };
}
// 启动数据采集代理
async function startCollectorAgent() {
    try {
        const config = loadConfig();
        const agent = new index_1.CollectorAgent(config);
        // 优雅关闭处理
        process.on('SIGINT', async () => {
            console.log('Received SIGINT, shutting down gracefully...');
            await agent.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('Received SIGTERM, shutting down gracefully...');
            await agent.stop();
            process.exit(0);
        });
        // 启动代理
        await agent.start();
    }
    catch (error) {
        console.error('Failed to start Collector Agent:', error);
        process.exit(1);
    }
}
// 如果直接运行此文件，则启动代理
if (require.main === module) {
    startCollectorAgent();
}
//# sourceMappingURL=main.js.map