# ADR-313 — Enterprise Backup & Restore System

| Field | Value |
|-------|-------|
| **Status** | Phase 1-7 COMPLETE |
| **Date** | 2026-04-17 |
| **Category** | Infrastructure / Data Protection / Disaster Recovery |
| **Canonical Location** | `src/services/backup/` |
| **API Routes** | `src/app/api/admin/backup/` + `src/app/api/admin/restore/` |

---

## 1. Problem

L'applicazione Nestor gestisce 95+ collezioni Firestore, 27 subcollections e un bucket Firebase Storage con file aziendali (DXF, foto, documenti). L'unico backup esistente (`enterprise-backup.ps1`) salva solo codice/config come ZIP locale — **zero backup dei dati**.

**Rischi attuali:**
- Nessun modo di ripristinare dati persi o corrotti
- Nessun modo di migrare dati tra ambienti (dev → staging → prod)
- Nessun audit di integrità dei dati
- L'applicazione evolve continuamente — campi aggiunti/rimossi possono rompere un eventuale restore manuale

---

## 2. Decision

Implementare un sistema **manifest-driven** di backup e restore. Ogni backup produce un manifest JSON che descrive esattamente il contenuto (collezioni, conteggio documenti, inventario campi, hash integrità). Il restore legge il manifest e **riconcilia** lo schema automaticamente.

**Perch manifest-driven, non `schemaVersion` nei documenti?**
- Zero impatto sui documenti esistenti (95+ collezioni, migliaia di documenti)
- Il manifest cattura lo schema point-in-time senza richiedere migrazioni
- Schema reconciliation al momento del restore, non al momento della scrittura
- Google Takeout usa lo stesso pattern: export manifest + data bundle

**Perch non `gcloud firestore export`?**
- `gcloud firestore export` esporta l'intero database in formato protobuf su GCS — utile per disaster recovery totale
- Non supporta: export parziale per collezione, schema reconciliation, cross-reference Storage ↔ Firestore, audit integrità, restore selettivo
- Il nostro sistema lo complementa per restore granulare e schema evolution

---

## 3. Architecture

### 3.1 Principi

1. **SSoT-Driven**: `COLLECTIONS` e `SUBCOLLECTIONS` da `firestore-collections.ts` guidano cosa backuppare — zero lista hardcoded
2. **Manifest = Schema Record**: ogni backup include l'inventario completo dei campi per collezione
3. **Schema Reconciliation**: restore tollerante — campi nuovi → default, campi rimossi → skip
4. **Append-Only Awareness**: collezioni immutabili (audit_log, entity_audit_trail, communications) → skip se documento già esiste
5. **Batch Safety**: processAdminBatch() da admin-batch-utils.ts per paginazione sicura (500 read, 200 write)

### 3.2 Componenti

```
src/services/backup/
├── backup-manifest.types.ts     # Tipi: BackupManifest, CollectionEntry, etc.
├── backup-serializer.ts         # Firestore → JSON-safe (Timestamp, GeoPoint, Ref)
├── backup.service.ts            # BackupService: export collections + subcollections
├── backup-gcs.service.ts        # Scrittura/lettura backup su GCS bucket
├── restore.service.ts           # RestoreService: validate, preview, execute ✅
├── restore-helpers.ts           # Tier ordering, ref resolution (SRP split) ✅
├── restore-chain.service.ts     # Incremental chain resolution + merge ✅
├── storage-restore.service.ts   # Storage file restore (GCS → Firebase Storage) ✅
├── schema-reconciler.ts         # Schema reconciliation — Approach B (Google) ✅
└── incremental-backup.service.ts # Delta backup via entity_audit_trail (Fase 5) ✅

src/app/api/admin/backup/
├── full/route.ts                # POST — trigger full backup
├── incremental/route.ts         # POST — trigger incremental backup (Fase 5) ✅
└── status/route.ts              # GET — stato backup in corso

src/app/api/admin/restore/       # ✅ Phase 4
├── route.ts                     # POST — trigger restore
└── preview/route.ts             # POST — dry-run preview
```

