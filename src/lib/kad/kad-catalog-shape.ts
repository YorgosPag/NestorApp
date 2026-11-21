/**
 * @fileoverview **Ο αναγνώστης σχήματος του `kad-2025.json`** — ωμό `unknown` → ευρετηριασμένος κατάλογος.
 * @related lib/data/json-shape.ts (`strictJsonShape`) · lib/kad/kad-catalog-source.ts (περιηγητής) ·
 *   services/kad/kad-catalog.reader.ts (διακομιστής)
 * @module lib/kad/kad-catalog-shape
 *
 * 🔑 **Ο ΙΔΙΟΣ αναγνώστης για τις δύο πλευρές του σύρματος** — αλλιώς περιηγητής και διακομιστής θα
 * δέχονταν διαφορετικά σύνολα γραμμών από το ίδιο byte (δες `lib/data/server-json-file.ts`).
 * Γραμμή με άγνωστο σχήμα απορρίπτεται· αρχείο χωρίς ούτε μία έγκυρη γραμμή ⇒ `null` («δεν ξέρω»).
 */

import { pickGemiWinner } from './kad-resolve';
import { KAD_LEVELS, type KadCatalog, type KadCatalogEntry, type KadCatalogMeta, type KadLevel } from './kad-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isKadLevel(value: unknown): value is KadLevel {
  return typeof value === 'string' && (KAD_LEVELS as readonly string[]).includes(value);
}

function readEntry(value: unknown): KadCatalogEntry | null {
  if (!isRecord(value)) return null;
  const { code, gemi, description, level, parent } = value;
  if (typeof code !== 'string' || typeof description !== 'string' || !isKadLevel(level)) return null;
  if (gemi !== null && (typeof gemi !== 'string' || !/^\d{8}$/.test(gemi))) return null;
  if (parent !== null && typeof parent !== 'string') return null;
  return { code, gemi, description, level, parent };
}

function readMeta(value: unknown): KadCatalogMeta | null {
  if (!isRecord(value)) return null;
  const { source, fek, url, sha256, effectiveFrom, generatedAt, count } = value;
  const strings = [source, fek, url, sha256, effectiveFrom, generatedAt];
  if (!strings.every((field): field is string => typeof field === 'string')) return null;
  if (typeof count !== 'number') return null;
  const [s, f, u, h, e, g] = strings;
  return { source: s, fek: f, url: u, sha256: h, effectiveFrom: e, generatedAt: g, count };
}

/** Γραμμές → κατάλογος με ευρετήρια κωδικού και 8ψήφιων ΓΕΜΗ (κανόνας σύγκρουσης). */
export function indexKadCatalog(meta: KadCatalogMeta | null, entries: readonly KadCatalogEntry[]): KadCatalog {
  const byCode = new Map<string, KadCatalogEntry>();
  const candidates = new Map<string, KadCatalogEntry[]>();
  for (const entry of entries) {
    byCode.set(entry.code, entry);
    if (entry.gemi === null) continue;
    const list = candidates.get(entry.gemi);
    if (list) list.push(entry);
    else candidates.set(entry.gemi, [entry]);
  }
  const byGemi = new Map<string, KadCatalogEntry>();
  for (const [gemi, list] of candidates) {
    const winner = pickGemiWinner(list);
    if (winner) byGemi.set(gemi, winner);
  }
  return { meta, entries, byCode, byGemi };
}

/** Ωμό JSON → κατάλογος, ή `null` αν το σχήμα δεν είναι το αναμενόμενο. */
export function readKadCatalog(payload: unknown): KadCatalog | null {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) return null;
  const entries = payload.entries.map(readEntry).filter((entry): entry is KadCatalogEntry => entry !== null);
  if (entries.length === 0) return null;
  return indexKadCatalog(readMeta(payload.meta), entries);
}

/** Η κατάσταση «ρώτησα και δεν έμαθα»: κάθε αναζήτηση απαντά `null`. */
export const EMPTY_KAD_CATALOG: KadCatalog = indexKadCatalog(null, []);
