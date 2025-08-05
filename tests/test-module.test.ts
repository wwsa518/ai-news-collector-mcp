import { TestModule } from '../models/test-module';

// 创建测试模块实例
const testModule = new TestModule();

describe('TestModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('testFunction', () => {
    it('should process message correctly', async () => {
      const message = 'Hello World';
      const result = await testModule.testFunction(message);
      
      expect(result).toContain(message);
      expect(result).toContain('Test processed:');
    });

    it('should handle empty message', async () => {
      const message = '';
      const result = await testModule.testFunction(message);
      
      expect(result).toContain('Test processed:');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const result = await testModule.healthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.module).toBe('TestModule');
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('generateTestData', () => {
    it('should generate correct number of test items', () => {
      const count = 3;
      const result = testModule.generateTestData(count);
      
      expect(result).toHaveLength(count);
      expect(result[0].id).toBe('test-1');
      expect(result[0].title).toContain('Test News Item 1');
    });

    it('should generate default number of items when count not specified', () => {
      const result = testModule.generateTestData();
      
      expect(result).toHaveLength(5);
    });
  });
});