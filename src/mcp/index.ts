import { MCPServer } from './server';

async function main() {
  try {
    const server = new MCPServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();