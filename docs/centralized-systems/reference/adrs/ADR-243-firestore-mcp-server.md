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
│   ├── server.ts           # McpServer + tool registration (v1.1.0)
│   ├── firestore-client.ts # Firebase Admin init (credential chain)
│   ├── storage-client.ts   # Firebase Storage bucket singleton
│   ├── types.ts            # TypeScript interfaces
│   ├── tools/
│   │   ├── read-tools.ts   # 4 tools: list-collections, get-document, query, count
│   │   ├── schema-tools.ts # 2 tools: get-schema, list-schemas
│   │   ├── write-tools.ts  # 3 tools: create, update, delete
│   │   └── storage-tools.ts # 6 tools: list, metadata, read, signed-url, upload, delete
│   └── security/
│       ├── access-control.ts         # Collection allowlists (Firestore)
│       ├── storage-access-control.ts # Path-based access control (Storage)
│       ├── field-redaction.ts        # Sensitive field strip
│       └── audit-logger.ts          # JSON Lines audit + rate limiting
.mcp.json                   # Claude Code project-level config
```

## 15 MCP Tools

### Firestore Read (4)
| Tool | Description |
|------|-------------|
| `firestore_list_collections` | List all collections with document counts |
| `firestore_get_document` | Get single document by ID |
| `firestore_query` | Query with filters, ordering, pagination (max 100) |
| `firestore_count` | Count documents with optional filters |

### Firestore Schema (2)
| Tool | Description |
|------|-------------|
| `firestore_get_schema` | Schema fields, types, relationships for a collection |
| `firestore_list_schemas` | All collections with schema definitions |

### Firestore Write (3)
| Tool | Description |
|------|-------------|
| `firestore_create_document` | Create document (write allowlist required) |
| `firestore_update_document` | Update document fields (merge) |
| `firestore_delete_document` | Delete document (requires `MCP_ALLOW_DELETE=true`) |

### Storage (6) — added v1.1.0
| Tool | Type | Input | Output |
|------|------|-------|--------|
| `storage_list_files` | read | `{path?, maxResults?}` | Files + folders στο path |
| `storage_get_metadata` | read | `{path}` | Size, contentType, updated, md5Hash |
| `storage_read_file` | read | `{path}` | Text content (max 512KB) ή metadata+signedURL για binaries |
| `storage_get_signed_url` | read | `{path, expiresInMinutes?}` | Signed download URL (default 60min, max 24h) |
| `storage_upload_file` | write | `{path, content, contentType?}` | Upload text content (max 1MB) |
| `storage_delete_file` | delete | `{path}` | Requires `MCP_ALLOW_DELETE=true` + write-allowed path |

#### Binary vs Text File Handling
- **Text files** (`.json`, `.txt`, `.csv`, `.md`, `.xml`, `.svg`): Returns content as text (max 512KB)
- **Binary files** (images, PDFs, DXF): Returns metadata + auto-generated signed URL (1h)
- Claude cannot see raw binary data, but sees metadata and can give URLs to the user

## Security Model

### Firestore Access Control
- **READ**: All collections (full visibility)
- **WRITE**: Allowlist of business collections only
- **BLOCKED**: system, config, settings, users, roles, permissions, tokens, security_roles, counters
- **DELETE**: Disabled by default, opt-in via env var

### Storage Path-Based Access Control (v1.1.0)

**BLOCKED PATHS** (ποτέ access — all operations):
- `.well-known/`, `__internal/`
- Paths containing: `secret`, `credential`, `private-key`, `service-account`, `.env`

**READ**: All non-blocked paths

**WRITE ALLOWED** (allowlist patterns):
- `companies/{companyId}/entities/**` (canonical — ADR-031)
- `contacts/photos/**` (legacy)
- `floors/*/floorplans/**` (legacy)
- `temp/**`, `config/**`

**DELETE**: Write-allowed path + `MCP_ALLOW_DELETE=true`

### Field Redaction (Firestore)
Automatic strip: password, passwordHash, token, apiKey, secret, refreshToken, accessToken, privateKey, webhookSecret, signingKey

### Rate Limits
**Firestore:**
- Read: 60 req/min
- Write: 20 req/min
- Delete: 5 req/min

**Storage:**
- storage_read: 30 req/min
- storage_write: 10 req/min
- storage_delete: 3 req/min

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
| 2026-03-19 | Initial implementation — 9 Firestore tools, security model, audit logging |
| 2026-03-19 | v1.1.0 — Added 6 Firebase Storage tools (list, metadata, read, signed-url, upload, delete), path-based access control, separate rate limits |
