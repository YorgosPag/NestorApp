/**
 * MCP Server — Tool Registration & Configuration
 *
 * Registers all 9 Firestore tools on a single McpServer instance.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReadTools } from './tools/read-tools.js';
import { registerSchemaTools } from './tools/schema-tools.js';
import { registerWriteTools } from './tools/write-tools.js';
import { registerStorageTools } from './tools/storage-tools.js';

// ============================================================================
// CREATE SERVER
// ============================================================================

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'nestor-firestore',
    version: '1.1.0',
  });

  // Register all tool groups
  registerReadTools(server);
  registerSchemaTools(server);
  registerWriteTools(server);
  registerStorageTools(server);

  console.error('[MCP-Firestore] Server created with 15 tools (4 read, 2 schema, 3 write, 6 storage)');

  return server;
}
