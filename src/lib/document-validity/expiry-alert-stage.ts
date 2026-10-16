/**
 * =============================================================================
 * Τα ΣΤΑΔΙΑ των ειδοποιήσεων του μητρώου λήξεων (ADR-915 Φ5α · §12)
 * =============================================================================
 *
 * **«Σε ποιο στάδιο βρίσκεται σήμερα αυτή η γραμμή — και ΠΕΡΑΣΕ σε νέο από την τελευταία ειδοποίηση;»**
 *
 * | Στάδιο | Πότε (η τελευταία μέρα είναι μέσα) |
 * |---|---|
 * | `lead` | μπήκε στις `renewalLeadDays` του είδους — μόνο όταν αυτές είναι **περισσότερες** από 30 |
 * | `d30` · `d7` · `d0` | λήγει σε ≤ 30 · ≤ 7 ημέρες · σήμερα |
 * | `expired` | έληξε |
 * | `missing` | κενό: απαίτηση `required` που κανένα έγγραφο δεν κρατά (Φ4δ Ε7) |
 *
 * 🏆 **Ένα μήνυμα ανά ΝΕΟ στάδιο ανά έγγραφο, ποτέ το ίδιο δύο φορές** — αντί για τα καθημερινά email του Procore επί
 *    60 ημέρες. Το «ήδη ειπωμένο» ζει στο **ημερολόγιο ακμών** (`AlertLedger`), όχι στη μνήμη του orchestrator.
 * 🔑 **Η ανανέωση ξαναρχίζει**: άλλη `expiresOn` ⇒ άλλο έγγραφο για τον άνθρωπο, ακόμη κι αν η γραμμή είναι η ίδια.
 * 🔑 **Η κατάσταση ΔΕΝ ξαναϋπολογίζεται εδώ**: την παράγει ο ΕΝΑΣ πυρήνας (`documentRegistry`). Εδώ κόβεται μόνο η
 *    απόσταση από τη λήξη σε σκαλιά, και η προβολή-προσγείωση ρωτά τον ΕΝΑ ταξινομητή (`matchesRegistryView`).
 * ⚠️ `expiry-unknown` **δεν** ειδοποιείται: δεν έχει ημερομηνία για ακμή, και φαίνεται ήδη στη σελίδα (δηλωμένο, §12).
 *
 * Καθαρό (leaf): ασκείται χωρίς βάση.
 *
 * @module lib/document-validity/expiry-alert-stage
 */

import { documentKindSpec } from '@/config/document-validity/document-validity';
import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { alertSetDigest } from '@/lib/notifications/alert-set-digest';
import { registryRowIdOf, type RegistryRow } from './document-registry';
import { matchesRegistryView, REGISTRY_VIEW_ALL, type RegistryView } from './document-registry-view';

/** Τα στάδια, από το λιγότερο προς το περισσότερο επείγον. Κλειστό σύνολο· η σειρά **είναι** η κατάταξη. */
export const EXPIRY_ALERT_STAGES = ['lead', 'd30', 'd7', 'd0', 'expired', 'missing'] as const;
export type ExpiryAlertStage = (typeof EXPIRY_ALERT_STAGES)[number];

/** Τα σταθερά σκαλιά (ημέρες ως τη λήξη), από το στενότερο. Το `lead` προέρχεται από το είδος. */
const DAY_STEPS: readonly (readonly [ExpiryAlertStage, number])[] = [['d0', 0], ['d7', 7], ['d30', 30]];
const WIDEST_STEP = 30;

/** Οι προβολές-προσγείωσης, από την πιο στενή: η πρώτη που χωρά **όλες** τις γραμμές της ειδοποίησης. */
const LANDING_VIEWS: readonly RegistryView[] = ['blocking', 'missing', 'renewal-due', 'within-window'];

const STAGE_RANK = new Map<ExpiryAlertStage, number>(EXPIRY_ALERT_STAGES.map((stage, index) => [stage, index]));

/** Μία γραμμή του μητρώου σε στάδιο ειδοποίησης. */
export interface ExpiryAlert {
  readonly rowId: string;
  readonly stage: ExpiryAlertStage;
  /** `null` για κενό. */
  readonly expiresOn: string | null;
  readonly blocking: boolean;
}

/** Τι **έχει ήδη ειπωθεί** για μια γραμμή. */
export interface AlertLedgerEntry {
  readonly stage: ExpiryAlertStage;
  readonly expiresOn: string | null;
  /** ADR-915 Φ5β — η **αυτή** λήξη έχει ήδη κλιμακωθεί στη διοίκηση (δεύτερος άξονας ακμής, `expiry-alert-routing`). */
  readonly escalated: boolean;
}

/** Γραμμή → τελευταίο στάδιο που ανακοινώθηκε. */
export type AlertLedger = Readonly<Record<string, AlertLedgerEntry>>;

export function isExpiryAlertStage(value: unknown): value is ExpiryAlertStage {
  return typeof value === 'string' && (EXPIRY_ALERT_STAGES as readonly string[]).includes(value);
}

