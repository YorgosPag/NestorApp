/**
 * =============================================================================
 * Το ημερολόγιο ακμών του μητρώου λήξεων — ο ΕΝΑΣ γραφέας (ADR-915 Φ5α · §12)
 * =============================================================================
 *
 * **«Τι έχουμε ήδη πει σε αυτό το γραφείο, για κάθε γραμμή;»** — ένα έγγραφο ανά εταιρεία
 * (`document_expiry_alert_ledgers/{companyId}`), με γραμμή → `{ stage, expiresOn, escalated }` (Φ5β: κλιμάκωση).
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
import {
  isExpiryAlertStage,
  type AlertLedger,
  type AlertLedgerEntry,
  type ExpiryAlertStage,
} from '@/lib/document-validity/expiry-alert-stage';

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
  return { rowId, stage, expiresOn, escalated: escalatedOf(Reflect.get(value, 'escalated'), stage) };
}

/**
 * ADR-915 Φ5β — γραμμή της Φ5α (χωρίς `escalated`): η Φ5α έστελνε **σε όλους τους διαχειριστές**, άρα η διοίκηση
 * ξέρει ήδη τη γραμμή **στο στάδιο που αποθηκεύτηκε**. Λογίζεται κλιμακωμένη **μόνο** αν εκείνο το στάδιο ήταν
 * `expired` — το μόνο που αποδεδειγμένα άκουσε σε κατάσταση κλιμάκωσης (το «μπλοκάρει» δεν αποθηκευόταν).
 * ⚠️ **ΜΗΝ το κάνεις «απόν ⇒ `true`»**: μια παλιά γραμμή `d30` θα έμενε για πάντα «κλιμακωμένη» και, όταν θα έληγε με
 *    την ίδια ημερομηνία, η διοίκηση **δεν θα μάθαινε ποτέ**. Ένα πιθανό διπλό μήνυμα είναι φθηνότερο από μια χαμένη κλιμάκωση.
 */
function escalatedOf(value: unknown, stage: ExpiryAlertStage): boolean {
  return typeof value === 'boolean' ? value : stage === 'expired';
}

/** Το ημερολόγιο ενός γραφείου· κενό αν δεν υπάρχει ακόμη (πρώτη σάρωση ⇒ όλα είναι νέα). */
export async function readAlertLedger(db: Firestore, companyId: string): Promise<AlertLedger> {
  const snapshot = await ledgerRef(db, companyId).get();
  const rows: unknown = snapshot.exists ? snapshot.data()?.rows : undefined;
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(rows.flatMap((value: unknown) => {
    const entry = entryOf(value);
    return entry ? [[entry.rowId, { stage: entry.stage, expiresOn: entry.expiresOn, escalated: entry.escalated }]] : [];
  }));
}

/** Αντικαθιστά το ημερολόγιο (ο καλών αποφασίζει πλήρες ή συγχώνευση — `nextAlertLedger`). */
export async function writeAlertLedger(db: Firestore, companyId: string, ledger: AlertLedger, asOf: string, nowMs: number): Promise<void> {
  const rows: StoredEntry[] = Object.entries(ledger)
    .map(([rowId, entry]) => ({ rowId, stage: entry.stage, expiresOn: entry.expiresOn, escalated: entry.escalated }))
    .sort((a, b) => a.rowId.localeCompare(b.rowId));
  await ledgerRef(db, companyId).set({ companyId, rows, asOf, updatedAt: new Date(nowMs).toISOString() });
}
