import { SimpleLogger } from '../utils/logger';

export class TestModule {
  private logger: SimpleLogger;

  constructor() {
    this.logger = new SimpleLogger('TestModule');
  }

  /**
   * 简单的测试函数
   */
  async testFunction(message: string): Promise<string> {
    this.logger.info('Executing test function', { message });
    
    // 模拟一些处理时间
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = `Test processed: ${message} at ${new Date().toISOString()}`;
    this.logger.info('Test function completed', { result });
    
    return result;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    module: string;
    uptime: number;
  }> {
    const uptime = process.uptime();
    this.logger.info('Health check performed', { uptime });
    
    return {
      status: uptime > 0 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      module: 'TestModule',
      uptime,
    };
  }

  /**
   * 测试数据生成
   */
  generateTestData(count: number = 5): Array<{
    id: string;
    title: string;
    content: string;
    timestamp: string;
  }> {
    this.logger.info('Generating test data', { count });
    
    const testData = [];
    for (let i = 0; i < count; i++) {
      testData.push({
        id: `test-${i + 1}`,
        title: `Test News Item ${i + 1}`,
        content: `This is test content for news item ${i + 1}. Generated at ${new Date().toISOString()}`,
        timestamp: new Date().toISOString(),
      });
    }
    
    this.logger.info('Test data generated', { count: testData.length });
    return testData;
  }
}