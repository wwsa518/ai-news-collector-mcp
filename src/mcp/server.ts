import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TestModule } from '../models/test-module.js';
import { SimpleLogger } from '../utils/logger.js';

// 定义工具 schemas
const TestFunctionSchema = z.object({
  message: z.string().describe('要测试的消息内容'),
});

const HealthCheckSchema = z.object({});

const GenerateTestDataSchema = z.object({
  count: z.number().min(1).max(100).optional().describe('生成测试数据的数量'),
});

export class MCPServer {
  private server: Server;
  private testModule: TestModule;
  private logger: SimpleLogger;

  constructor() {
    this.logger = new SimpleLogger('MCPServer');
    this.testModule = new TestModule();
    
    this.server = new Server(
      {
        name: 'ai-news-collector-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.info('Listing available tools');
      
      const tools: Tool[] = [
        {
          name: 'test_function',
          description: '简单的测试函数，用于验证系统功能',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: '要测试的消息内容',
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'health_check',
          description: '检查系统健康状态',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'generate_test_data',
          description: '生成测试数据用于开发验证',
          inputSchema: {
            type: 'object',
            properties: {
              count: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                description: '生成测试数据的数量',
              },
            },
            required: [],
          },
        },
      ];

      return { tools };
    });

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info('Tool called', { name, args });

      try {
        switch (name) {
          case 'test_function':
            const testArgs = TestFunctionSchema.parse(args);
            const testResult = await this.testModule.testFunction(testArgs.message);
            return {
              content: [
                {
                  type: 'text',
                  text: testResult,
                },
              ],
            };

          case 'health_check':
            const healthArgs = HealthCheckSchema.parse(args);
            const healthResult = await this.testModule.healthCheck();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(healthResult, null, 2),
                },
              ],
            };

          case 'generate_test_data':
            const dataArgs = GenerateTestDataSchema.parse(args);
            const testData = this.testModule.generateTestData(dataArgs.count);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(testData, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error('Tool execution failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    this.logger.info('Starting MCP server');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.logger.info('MCP server started successfully');
  }
}

// 启动服务器
async function main() {
  const server = new MCPServer();
  await server.run().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  main();
}