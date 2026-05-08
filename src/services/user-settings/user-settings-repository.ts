/**
 * UserSettingsRepository — single source of truth for all per-user UI settings.
 *
 * Pattern: industry-standard (Google Drive / Procore / SAP UME) — Firestore is
 * the authority, the client holds a live snapshot via `onSnapshot`, every write
 * goes through this one chokepoint with debounced autosave, schema validation,
 * and audit logging. Each subsystem (cursor, rulers/grid, dxfSettings, snap)
 * binds to its own slice path and stays a read-only client of this repository.
 *
 * The repository is a *service* (plain singleton), not a React provider — it
 * boots before React, survives unmounts, and is the single chokepoint for UI
 * settings persistence. Consumers wire React state to it via subscriptions.
 *
 * Key contracts:
 * - `subscribeSlice<T>(path, cb)` — fires immediately with the last known value
 *   (or undefined while loading), then re-fires on every Firestore update.
 * - `getSlice<T>(path)` — synchronous read of the last known value.
 * - `updateSlice<T>(path, value)` — debounced (500ms) Firestore write,
 *   sanitized (undefined → null per Firestore contract), audit-logged.
 *
 * @module services/user-settings/user-settings-repository
 * @enterprise ADR-XXX (UserSettings SSoT — Firestore-backed industry pattern)
 *             ADR-195 (EntityAuditService for change history)
 *             ADR-214 (firestoreQueryService SSoT for reads/writes)
 *             N.6 (deterministic composite ID via user-settings-id helper)
 */

import type { Unsubscribe } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import { buildUserPreferencesDocId } from './user-settings-id';
import {
  USER_SETTINGS_SCHEMA_VERSION,
  userSettingsSchema,
  type DxfViewerSlicePath,
  type UserSettingsDoc,
} from './user-settings-schema';
import {
  buildEmptyUserSettings,
  migrateUserSettings,
} from './user-settings-migrations';
import {
  applySliceToDoc,
  getSliceFromDoc,
  type SliceValueMap,
} from './user-settings-paths';

const logger = createModuleLogger('UserSettingsRepository');

const AUTOSAVE_DEBOUNCE_MS = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

export type SliceListener<P extends DxfViewerSlicePath> = (
  value: SliceValueMap[P] | undefined,
) => void;

interface PendingWrite {
  path: DxfViewerSlicePath;
  value: unknown;
}

// ─── Repository ──────────────────────────────────────────────────────────────

class UserSettingsRepository {
  private currentDoc: UserSettingsDoc | null = null;
  private docId: string | null = null;
  private userId: string | null = null;
  private companyId: string | null = null;

  private firestoreUnsubscribe: Unsubscribe | null = null;
  private isBound = false;

  private listeners: Set<() => void> = new Set();

  // Debounced write state — coalesces concurrent updates per slice
  private pendingWrites: Map<DxfViewerSlicePath, PendingWrite> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Bind the repository to a (userId, companyId) pair and start the live
   * Firestore subscription. Idempotent — calling with the same pair is a noop;
   * calling with a different pair resets state and rebinds.
   */
  bind(userId: string, companyId: string): void {
    if (this.userId === userId && this.companyId === companyId && this.isBound) {
      return;
    }
    this.unbind();

    this.userId = userId;
    this.companyId = companyId;
    this.docId = buildUserPreferencesDocId(userId, companyId);
    this.isBound = true;

    logger.info('Binding repository', { userId, companyId, docId: this.docId });

    this.firestoreUnsubscribe = firestoreQueryService.subscribeDoc<UserSettingsDoc>(
      'USER_PREFERENCES',
      this.docId,
      (raw) => this.handleFirestoreSnapshot(raw),
      (err) => {
        logger.warn('Subscription error', { error: err.message, docId: this.docId });
      },
      { tenantOverride: 'skip' },
    );
  }

