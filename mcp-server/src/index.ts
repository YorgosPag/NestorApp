/**
 * MCP Firestore Server — Entry Point (stdio transport)
 *
 * Loads environment from the main project's .env.local,
 * initializes Firebase Admin SDK, and starts the MCP server
 * on stdio transport (no network exposure).
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

// ============================================================================
// LOAD ENVIRONMENT
// ============================================================================

// Load .env.local from the main project root (shared credentials)
const dotenvPath = process.env.DOTENV_PATH || '.env.local';
const resolvedPath = resolve(process.cwd(), dotenvPath);
config({ path: resolvedPath });

console.error(`[MCP-Firestore] Loading env from: ${resolvedPath}`);
console.error(`[MCP-Firestore] Firebase project: ${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown'}`);

// ============================================================================
// START SERVER
// ============================================================================

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  console.error('[MCP-Firestore] Starting stdio transport...');
  await server.connect(transport);
  console.error('[MCP-Firestore] Server running on stdio');
}

main().catch((err) => {
  console.error('[MCP-Firestore] Fatal error:', err);
  process.exit(1);
});
