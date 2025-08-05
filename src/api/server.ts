import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { TestModule } from '../models/test-module';
import { SimpleLogger } from '../utils/logger';
import { ApiResponse, SystemStatus } from '../types';
import config from '../config';

export class APIServer {
  private app: express.Application;
  private testModule: TestModule;
  private logger: SimpleLogger;
  private server: any;

  constructor() {
    this.app = express();
    this.testModule = new TestModule();
    this.logger = new SimpleLogger('APIServer');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // 安全中间件
    this.app.use(helmet());
    
    // CORS配置
    this.app.use(cors({
      origin: config.security.corsOrigin,
      credentials: true,
    }));
    
    // 解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // 请求日志
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.testModule.healthCheck();
        const systemStatus: SystemStatus = {
          status: health.status,
          uptime: health.uptime,
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
          },
          services: {
            database: 'connected', // 简化版本
            redis: 'disconnected', // 简化版本
            pythonService: 'unavailable', // 简化版本
          },
          lastCheck: new Date(),
        };
        
        res.json(systemStatus);
      } catch (error) {
        this.logger.error('Health check failed', error);
        res.status(500).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // 测试端点
    this.app.post('/api/test', async (req, res) => {
      try {
        const { message } = req.body;
        
        if (!message) {
          const response: ApiResponse = {
            code: 400,
            message: 'Message is required',
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId(),
            version: '1.0',
          };
          return res.status(400).json(response);
        }

        const result = await this.testModule.testFunction(message);
        
        const response: ApiResponse = {
          code: 200,
          message: 'Test executed successfully',
          data: { result },
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
          version: '1.0',
        };
        
        res.json(response);
      } catch (error) {
        this.logger.error('Test endpoint failed', error);
        const response: ApiResponse = {
          code: 500,
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
          version: '1.0',
        };
        res.status(500).json(response);
      }
    });

    // 生成测试数据
    this.app.get('/api/test-data', async (req, res) => {
      try {
        const count = parseInt(req.query.count as string) || 5;
        const testData = this.testModule.generateTestData(count);
        
        const response: ApiResponse = {
          code: 200,
          message: 'Test data generated successfully',
          data: { items: testData, count: testData.length },
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
          version: '1.0',
        };
        
        res.json(response);
      } catch (error) {
        this.logger.error('Test data generation failed', error);
        const response: ApiResponse = {
          code: 500,
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId(),
          version: '1.0',
        };
        res.status(500).json(response);
      }
    });

    // 系统信息
    this.app.get('/api/system/info', (req, res) => {
      const response: ApiResponse = {
        code: 200,
        message: 'System information retrieved successfully',
        data: {
          name: 'AI News Collector MCP',
          version: '1.0.0',
          environment: config.nodeEnv,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0',
      };
      
      res.json(response);
    });

    // 404处理
    this.app.use('*', (req, res) => {
      const response: ApiResponse = {
        code: 404,
        message: 'Endpoint not found',
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0',
      };
      res.status(404).json(response);
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', error);
      
      const response: ApiResponse = {
        code: 500,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0',
      };
      
      res.status(500).json(response);
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async start(port: number = config.apiPort): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        this.logger.info(`API server started on port ${port}`);
        resolve();
      });
      
      this.server.on('error', (error: Error) => {
        this.logger.error('Failed to start API server', error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}