function documentStageOf(expiresOn: string, asOf: string, leadDays: number | null): ExpiryAlertStage | null {
  if (expiresOn < asOf) return 'expired';
  for (const [stage, days] of DAY_STEPS) {
    const until = addDaysToDateKey(asOf, days);
    if (until !== null && expiresOn <= until) return stage;
  }
  if (leadDays === null || leadDays <= WIDEST_STEP) return null;
  const until = addDaysToDateKey(asOf, leadDays);
  return until !== null && expiresOn <= until ? 'lead' : null;
}

/** Το στάδιο της γραμμής σήμερα· `null` = τίποτα να ειπωθεί (σε ισχύ μακριά · άγνωστη · αντικατεστημένη). */
export function expiryAlertStageOf(row: RegistryRow, asOf: string): ExpiryAlertStage | null {
  if (row.kind === 'gap') return 'missing';
  if (row.state === 'superseded' || row.expiry.expiresOn === null) return null;
  return documentStageOf(row.expiry.expiresOn, asOf, documentKindSpec(row.document.kind).renewalLeadDays);
}

/** Όλες οι γραμμές σε στάδιο, σε **σταθερή** σειρά ταυτότητας (για σταθερό αποτύπωμα). */
export function currentExpiryAlerts(rows: readonly RegistryRow[], asOf: string): ExpiryAlert[] {
  return rows
    .flatMap((row): ExpiryAlert[] => {
      const stage = expiryAlertStageOf(row, asOf);
      if (stage === null) return [];
      const expiresOn = row.kind === 'gap' ? null : row.expiry.expiresOn;
      return [{ rowId: registryRowIdOf(row), stage, expiresOn, blocking: row.blocking }];
    })
    .sort((a, b) => a.rowId.localeCompare(b.rowId));
}

/** Πέρασε σε νέο στάδιο; Νέα γραμμή · άλλη λήξη (ανανέωση) · ή στάδιο **πιο επείγον** από το ειπωμένο. */
function advanced(alert: ExpiryAlert, said: AlertLedgerEntry | undefined): boolean {
  if (said === undefined || said.expiresOn !== alert.expiresOn) return true;
  return (STAGE_RANK.get(alert.stage) ?? 0) > (STAGE_RANK.get(said.stage) ?? 0);
}

/** Οι **ακμές**: οι γραμμές που έχουν κάτι νέο να πουν. Κενό ⇒ σιωπή. */
export function advancedExpiryAlerts(current: readonly ExpiryAlert[], ledger: AlertLedger): ExpiryAlert[] {
  return current.filter((alert) => advanced(alert, ledger[alert.rowId]));
}

/**
 * Το νέο ημερολόγιο. Πλήρες μητρώο ⇒ **ακριβώς** ό,τι ισχύει σήμερα (γραμμή που έφυγε ξεχνιέται, ώστε μια μελλοντική
 * επιστροφή να ξαναειπωθεί). Κομμένο μητρώο (`truncated`) ⇒ **συγχώνευση**: μια γραμμή που απλώς δεν διαβάστηκε
 * σήμερα δεν «ξεχνιέται» — αλλιώς αύριο θα ξαναστελνόταν ως νέα.
 */
export function nextAlertLedger(
  current: readonly ExpiryAlert[],
  ledger: AlertLedger,
  complete: boolean,
  escalatedNow: ReadonlySet<string> = new Set(),
): AlertLedger {
  const today = Object.fromEntries(current.map((a): [string, AlertLedgerEntry] => {
    const said = ledger[a.rowId];
    // Η κλιμάκωση μένει δεμένη με τη ΛΗΞΗ: ανανέωση (άλλη `expiresOn`) ⇒ ξαναρχίζει, όπως το στάδιο.
    const kept = said !== undefined && said.expiresOn === a.expiresOn && said.escalated;
    return [a.rowId, { stage: a.stage, expiresOn: a.expiresOn, escalated: kept || escalatedNow.has(a.rowId) }];
  }));
  return complete ? today : { ...ledger, ...today };
}

/** Ίδιο ημερολόγιο; (ώστε η σάρωση να μη γράφει όταν τίποτα δεν άλλαξε) */
export function alertLedgersEqual(a: AlertLedger, b: AlertLedger): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => b[key] !== undefined && b[key].stage === a[key].stage
    && b[key].expiresOn === a[key].expiresOn && b[key].escalated === a[key].escalated);
}

/** Το αποτύπωμα των ακμών — μπαίνει στο `eventId`, ώστε μια επανάληψη πριν γραφτεί το ημερολόγιο να μη διπλασιάσει. */
export function expiryAlertsDigest(alerts: readonly ExpiryAlert[]): string {
  return alertSetDigest(alerts.map((a) => `${a.rowId}:${a.stage}:${a.expiresOn ?? '-'}`));
}

/** Η στενότερη προβολή που περιέχει **κάθε** γραμμή της ειδοποίησης· αλλιώς «Όλα». */
export function expiryAlertLandingView(rows: readonly RegistryRow[], asOf: string): RegistryView {
  if (rows.length === 0) return REGISTRY_VIEW_ALL;
  return LANDING_VIEWS.find((view) => rows.every((row) => matchesRegistryView(row, view, asOf))) ?? REGISTRY_VIEW_ALL;
}
