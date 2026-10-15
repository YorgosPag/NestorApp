/**
 * =============================================================================
 * Το ημερολόγιο ακμών του μητρώου λήξεων — ο ΕΝΑΣ γραφέας (ADR-915 Φ5α · §12)
 * =============================================================================
 *
 * **«Τι έχουμε ήδη πει σε αυτό το γραφείο, για κάθε γραμμή;»** — ένα έγγραφο ανά εταιρεία
 * (`document_expiry_alert_ledgers/{companyId}`), με γραμμή → `{ stage, expiresOn }`.
 *
 * 🔑 **Γιατί κατάσταση, και όχι μόνο το dedupe του orchestrator**: το `eventId` συγκρίνει **σύνολα** — μια γραμμή που
 *    ανανεώθηκε θα άλλαζε το σύνολο και θα ξανάστελνε τις υπόλοιπες. Εδώ κρατιέται **ανά γραμμή** το «ειπωμένο»,
 *    ώστε να φεύγει **μόνο** ό,τι είναι νέο. Το `eventId` μένει δίχτυ για την επανάληψη πριν γραφτεί το ημερολόγιο.
 * 🔑 **Ανεκτικός αναγνώστης**: άγνωστο στάδιο ή χαλασμένη γραμμή ⇒ η γραμμή αγνοείται (θα ξαναειπωθεί — ποτέ σιωπή).
 * 🔴 **Μόνο Admin SDK**: οι κανόνες είναι `deny_all` και στις δύο πλευρές.
 *
 * @module services/document-registry/registry-alert-ledger.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isExpiryAlertStage, type AlertLedger, type AlertLedgerEntry } from '@/lib/document-validity/expiry-alert-stage';

function ledgerRef(db: Firestore, companyId: string) {
  return db.collection(COLLECTIONS.DOCUMENT_EXPIRY_ALERT_LEDGERS).doc(companyId);
}

/** Μία αποθηκευμένη γραμμή. ⚠️ **Πίνακας, όχι map**: η ταυτότητα γραμμής (`file:…` · `missing:…:…`) δεν γίνεται ποτέ όνομα πεδίου. */
interface StoredEntry extends AlertLedgerEntry {
  readonly rowId: string;
}

function entryOf(value: unknown): StoredEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const rowId: unknown = Reflect.get(value, 'rowId');
  const stage: unknown = Reflect.get(value, 'stage');
  const expiresOn: unknown = Reflect.get(value, 'expiresOn');
  if (typeof rowId !== 'string' || rowId === '' || !isExpiryAlertStage(stage)) return null;
  if (expiresOn !== null && typeof expiresOn !== 'string') return null;
  return { rowId, stage, expiresOn };
}

/** Το ημερολόγιο ενός γραφείου· κενό αν δεν υπάρχει ακόμη (πρώτη σάρωση ⇒ όλα είναι νέα). */
export async function readAlertLedger(db: Firestore, companyId: string): Promise<AlertLedger> {
  const snapshot = await ledgerRef(db, companyId).get();
  const rows: unknown = snapshot.exists ? snapshot.data()?.rows : undefined;
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(rows.flatMap((value: unknown) => {
    const entry = entryOf(value);
    return entry ? [[entry.rowId, { stage: entry.stage, expiresOn: entry.expiresOn }]] : [];
  }));
}

/** Αντικαθιστά το ημερολόγιο (ο καλών αποφασίζει πλήρες ή συγχώνευση — `nextAlertLedger`). */
export async function writeAlertLedger(db: Firestore, companyId: string, ledger: AlertLedger, asOf: string, nowMs: number): Promise<void> {
  const rows: StoredEntry[] = Object.entries(ledger)
    .map(([rowId, entry]) => ({ rowId, stage: entry.stage, expiresOn: entry.expiresOn }))
    .sort((a, b) => a.rowId.localeCompare(b.rowId));
  await ledgerRef(db, companyId).set({ companyId, rows, asOf, updatedAt: new Date(nowMs).toISOString() });
}