  /** Tear down subscription + clear in-memory state. Safe to call multiple times. */
  unbind(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingWrites.clear();
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }
    this.currentDoc = null;
    this.docId = null;
    this.userId = null;
    this.companyId = null;
    this.isBound = false;
    this.notifyListeners();
  }

  /** Returns true if the repository has loaded the doc at least once (or knows it's empty). */
  isReady(): boolean {
    return this.isBound && this.currentDoc !== null;
  }

  /** Synchronous read of the last known value at a slice path. */
  getSlice<P extends DxfViewerSlicePath>(path: P): SliceValueMap[P] | undefined {
    return getSliceFromDoc(this.currentDoc, path);
  }

  /**
   * Subscribe to a slice. The callback fires immediately with the current
   * value (possibly `undefined` while loading) and re-fires on every change.
   */
  subscribeSlice<P extends DxfViewerSlicePath>(
    path: P,
    listener: SliceListener<P>,
  ): () => void {
    const wrapped = () => listener(this.getSlice(path));
    this.listeners.add(wrapped);
    wrapped();
    return () => {
      this.listeners.delete(wrapped);
    };
  }

  /**
   * Write a slice. The repository optimistically updates in-memory state and
   * notifies listeners synchronously; the Firestore write is debounced 500ms
   * and coalesces multiple updates to the same slice into a single network call.
   */
  updateSlice<P extends DxfViewerSlicePath>(
    path: P,
    value: SliceValueMap[P],
  ): void {
    if (!this.isBound || !this.docId || !this.userId || !this.companyId) {
      logger.warn('updateSlice called before bind — dropping', { path });
      return;
    }

    // Optimistic in-memory update + listener notification
    this.currentDoc = applySliceToDoc(
      this.currentDoc ?? buildEmptyUserSettings(this.userId, this.companyId),
      path,
      value,
    );
    this.notifyListeners();

    // Schedule debounced Firestore flush
    this.pendingWrites.set(path, { path, value });
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flushPendingWrites();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /** Force-flush any pending writes immediately (e.g. before unmount). */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushPendingWrites();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private handleFirestoreSnapshot(raw: UserSettingsDoc | null): void {
    if (!this.userId || !this.companyId) return;

    if (!raw) {
      // First-time user — start with an empty (schema-valid) skeleton.
      this.currentDoc = buildEmptyUserSettings(this.userId, this.companyId);
      this.notifyListeners();
      return;
    }

    const migrated = migrateUserSettings(raw as unknown as Record<string, unknown>);
    const parsed = userSettingsSchema.safeParse(migrated.data);
    if (!parsed.success) {
      logger.warn('Schema validation failed on read — using empty skeleton', {
        issues: parsed.error.issues.slice(0, 3),
      });
      this.currentDoc = buildEmptyUserSettings(this.userId, this.companyId);
      this.notifyListeners();
      return;
    }

    this.currentDoc = parsed.data;
    this.notifyListeners();

    // One-shot migration writeback (best-effort, idempotent)
    if (migrated.migrated) {
      void firestoreQueryService
        .update<UserSettingsDoc>('USER_PREFERENCES', this.docId!, parsed.data)
        .catch((err) => logger.warn('Migration writeback failed', { error: err?.message }));
    }
  }

  private async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0 || !this.docId || !this.userId || !this.companyId) {
      return;
    }

    const writes = Array.from(this.pendingWrites.values());
    this.pendingWrites.clear();
    this.flushTimer = null;

    // Compose the full doc payload from current in-memory state. Firestore
    // setDoc with merge:true would be slightly cheaper, but we deliberately
    // write the full validated doc so the server-side rules can enforce schema
    // invariants (companyId immutability, schemaVersion floor) atomically.
    const baseDoc = this.currentDoc ?? buildEmptyUserSettings(this.userId, this.companyId);
    let payload: UserSettingsDoc = {
      ...baseDoc,
      userId: this.userId,
      companyId: this.companyId,
      schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    };
    for (const w of writes) {
      payload = applySliceToDoc(
        payload,
        w.path,
        w.value as SliceValueMap[typeof w.path],
      );
    }

    const validated = userSettingsSchema.safeParse(payload);
    if (!validated.success) {
      logger.error('Schema validation failed on write — aborting', {
        issues: validated.error.issues.slice(0, 3),
      });
      return;
    }

    try {
      // Use create(setDoc) on first write, update afterward. We branch on
      // whether the doc has been hydrated by the listener yet; if not, the
      // first ever write must be a create — but since we always operate
      // post-bind (which kicks off the snapshot listener), `currentDoc` is
      // populated by the time the debounce fires. We use update unconditionally
      // and rely on Firestore rules + setDoc-on-first-write upstream.
      await firestoreQueryService.update<UserSettingsDoc>(
        'USER_PREFERENCES',
        this.docId,
        validated.data,
      );
      logger.info('Flushed', { count: writes.length, paths: writes.map((w) => w.path) });
    } catch (err) {
      // If the doc doesn't exist yet, fall back to create.
      const code = (err as { code?: string })?.code;
      if (code === 'not-found' || (err as Error)?.message?.includes('No document to update')) {
        try {
          await firestoreQueryService.create<UserSettingsDoc>(
            'USER_PREFERENCES',
            validated.data,
            { documentId: this.docId, addTenantContext: false, addTimestamps: true },
          );
          logger.info('Created', { count: writes.length });
        } catch (createErr) {
          logger.error('Create-on-first-write failed', {
            error: (createErr as Error)?.message,
          });
        }
        return;
      }
      logger.error('Flush failed', { error: (err as Error)?.message });
    }
  }

  private notifyListeners(): void {
    for (const fn of this.listeners) fn();
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const userSettingsRepository = new UserSettingsRepository();

// Re-export pure path helper for convenience (canonical location:
// `./user-settings-paths`).
export { applySliceToDoc } from './user-settings-paths';