### 3.3 Infrastruttura SSoT riutilizzata

| Componente | File | Ruolo |
|-----------|------|-------|
| Collection registry | `src/config/firestore-collections.ts` | SSoT nomi collezioni + subcollections |
| Admin SDK | `src/lib/firebaseAdmin.ts` | getAdminFirestore(), getAdminStorage() |
| Batch processor | `src/lib/admin-batch-utils.ts` | processAdminBatch() paginazione |
| Entity audit | `src/services/entity-audit.service.ts` | CDC per backup incrementale |
| Auth middleware | `src/lib/auth/` | withAuth + permissions |
| Rate limiting | `src/lib/middleware/with-rate-limit.ts` | withSensitiveRateLimit |
| Enterprise IDs | `src/services/enterprise-id.service.ts` | ID generazione per backup records |

### 3.4 Dependency Graph (Collezioni)

Import ordinato per il restore — rispetta le dipendenze padre → figlio:

```
Tier 0 (System):     system, settings, config, counters
Tier 1 (Tenants):    companies, users, teams, roles, permissions
Tier 2 (Core):       projects, contacts, workspaces
Tier 3 (Structures): buildings, floors, properties, parking_spaces
Tier 4 (Relations):  contact_links, contact_relationships, file_links
Tier 5 (Content):    files, communications, messages, tasks, leads
Tier 6 (Domain):     construction_*, boq_*, accounting_*, legal_*, ownership_*
Tier 7 (AI/System):  ai_*, bot_*, search_*, attendance_*, audit trails
```

Subcollections importate dopo tutti i documenti padre del loro tier.

---

## 4. Backup Manifest Schema

```typescript
interface BackupManifest {
  // Identità
  id: string;                          // bkp_{uuid} da enterprise-id.service
  version: '1.0.0';                    // Schema version del manifest stesso
  type: 'full' | 'incremental';
  
  // Metadata
  createdAt: string;                   // ISO 8601
  createdBy: string;                   // userId del super-admin
  projectId: string;                   // Firebase project ID
  environment: 'development' | 'staging' | 'production';
  
  // Contenuto
  collections: CollectionManifestEntry[];
  subcollections: SubcollectionManifestEntry[];
  storageFiles: StorageManifestEntry[];  // Fase 3
  
  // Schema snapshot
  firestoreCollectionsVersion: string;  // Git hash o timestamp
  
  // Integrità
  totalDocuments: number;
  totalStorageFiles: number;
  totalStorageBytes: number;
  checksum: string;                     // SHA-256 del manifest stesso
  
  // Incrementale (Fase 5)
  parentBackupId?: string;             // Per backup incrementali
  deltaFrom?: string;                  // ISO 8601 — timestamp da cui partono i delta
}

interface CollectionManifestEntry {
  collectionKey: string;               // COLLECTIONS key (es. 'CONTACTS')
  collectionName: string;              // Nome Firestore (es. 'contacts')
  documentCount: number;
  fieldInventory: string[];            // Unione di tutti i campi trovati
  isImmutable: boolean;               // audit_log, entity_audit_trail, etc.
  backupFile: string;                  // Path relativo: 'collections/contacts.ndjson.gz'
  checksum: string;                    // SHA-256 del file NDJSON
}

interface SubcollectionManifestEntry {
  subcollectionKey: string;            // SUBCOLLECTIONS key
  subcollectionName: string;           // Nome (es. 'activities')
  parentCollectionKey: string;         // COLLECTIONS key padre
  parentDocumentIds: string[];         // Lista documenti padre che hanno questa sub
  totalDocuments: number;
  fieldInventory: string[];
  backupFile: string;
  checksum: string;
}

interface StorageManifestEntry {
  storagePath: string;                 // Path nel bucket
  firestoreDocId?: string;            // FileRecord collegato (se esiste)
  sizeBytes: number;
  contentType: string;
  sha256: string;
  backupFile: string;                  // Path nel backup
}
```

---

## 5. Schema Evolution Strategy

### 5.1 Problema

