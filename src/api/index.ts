import { APIServer } from './server';

async function main() {
  try {
    const server = new APIServer();
    await server.start();
    
    // 优雅关闭处理
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start API server:', error);
    process.exit(1);
  }
}

main();