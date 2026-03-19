# ADR-243: Custom Firestore MCP Server — Secure Database Access for Claude Code

## Status
✅ IMPLEMENTED | 2026-03-19

## Context
Ο Claude Code βλέπει μόνο τον κώδικα, όχι τα δεδομένα στο Firestore. Χρειαζόμαστε ασφαλή πρόσβαση read/write στη βάση δεδομένων μέσω MCP (Model Context Protocol) για να μπορεί ο Claude να:
- Ερωτά τη βάση (queries, counts, schema introspection)
- Δημιουργεί/ενημερώνει documents (με access control)
- Βλέπει real-time δεδομένα αντί να μαντεύει

## Decision
Custom MCP Server τοπικά (stdio transport) αντί για third-party MCP. Πλήρης έλεγχος ασφαλείας.

## Architecture

### Transport
- **stdio** — τοπικό process, ΔΕΝ ανοίγει port, ΔΕΝ εκτίθεται στο δίκτυο

### Credential Chain (ίδια με ADR-077)
1. `FIREBASE_SERVICE_ACCOUNT_KEY_B64` (base64)
2. `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string)
3. `GOOGLE_APPLICATION_CREDENTIALS` / Application Default Credentials

### File Structure
```
mcp-server/
├── package.json            # @modelcontextprotocol/sdk, firebase-admin, zod, dotenv
├── tsconfig.json
├── .gitignore              # dist/, audit.jsonl
├── src/
│   ├── index.ts            # Entry: dotenv + stdio transport
│   ├── server.ts           # McpServer + tool registration
│   ├── firestore-client.ts # Firebase Admin init (credential chain)
│   ├── types.ts            # TypeScript interfaces
│   ├── tools/
│   │   ├── read-tools.ts   # 4 tools: list-collections, get-document, query, count
│   │   ├── schema-tools.ts # 2 tools: get-schema, list-schemas
│   │   └── write-tools.ts  # 3 tools: create, update, delete
│   └── security/
│       ├── access-control.ts   # Collection allowlists
│       ├── field-redaction.ts  # Sensitive field strip
│       └── audit-logger.ts    # JSON Lines audit + rate limiting
.mcp.json                   # Claude Code project-level config
```

## 9 MCP Tools

### Read (4)
| Tool | Description |
|------|-------------|
| `firestore_list_collections` | List all collections with document counts |
| `firestore_get_document` | Get single document by ID |
| `firestore_query` | Query with filters, ordering, pagination (max 100) |
| `firestore_count` | Count documents with optional filters |

### Schema (2)
| Tool | Description |
|------|-------------|
| `firestore_get_schema` | Schema fields, types, relationships for a collection |
| `firestore_list_schemas` | All collections with schema definitions |

### Write (3)
| Tool | Description |
|------|-------------|
| `firestore_create_document` | Create document (write allowlist required) |
| `firestore_update_document` | Update document fields (merge) |
| `firestore_delete_document` | Delete document (requires `MCP_ALLOW_DELETE=true`) |

## Security Model

### Access Control
- **READ**: All collections (full visibility)
- **WRITE**: Allowlist of business collections only
- **BLOCKED**: system, config, settings, users, roles, permissions, tokens, security_roles, counters
- **DELETE**: Disabled by default, opt-in via env var

### Field Redaction
Automatic strip: password, passwordHash, token, apiKey, secret, refreshToken, accessToken, privateKey, webhookSecret, signingKey

### Rate Limits
- Read: 60 req/min
- Write: 20 req/min
- Delete: 5 req/min

### Audit Trail
Every operation logged to `mcp-server/audit.jsonl` (JSON Lines format)

## Dependencies
All permissive licenses (ADR-034 Appendix C compliant):
- `@modelcontextprotocol/sdk` — MIT
- `firebase-admin` — Apache 2.0
- `zod` — MIT
- `dotenv` — BSD-2
- `tsx` — MIT (devDependency)

## Configuration
`.mcp.json` at project root configures Claude Code to start the server:
```json
{
  "mcpServers": {
    "firestore": {
      "command": "npx",
      "args": ["tsx", "mcp-server/src/index.ts"],
      "cwd": "C:\\Nestor_Pagonis",
      "env": { "DOTENV_PATH": ".env.local" }
    }
  }
}
```

## Changelog
| Date | Change |
|------|--------|
| 2026-03-19 | Initial implementation — 9 tools, security model, audit logging |
