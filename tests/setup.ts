// Test setup file
import { config } from '../src/config';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 全局测试超时
jest.setTimeout(10000);

// 模拟console.log以减少测试输出
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 全局测试工具
global.testHelpers = {
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  generateRandomString: (length = 10) => 
    Math.random().toString(36).substring(2, length + 2),
};