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
exports.AnalyzerAgent = void 0;
const index_1 = require("./index");
Object.defineProperty(exports, "AnalyzerAgent", { enumerable: true, get: function () { return index_1.AnalyzerAgent; } });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 加载配置文件
function loadConfig() {
    const configPath = process.env.AGENT_CONFIG || './agents/analyzer-agent/config.json';
    const configData = fs.readFileSync(path.resolve(configPath), 'utf8');
    const baseConfig = JSON.parse(configData);
    // 添加代理特定的默认配置
    return {
        ...baseConfig,
        max_concurrent_tasks: baseConfig.max_concurrent_tasks || 15,
        analysis_timeout: baseConfig.analysis_timeout || 45000,
        sentiment_analysis: baseConfig.sentiment_analysis || {
            model_type: 'transformers',
            confidence_threshold: 0.8,
            batch_size: 10
        },
        risk_detection: baseConfig.risk_detection || {
            enable_financial_risks: true,
            enable_reputation_risks: true,
            enable_market_risks: true,
            severity_threshold: 0.7
        },
        trend_analysis: baseConfig.trend_analysis || {
            time_window: 24,
            min_events_for_trend: 5,
            confidence_threshold: 0.6
        }
    };
}
// 启动分析代理
async function startAnalyzerAgent() {
    try {
        const config = loadConfig();
        const agent = new index_1.AnalyzerAgent(config);
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
        console.error('Failed to start Analyzer Agent:', error);
        process.exit(1);
    }
}
// 如果直接运行此文件，则启动代理
if (require.main === module) {
    startAnalyzerAgent();
}
//# sourceMappingURL=main.js.map