L'applicazione aggiunge ~5-10 campi/mese a collezioni esistenti. Un backup di oggi potrebbe mancare di campi che esisteranno tra 3 mesi. Un restore deve funzionare in entrambe le direzioni.

### 5.2 Soluzione: Schema Reconciliation al Restore

```
Backup Schema (manifest.fieldInventory) vs Current Schema (scansione documenti attuali)
                                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ Campo presente in ENTRAMBI     → Copia diretta                  │
│ Campo solo nel BACKUP          → Skip (campo rimosso)           │
│ Campo solo nel CURRENT         → Default value (null/0/''/ [])  │
│ Campo tipo cambiato            → Best-effort coercion + warning │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Nessun `schemaVersion` richiesto

Il manifest cattura il field inventory al momento del backup. Il restore compara con lo stato attuale. Non serve nessun campo extra nei documenti Firestore.

### 5.4 Collezioni immutabili

Collezioni marcate `isImmutable: true` nel manifest:
- `entity_audit_trail`, `audit_log`, `system_audit_logs`, `accounting_audit_log`
- `communications`, `messages`, `attendance_events`, `attendance_qr_tokens`
- `file_audit_log`, `email_ingestion_queue`

**Restore behavior**: se il documento esiste già → skip (no overwrite). Solo documenti mancanti vengono inseriti.

---

## 6. Implementation Phases

### Fase 1: Fondamenta — COMPLETE

**Deliverable**: Export singola collezione + manifest + serializer + API endpoint

File nuovi:
- `src/services/backup/backup-manifest.types.ts`
- `src/services/backup/backup-serializer.ts`
- `src/services/backup/backup.service.ts`
- `src/services/backup/backup-gcs.service.ts`
- `src/app/api/admin/backup/full/route.ts`
- `src/app/api/admin/backup/status/route.ts`

Modifica:
- `src/config/firestore-collections.ts` — `SUBCOLLECTION_PARENTS` + `IMMUTABLE_COLLECTIONS`

### Fase 2: Scheduled Backup — COMPLETE

Cron endpoint + scheduler service + retention policy.

File nuovi:
- `src/lib/cron-auth.ts` — SSoT centralizzato per Vercel Cron authorization (sostituisce 4 copie inline)
- `src/services/backup/backup-scheduler.service.ts` — BackupSchedulerService: config check, execute, retention cleanup
- `src/app/api/cron/backup/route.ts` — GET cron endpoint, daily at 01:00 UTC

Modifica:
- `vercel.json` — aggiunto cron entry `/api/cron/backup` schedule `0 1 * * *`
- `src/app/api/cron/overdue-alerts/route.ts` — usa `verifyCronAuthorization` centralizzato
- `src/app/api/cron/email-ingestion/route.ts` — usa `verifyCronAuthorization` centralizzato
- `src/app/api/cron/ai-pipeline/route.ts` — usa `verifyCronAuthorization` centralizzato
- `src/app/api/cron/file-purge/route.ts` — usa `verifyCronAuthorization` centralizzato

Config Firestore `system/backup_config`:
- `scheduleEnabled: boolean` — abilita/disabilita
- `retentionCount: number` — quanti backup mantenere (default 7)
- `lastBackupId/lastBackupAt` — aggiornati automaticamente
- Guard: min 20h tra backup consecutivi (anti double-trigger)

### Fase 3: Export Firebase Storage — COMPLETE

`StorageBackupService`: lista file, download parallelo (concurrency=10), SHA-256, cross-ref con FILES collection.

File nuovo:
- `src/services/backup/storage-backup.service.ts` — StorageBackupService: lista ricorsiva, download parallelo, SHA-256, cross-ref FILES, orphan detection

Modifica:
- `src/services/backup/backup-gcs.service.ts` — `writeRawFile()` per file binari raw
- `src/services/backup/backup.service.ts` — `executeFullBackup()` chiama StorageBackupService, `buildManifest()` accetta `backupId` + `storageResult`, `backupId` generato all'inizio del backup
- `src/app/api/admin/backup/full/route.ts` — Passa `gcsService` a `executeFullBackup()`, response include `totalStorageFiles`/`totalStorageBytes`

### Fase 4: Restore completo (5-7 giorni) — COMPLETE

**Deliverable**: RestoreService + SchemaReconciler + API endpoints + pre-restore snapshot

Schema reconciliation uses **Approach B (Google pattern)**: restore writes only what the backup contains, `merge: true` preserves fields in current DB not present in backup. No extra schema scan needed.

File nuovi:
- `src/services/backup/schema-reconciler.ts` — Reconciles backup vs current DB state per collection
- `src/services/backup/restore.service.ts` — RestoreService: validate, preview, execute with tier-ordered import
- `src/app/api/admin/restore/route.ts` — POST trigger restore (withAuth + withSensitiveRateLimit)
- `src/app/api/admin/restore/preview/route.ts` — POST dry-run preview

Modifica:
- `src/services/backup/backup-manifest.types.ts` — RestoreStatus, RestoreOptions, PreRestoreSnapshot, CollectionReconciliation, RestorePreview types
- `src/services/backup/backup-gcs.service.ts` — writeJsonFile() method for snapshots
- `src/services/enterprise-id-prefixes.ts` — RESTORE: 'rst' prefix
- `src/services/enterprise-id.service.ts` + `enterprise-id-convenience.ts` — generateRestoreId()

**Key features:**
- Tier-ordered import (system → tenants → core → structures → relations → content → domain → AI/system)
- Immutable collections: skip existing docs, insert only new
- Pre-restore snapshot saved to GCS (`{backupId}/snapshots/snapshot_{restoreId}.json`)
- Batch writes with BATCH_SIZE_WRITE=200
- DocumentReference resolution during restore (path strings → actual refs)
- Progress tracking in `system/restore_status`
- **Incremental chain resolution**: `RestoreChainService` walks parentBackupId chain, merges documents (latest wins), applies tombstones
- **Storage file restore**: `StorageRestoreService` streams files from backup GCS → Firebase Storage, SHA-256 verification, skip existing with matching hash

### Fase 5: Backup incrementale ✅

Delta da `entity_audit_trail` (CDC pattern). Re-fetch documenti modificati. Manifest incrementale con puntatore al full backup padre.

**Implemented files:**
- `src/services/backup/incremental-backup.service.ts` — IncrementalBackupService: queries audit trail, maps entity types to collections, fetches changed docs, builds incremental manifest
- `src/app/api/admin/backup/incremental/route.ts` — POST endpoint with same auth/rate-limit as full backup

**Architecture:**
- CDC source: `entity_audit_trail` collection (EntityAuditService records all entity changes)
- AuditEntityType → COLLECTIONS key mapping: contact, building, property, floor, project, company, parking, storage, purchase_order (9 entity types)
- Changed documents re-fetched from Firestore (current state) — not from audit diff
- Deleted documents tracked as tombstones (`deletedDocumentIds` on CollectionManifestEntry)
- Last-action-wins deduplication (chronological query, last audit entry per entity prevails)
- Batch pagination on audit trail (500 entries per batch)
- Document fetch via `getAll()` (batch of 500 refs)
- Collections NOT covered by audit trail → warnings in manifest
- Subcollections and Storage files NOT included (full backup only)

**Scheduler integration:**
- `BackupSchedulerService.shouldUseIncremental()` decides full vs incremental
- Config-driven: `incrementalEnabled` + `fullBackupIntervalDays` (default 7)
- Strategy: full every N days, incremental on other days
- Fallback to full if no previous full backup exists or on error

**Types added:**
- `BackupConfig.incrementalEnabled?: boolean`
- `BackupConfig.fullBackupIntervalDays?: number`
- `CollectionManifestEntry.deletedDocumentIds?: string[]`

### Fase 6: Automazione + Retention ✅

Cron scheduling. Retention policy (keep last N). Config in `system/backup_config`.

### Fase 7: Admin UI — COMPLETE

Admin page at `/admin/backup` with tabbed interface (Backups, Restore, Status, Config).

**New API endpoints:**
- `GET /api/admin/backup/list` — lists all backup manifests from GCS
- `GET/POST /api/admin/backup/config` — read/write backup scheduler configuration
- `GET /api/admin/restore/status` — poll restore operation progress

**UI components (shadcn/Radix):**
- `src/components/admin/pages/BackupPageContent.tsx` — tab orchestrator
- `src/components/admin/backup/BackupActionsCard.tsx` — trigger full/incremental
- `src/components/admin/backup/BackupListSection.tsx` — backup history with metadata
- `src/components/admin/backup/BackupStatusCard.tsx` — live progress (polling 3s)
- `src/components/admin/backup/RestoreSection.tsx` — backup selector + options + AlertDialog confirmation
- `src/components/admin/backup/RestorePreviewTable.tsx` — collection reconciliation table
- `src/components/admin/backup/BackupConfigSection.tsx` — scheduler config form

**State hooks:**
- `useBackupState.ts` — backup list, trigger, status polling
- `useRestoreState.ts` — preview, execute, restore status polling
- `useBackupConfigState.ts` — config CRUD

**Config/Registry:**
- `lazyRoutesAdr294.tsx` — `AdminBackup` lazy route
- `domain-constants.ts` — `API_ROUTES.ADMIN.BACKUP.*` + `API_ROUTES.ADMIN.RESTORE.*`
- `smart-navigation-factory.ts` — nav item with `DatabaseBackup` icon
- `i18n/locales/{en,el}/admin.json` — `backup.*` keys (~60)
- `i18n/locales/{en,el}/navigation.json` — `admin.backup` label

---

## 7. Security

- **Auth**: `withAuth({ permissions: 'admin:backup:execute' })` — super_admin only
- **Rate limit**: `withSensitiveRateLimit` (20 req/min)
- **GCS bucket**: non-public, accesso solo via Admin SDK
- **Env vars**: esclusi dal backup dati (gestiti separatamente)
- **Secrets**: mai inclusi nel manifest o nei log

---

## 8. GCS Bucket Structure

```
gs://{projectId}-backups/
├── {backupId}/
│   ├── manifest.json
│   ├── collections/
│   │   ├── contacts.ndjson.gz
│   │   ├── projects.ndjson.gz
│   │   └── ...
│   ├── subcollections/
│   │   ├── contacts__activities.ndjson.gz
│   │   ├── projects__tasks.ndjson.gz
│   │   └── ...
│   └── storage/                      # Fase 3
│       └── companies/
│           └── {companyId}/
│               └── ...
```

---

## 9. Changelog

| Data | Fase | Descrizione |
|------|------|------------|
| 2026-04-17 | 1 | ADR creato. Tipi manifest, serializer, BackupService, GCS service, API endpoints |
| 2026-04-17 | 4 | RestoreService, SchemaReconciler (Approach B), API routes, pre-restore snapshot, generateRestoreId, restore types |
| 2026-04-17 | 3 | StorageBackupService: streaming pipeline, SHA-256 transform, cross-ref FILES, size guard, backupId upfront |
| 2026-04-17 | 2 | BackupSchedulerService, cron endpoint /api/cron/backup (01:00 UTC), retention policy, SSoT cron-auth.ts (4 copie → 1) |
| 2026-04-17 | 5 | IncrementalBackupService (CDC via entity_audit_trail), POST /api/admin/backup/incremental, scheduler full/incremental decision, types: deletedDocumentIds, incrementalEnabled, fullBackupIntervalDays |
| 2026-04-17 | 4+ | RestoreChainService (incremental chain merge), StorageRestoreService (GCS → Firebase Storage streaming), BackupGcsService.createReadStream(), restore route includes storage counts. ADR status → Phase 1-6 COMPLETE |
| 2026-04-17 | 7 | Admin UI page: /admin/backup with 4 tabs (Backups, Restore, Status, Config). 3 new API endpoints (list, config, restore/status). 7 UI components + 3 hooks. i18n en+el. Navigation entry. ADR status → Phase 1-7 COMPLETE |
