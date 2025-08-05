import { APIServer } from './api';
import { SimpleLogger } from './utils/logger';
import config from './config';

const logger = new SimpleLogger('Main');

async function main() {
  try {
    logger.info('Starting AI News Collector MCP Server');
    logger.info('Environment:', config.nodeEnv);
    logger.info('Configuration:', {
      port: config.port,
      apiPort: config.apiPort,
      rsshubUrl: config.rsshubUrl,
      redisHost: config.redis.host,
      databaseType: config.database.type,
    });

    // 启动API服务器
    const apiServer = new APIServer();
    await apiServer.start();

    logger.info('✅ AI News Collector MCP Server started successfully');
    logger.info(`🚀 API Server: http://localhost:${config.apiPort}`);
    logger.info(`💚 Health Check: http://localhost:${config.apiPort}/health`);
    logger.info(`📊 System Info: http://localhost:${config.apiPort}/api/system/info`);

    // 优雅关闭处理
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await apiServer.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await apiServer.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();