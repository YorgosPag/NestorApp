/**
 * ADR-344 Phase 10 — IndexedDB auto-save + crash recovery service (Q15).
 *
 * Saves DxfTextNode drafts to IndexedDB with a 30 s write-debounce.
 * Drafts expire after 7 days and are cleaned on service init.
 * Key = `${companyId}:${entityId}` — tenant-scoped, no cross-company leakage.
 *
 * Yjs awareness: if a Y.Doc snapshot (Uint8Array) is provided, it is stored
 * alongside the textNode so recovery can re-apply the Yjs state before
 * rendering (Q4 + Q15 intersection).
 *
 * Client-only — IndexedDB is unavailable in SSR; callers must be inside
 * 'use client' or behind a `typeof window !== 'undefined'` guard.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { DxfTextNode } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DB_NAME = 'dxf-text-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DEBOUNCE_MS = 30_000;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Schema ────────────────────────────────────────────────────────────────────

export interface DraftEntry {
  readonly draftKey: string;
  readonly entityId: string;
  readonly companyId: string;
  readonly textNode: DxfTextNode;
  readonly savedAt: number;
  readonly yDocSnapshot?: Uint8Array;
}

interface DraftSchema {
  drafts: {
    key: string;
    value: DraftEntry;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class DraftRecoveryService {
  private db: IDBPDatabase<DraftSchema> | null = null;
  private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private async getDb(): Promise<IDBPDatabase<DraftSchema>> {
    if (!this.db) {
      this.db = await openDB<DraftSchema>(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: 'draftKey' });
          }
        },
      });
      await this.cleanExpired();
    }
    return this.db;
  }

  private draftKey(entityId: string, companyId: string): string {
    return `${companyId}:${entityId}`;
  }

  private async persist(entry: DraftEntry): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE_NAME, entry);
  }

  /**
   * Schedule a debounced save (30 s). Repeated calls within the window
   * reset the timer — only the final state is persisted.
   */
  save(
    entityId: string,
    companyId: string,
    textNode: DxfTextNode,
    yDocSnapshot?: Uint8Array,
  ): void {
    const key = this.draftKey(entityId, companyId);
    const existing = this.saveTimers.get(key);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.saveTimers.delete(key);
      void this.persist({ draftKey: key, entityId, companyId, textNode, savedAt: Date.now(), yDocSnapshot });
    }, DEBOUNCE_MS);
    this.saveTimers.set(key, timer);
  }

  /**
   * Flush immediately without waiting for the debounce — use on editor close.
   */
  async flush(
    entityId: string,
    companyId: string,
    textNode: DxfTextNode,
    yDocSnapshot?: Uint8Array,
  ): Promise<void> {
    const key = this.draftKey(entityId, companyId);
    const existing = this.saveTimers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.saveTimers.delete(key);
    }
    await this.persist({ draftKey: key, entityId, companyId, textNode, savedAt: Date.now(), yDocSnapshot });
  }

  /**
   * Load a draft. Returns null if none exists or if it has expired.
   */
  async load(entityId: string, companyId: string): Promise<DraftEntry | null> {
    const db = await this.getDb();
    const entry = await db.get(STORE_NAME, this.draftKey(entityId, companyId));
    if (!entry) return null;
    if (Date.now() - entry.savedAt > EXPIRY_MS) {
      await this.delete(entityId, companyId);
      return null;
    }
    return entry;
  }

  async delete(entityId: string, companyId: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE_NAME, this.draftKey(entityId, companyId));
  }

  async cleanExpired(): Promise<void> {
    const db = await this.getDb();
    const threshold = Date.now() - EXPIRY_MS;
    const all = await db.getAll(STORE_NAME);
    await Promise.all(
      all
        .filter((e) => e.savedAt < threshold)
        .map((e) => db.delete(STORE_NAME, e.draftKey)),
    );
  }

  dispose(): void {
    for (const timer of this.saveTimers.values()) clearTimeout(timer);
    this.saveTimers.clear();
    this.db?.close();
    this.db = null;
  }
}

let _instance: DraftRecoveryService | null = null;

/** Singleton — one IndexedDB connection per browser tab. */
export function getDraftRecoveryService(): DraftRecoveryService {
  if (!_instance) _instance = new DraftRecoveryService();
  return _instance;
}
