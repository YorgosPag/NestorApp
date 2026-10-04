/**
 * 📜 Σύμπτυξη διαδοχικών αποθηκεύσεων σε **συνεδρία επεξεργασίας** (καθαρή συνάρτηση)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ
 *
 *   ✅ *«τι άλλαξε **τελικά** αυτός ο άνθρωπος όσο δούλευε εδώ;»* — όχι *«πόσες φορές
 *       αποθήκευσε η φόρμα;»*
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η αυτόματη αποθήκευση στέλνει ένα PATCH ανά ~2″ ησυχίας, και κάθε PATCH γράφει **μία**
 * αμετάβλητη εγγραφή ιστορικού. Το βιβλίο μένει έτσι — **append-only, ποτέ ξαναγραμμένο**
 * (το πρότυπο Salesforce Field History / HubSpot Property History): ιστορικό που
 * επεξεργάζεται παύει να είναι τεκμήριο. Η πυκνότητα λύνεται **στην ανάγνωση**, όπως στα
 * Google Docs και στο Figma — με τρεις διαφορές:
 *
 *  1. **Καθαρή αλλαγή, όχι απλή ομάδα.** Ανά πεδίο: πρώτη παλιά → τελευταία νέα. Αν η τιμή
 *     γύρισε στην αρχική (`16 → 18 → 16`), το πεδίο **φεύγει** από τη σύνοψη.
 *  2. **Όρια με νόημα, όχι μόνο ρολόι.** Η συνεδρία κλείνει όταν παρεμβληθεί **οτιδήποτε** στην
 *     ίδια οντότητα που δεν είναι επεξεργασία του ίδιου ανθρώπου: άλλος χρήστης, γραμμή της
 *     μηχανής, άλλη πράξη. Η αιτιότητα «άνθρωπος → μηχανή → άνθρωπος» δεν συγχωνεύεται ποτέ.
 *  3. **Τίποτα δεν χάνεται.** Κάθε συνεδρία κρατά τις ωμές εγγραφές της, αυτούσιες.
 *
 * ⚠️ **Είναι παρουσίαση, όχι δεδομένο**: στατιστικά, εξαγωγές και ροές διαβάζουν τις **ωμές**
 * εγγραφές. Γι' αυτό καλείται στην προβολή (`AuditTimelineView`) και όχι στην υπηρεσία
 * ανάγνωσης, όπου ζει το `dedupDualWrite`.
 *
 * @module services/audit/coalesce-edit-sessions
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { isSystemActorId } from '@/config/domain-constants';
import type { AuditCollectionOp, AuditFieldChange, AuditSubChange, EntityAuditEntry } from '@/types/audit-trail';

/**
 * Το διάλειμμα που κλείνει μια συνεδρία. 5′ είναι το όριο των Google Docs: αρκετά μεγάλο για
 * να χωρέσει μια σκέψη ανάμεσα σε δύο πεδία, αρκετά μικρό ώστε δύο άσχετες διορθώσεις στο ίδιο
 * μισάωρο να μείνουν δύο γραμμές.
 */
export const AUDIT_EDIT_SESSION_GAP_MS = 5 * 60_000;

/** Μία ή περισσότερες διαδοχικές αποθηκεύσεις του ίδιου ανθρώπου στην ίδια οντότητα. */
export interface AuditSession {
  /**
   * Η εγγραφή που δείχνεται: η **τελευταία** της συνεδρίας, με `changes` την **καθαρή** αλλαγή.
   * Σε συνεδρία μίας εγγραφής είναι η ίδια η εγγραφή, ανέγγιχτη.
   */
  readonly net: EntityAuditEntry;
  /** Οι ωμές εγγραφές, με τη σειρά που δόθηκαν. Πάντα ≥ 1. */
  readonly entries: readonly EntityAuditEntry[];
}

interface OpenSession {
  readonly entries: EntityAuditEntry[];
  last: EntityAuditEntry;
}

function timeOf(entry: EntityAuditEntry): number {
  return Date.parse(entry.timestamp);
}

/** Μόνο η ανθρώπινη επεξεργασία συμπτύσσεται — ποτέ γραμμή μηχανής, ποτέ άλλη πράξη. */
function isHumanEdit(entry: EntityAuditEntry): boolean {
  return entry.action === 'updated' && !isSystemActorId(entry.performedBy) && Number.isFinite(timeOf(entry));
}

function joins(last: EntityAuditEntry, next: EntityAuditEntry): boolean {
  return (
    isHumanEdit(last) &&
    isHumanEdit(next) &&
    last.performedBy === next.performedBy &&
    Math.abs(timeOf(last) - timeOf(next)) <= AUDIT_EDIT_SESSION_GAP_MS
  );
}

// ============================================================================
// ΚΑΘΑΡΗ ΑΛΛΑΓΗ
// ============================================================================

type SubRange = Pick<AuditSubChange, 'oldValue' | 'newValue' | 'label'>;

interface NetChange {
  /** Η **πρώτη** εγγραφή του πεδίου — κρατά την αρχική τιμή. */
  first: AuditFieldChange;
  /** Η **τελευταία** — κρατά την τελική τιμή και τα τρέχοντα μεταδεδομένα. */
  last: AuditFieldChange;
  op: AuditCollectionOp | undefined;
  subs: Map<string, SubRange>;
}

