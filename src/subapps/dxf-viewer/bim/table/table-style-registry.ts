/**
 * ADR-739 Φάση Α — in-memory μητρώο ονοματισμένων `TableStyle`.
 *
 * Σκόπιμο κάτοπτρο του `systems/line-styles/line-style-registry.ts` (ADR-570), που με
 * τη σειρά του καθρεφτίζει το `dim-style-registry.ts` (ADR-362): κρατά τα built-in
 * presets συν όσα custom φτιάξει ο χρήστης στη συνεδρία, και το ενεργό style. Καθαρά
 * in-memory — η project-scoped διατήρηση (Firestore + `companyId`) ακολουθεί μαζί με
 * το UI, στη φάση που θα την έχει καταναλωτή.
 *
 * Δεν γράφεται τρίτο μητρώο στυλ: αυτό είναι το **ίδιο** συμβόλαιο (`getSnapshot` /
 * `subscribe` / built-in read-only) που ήδη ξέρουν οι δύο υπάρχοντες καταναλωτές
 * `useSyncExternalStore` — μία γλώσσα μητρώου στο repo, όχι τρεις.
 *
 * @module subapps/dxf-viewer/bim/table/table-style-registry
 * @see ../../systems/line-styles/line-style-registry.ts — το πρότυπο
 */

import { generateTableStyleId } from '@/services/enterprise-id.service';
import type { TableStyle } from './table-style';
import { BUILTIN_TABLE_STYLES, DEFAULT_ACTIVE_TABLE_STYLE_ID } from './table-style-presets';
import { createExternalStore } from '../../stores/createExternalStore';

/** Ό,τι ορίζει έναν custom πίνακα-στυλ, χωρίς τα πεδία που γεννά το μητρώο. */
export type CreateCustomTableStyleInput = Omit<TableStyle, 'id' | 'isBuiltIn'>;
export type UpdateCustomTableStylePatch = Partial<Omit<TableStyle, 'id' | 'isBuiltIn'>>;

/** Σταθερό στιγμιότυπο για `useSyncExternalStore` (κάτοπτρο `LineStyleSnapshot`). */
export interface TableStyleSnapshot {
  readonly styles: readonly TableStyle[];
  readonly activeStyleId: string;
}

type RegistryListener = () => void;

export class TableStyleRegistry {
  private readonly styles = new Map<string, TableStyle>();
  private activeStyleId: string = DEFAULT_ACTIVE_TABLE_STYLE_ID;
  // Το store μεταφέρει ΜΟΝΟ έναν ακέραιο-σήμα έκδοσης· τα `styles`/`activeStyleId`
  // μένουν απλά πεδία και οι καταναλωτές τα ξαναδιαβάζουν με `getSnapshot()` στο notify.
  private readonly store = createExternalStore<number>(0);
  private cachedSnapshot: TableStyleSnapshot | null = null;

  constructor() {
    for (const builtIn of BUILTIN_TABLE_STYLES) {
      this.styles.set(builtIn.id, builtIn);
    }
  }

  // ── Αναγνώσεις ───────────────────────────────────────────────────────────

  getStyle(id: string): TableStyle | undefined {
    return this.styles.get(id);
  }

  getAllStyles(): readonly TableStyle[] {
    return Array.from(this.styles.values());
  }

  getActiveStyleId(): string {
    return this.activeStyleId;
  }

  /** Ίδια αναφορά ανάμεσα σε μεταβολές· αντικαθίσταται ατομικά στο `notify()`. */
  getSnapshot(): TableStyleSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        styles: Array.from(this.styles.values()),
        activeStyleId: this.activeStyleId,
      };
    }
    return this.cachedSnapshot;
  }

  /** Το ενεργό στυλ· αν λείπει, το προεπιλεγμένο built-in. */
  getActiveStyle(): TableStyle {
    const active = this.styles.get(this.activeStyleId);
    if (active) return active;
    const fallback = this.styles.get(DEFAULT_ACTIVE_TABLE_STYLE_ID);
    if (!fallback) {
      throw new Error('TABLE_STYLE_REGISTRY_DEFAULT_MISSING');
    }
    return fallback;
  }

  // ── Μεταβολές ────────────────────────────────────────────────────────────

  setActiveStyleId(id: string): void {
    if (!this.styles.has(id)) {
      throw new Error(`TABLE_STYLE_NOT_FOUND: ${id}`);
    }
    if (id === this.activeStyleId) return;
    this.activeStyleId = id;
    this.notify();
  }

  createCustomStyle(input: CreateCustomTableStyleInput): TableStyle {
    const id = generateTableStyleId();
    const style: TableStyle = { ...input, id, isBuiltIn: false };
    this.styles.set(id, style);
    this.notify();
    return style;
  }

  updateCustomStyle(id: string, patch: UpdateCustomTableStylePatch): TableStyle {
    const current = this.styles.get(id);
    if (!current) throw new Error(`TABLE_STYLE_NOT_FOUND: ${id}`);
    if (current.isBuiltIn) throw new Error(`TABLE_STYLE_BUILTIN_READONLY: ${id}`);
    const next: TableStyle = { ...current, ...patch, id: current.id, isBuiltIn: false };
    this.styles.set(id, next);
    this.notify();
    return next;
  }

  deleteCustomStyle(id: string): void {
    const current = this.styles.get(id);
    if (!current) throw new Error(`TABLE_STYLE_NOT_FOUND: ${id}`);
    if (current.isBuiltIn) throw new Error(`TABLE_STYLE_BUILTIN_READONLY: ${id}`);
    this.styles.delete(id);
    if (this.activeStyleId === id) {
      this.activeStyleId = DEFAULT_ACTIVE_TABLE_STYLE_ID;
    }
    this.notify();
  }

  /** Κλωνοποίηση υπάρχοντος στυλ (built-in ή custom) με νέο όνομα χρήστη. */
  duplicateStyle(sourceId: string, newName: string): TableStyle {
    const source = this.styles.get(sourceId);
    if (!source) throw new Error(`TABLE_STYLE_NOT_FOUND: ${sourceId}`);
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('TABLE_STYLE_NAME_REQUIRED');
    const { id: _id, isBuiltIn: _builtIn, ...rest } = source;
    return this.createCustomStyle({ ...rest, name: trimmed });
  }

  // ── Συνδρομή ─────────────────────────────────────────────────────────────

  subscribe(listener: RegistryListener): () => void {
    return this.store.subscribe(listener);
  }

  private notify(): void {
    this.cachedSnapshot = null;
    this.store.set(this.store.get() + 1);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Singleton συνεδρίας (lazy) + σταθεροί accessors σε επίπεδο module
// ──────────────────────────────────────────────────────────────────────────────

let defaultRegistry: TableStyleRegistry | null = null;

export function getTableStyleRegistry(): TableStyleRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new TableStyleRegistry();
  }
  return defaultRegistry;
}

/** Σταθερό `getSnapshot` για `useSyncExternalStore` (δεμένο στο singleton). */
export function getTableStyleSnapshot(): TableStyleSnapshot {
  return getTableStyleRegistry().getSnapshot();
}

/** Σταθερό `subscribe` για `useSyncExternalStore` (δεμένο στο singleton). */
export function subscribeTableStyles(listener: () => void): () => void {
  return getTableStyleRegistry().subscribe(listener);
}

/** Μόνο για tests — αντικατάσταση του singleton (καθαρή κατάσταση ανά test). */
export function __setTableStyleRegistryForTests(registry: TableStyleRegistry | null): void {
  defaultRegistry = registry;
}
