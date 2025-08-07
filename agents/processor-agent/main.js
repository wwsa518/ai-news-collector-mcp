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
exports.ProcessorAgent = void 0;
const index_1 = require("./index");
Object.defineProperty(exports, "ProcessorAgent", { enumerable: true, get: function () { return index_1.ProcessorAgent; } });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 加载配置文件
function loadConfig() {
    const configPath = process.env.AGENT_CONFIG || './agents/processor-agent/config.json';
    const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
    const baseConfig = JSON.parse(configData);
    // 添加代理特定的默认配置
    return {
        ...baseConfig,
        max_concurrent_tasks: baseConfig.max_concurrent_tasks || 20,
        processing_timeout: baseConfig.processing_timeout || 30000,
        entity_recognition: baseConfig.entity_recognition || {
            enable_stock_codes: true,
            enable_companies: true,
            enable_persons: true,
            enable_locations: true,
            confidence_threshold: 0.7
        },
        event_extraction: baseConfig.event_extraction || {
            enable_triple_extraction: true,
            confidence_threshold: 0.6
        },
        content_cleaning: baseConfig.content_cleaning || {
            remove_html: true,
            remove_ads: true,
            normalize_whitespace: true,
            min_content_length: 100
        }
    };
}
// 启动数据处理代理
async function startProcessorAgent() {
    try {
        const config = loadConfig();
        const agent = new index_1.ProcessorAgent(config);
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
        console.error('Failed to start Processor Agent:', error);
        process.exit(1);
    }
}
// 如果直接运行此文件，则启动代理
if (require.main === module) {
    startProcessorAgent();
}
//# sourceMappingURL=main.js.map