/**
 * Τι πράξη είναι δύο διαδοχικές πράξεις στο **ίδιο** στοιχείο συλλογής. `null` ⇒ αλληλοαναιρούνται.
 *
 * `added` μετά `removed` ⇒ το στοιχείο **δεν υπήρξε ποτέ** για όποιον διαβάζει τη σύνοψη.
 * `removed` μετά `added` ⇒ ήταν εκεί και είναι εκεί: ό,τι διαφέρει είναι `modified`.
 */
function combineOps(first: AuditCollectionOp, next: AuditCollectionOp): AuditCollectionOp | null {
  if (first === 'added') return next === 'removed' ? null : 'added';
  if (first === 'removed') return next === 'removed' ? 'removed' : 'modified';
  return next === 'removed' ? 'removed' : 'modified';
}

function mergeSubs(subs: Map<string, SubRange>, next: readonly AuditSubChange[] | undefined): void {
  for (const sub of next ?? []) {
    const known = subs.get(sub.subField);
    subs.set(sub.subField, {
      oldValue: known ? known.oldValue : sub.oldValue,
      newValue: sub.newValue,
      ...(sub.label !== undefined ? { label: sub.label } : {}),
    });
  }
}

/** Το κλειδί ενός πεδίου μέσα στη συνεδρία· στοιχείο συλλογής χωρίς ταυτότητα δεν συγχωνεύεται. */
function changeKey(change: AuditFieldChange, serial: number): string {
  if (change.kind !== 'collection') return `s:${change.field}`;
  return change.itemKey ? `c:${change.field}:${change.itemKey}` : `u:${serial}`;
}

function foldChange(net: Map<string, NetChange>, change: AuditFieldChange, serial: number): void {
  const key = changeKey(change, serial);
  const known = net.get(key);
  if (!known) {
    const subs = new Map<string, SubRange>();
    mergeSubs(subs, change.subChanges);
    net.set(key, { first: change, last: change, op: change.op, subs });
    return;
  }
  if (known.op && change.op) {
    const op = combineOps(known.op, change.op);
    if (op === null) {
      net.delete(key);
      return;
    }
    known.op = op;
  }
  known.last = change;
  mergeSubs(known.subs, change.subChanges);
}

function netSubChanges(subs: Map<string, SubRange>): AuditSubChange[] {
  return Array.from(subs.entries())
    .filter(([, range]) => range.oldValue !== range.newValue)
    .map(([subField, range]) => ({ subField, ...range }));
}

function toNetChange({ first, last, op, subs }: NetChange): AuditFieldChange | null {
  if (last.kind === 'collection') {
    const subChanges = netSubChanges(subs);
    // Τροποποίηση που δεν άφησε καμία διαφορά: το στοιχείο είναι όπως ήταν.
    if (op === 'modified' && subChanges.length === 0) return null;
    return { ...last, ...(op ? { op } : {}), subChanges };
  }
  if (first.oldValue === last.newValue) return null;
  const { oldValueLabel: _lastOldLabel, ...rest } = last;
  return {
    ...rest,
    oldValue: first.oldValue,
    ...(first.oldValueLabel !== undefined ? { oldValueLabel: first.oldValueLabel } : {}),
  };
}

/** Η καθαρή αλλαγή μιας συνεδρίας: πρώτη παλιά → τελευταία νέα, χωρίς ό,τι γύρισε στην αρχή του. */
function netChangesOf(entries: readonly EntityAuditEntry[]): AuditFieldChange[] {
  const chronological = [...entries].sort((a, b) => timeOf(a) - timeOf(b));
  const net = new Map<string, NetChange>();
  let serial = 0;
  for (const entry of chronological) {
    for (const change of entry.changes ?? []) foldChange(net, change, serial++);
  }
  return Array.from(net.values())
    .map(toNetChange)
    .filter((change): change is AuditFieldChange => change !== null);
}

function toSession({ entries }: OpenSession): AuditSession {
  if (entries.length === 1) return { net: entries[0], entries };
  const latest = entries.reduce((a, b) => (timeOf(b) > timeOf(a) ? b : a));
  return { net: { ...latest, changes: netChangesOf(entries) }, entries };
}

/**
 * Συμπτύσσει τις εγγραφές σε συνεδρίες.
 *
 * Καθαρή συνάρτηση· η σειρά της εισόδου (νεότερες ή παλαιότερες πρώτα) διατηρείται, και μια
 * συνεδρία παίρνει τη θέση της **πρώτης** εγγραφής της στην είσοδο. Οι εγγραφές διαφορετικών
 * οντοτήτων δεν επηρεάζουν η μία την άλλη (καθολική προβολή διαχειριστή).
 */
export function coalesceEditSessions(entries: readonly EntityAuditEntry[]): AuditSession[] {
  const sessions: OpenSession[] = [];
  const openByEntity = new Map<string, OpenSession>();

  for (const entry of entries) {
    const entityKey = `${entry.entityType}:${entry.entityId}`;
    const open = openByEntity.get(entityKey);
    if (open && joins(open.last, entry)) {
      open.entries.push(entry);
      open.last = entry;
      continue;
    }
    const session: OpenSession = { entries: [entry], last: entry };
    sessions.push(session);
    openByEntity.set(entityKey, session);
  }

  return sessions.map(toSession);
}
