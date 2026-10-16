/**
 * =============================================================================
 * Η ΔΡΟΜΟΛΟΓΗΣΗ των ειδοποιήσεων του μητρώου λήξεων (ADR-915 Φ5β · §12.4)
 * =============================================================================
 *
 * **«Ποιος πρέπει να μάθει αυτή την ακμή — και γιατί αυτός;»**
 *
 * Η αλυσίδα υπευθυνότητας, ανά ακίνητο της γραμμής — κερδίζει ο **πρώτος** κρίκος με τουλάχιστον ένα **ενεργό** μέλος:
 *
 * | # | Πηγή | Από πού |
 * |---|---|---|
 * | 1 | `explicit` | ρητός υπεύθυνος: της εντολής (ομάδα πράξης) ή του ακινήτου (Street negotiator · Zillow listing agent) |
 * | 2 | `project` | η ομάδα του έργου του ακινήτου (`project_manager` · `sales_agent`) |
 * | 3 | `document-manager` | τα μέλη με το σύνολο «υπεύθυνος εγγράφων» (Procore «Insurance Manager») |
 * | 4 | `administrator` | οι ενεργοί διαχειριστές του χώρου (η συμπεριφορά της Φ5α) |
 *
 * 🏆 **Καμία ακμή δεν «καταπίνεται»**: ένας υπεύθυνος που έφυγε ή είναι σε παύση **δεν** μετρά — η ακμή πέφτει στον
 *    επόμενο κρίκο (PagerDuty: μη διαθέσιμος ⇒ κλιμάκωση αμέσως). Αυτό ακριβώς είναι το ομολογημένο κενό του Ironclad
 *    (ειδοποίηση μόνο στον Workflow Owner, που μπορεί να λείπει).
 * 🔑 **Κλιμάκωση = δεύτερος άξονας ακμής, όχι χρονόμετρο** (Α2): ό,τι **έληξε** ή **μπλοκάρει** πηγαίνει **και** στους
 *    διαχειριστές, **μία** φορά ανά (γραμμή, λήξη). Καμία αναμονή «Χ ημερών»: το PagerDuty περιμένει επειδή υπάρχει
 *    επιβεβαίωση (ack)· εδώ δεν υπάρχει ενέργεια για να περιμένουμε, και η επανάληψη θα παραβίαζε το «ποτέ δύο φορές».
 * 🔑 **Η δρομολόγηση ΔΕΝ αποθηκεύεται**: υπολογίζεται κάθε μέρα. Αλλαγή υπευθύνου δεν «ξαναλέει» ό,τι ειπώθηκε.
 *
 * Καθαρό (leaf): ασκείται χωρίς βάση.
 *
 * @module lib/document-validity/expiry-alert-routing
 */

import type { AlertLedger, ExpiryAlert } from './expiry-alert-stage';

/** Οι πηγές, με τη σειρά της αλυσίδας. Κλειστό σύνολο. */
export const RESPONSIBILITY_SOURCES = ['explicit', 'project', 'document-manager', 'administrator'] as const;
export type ResponsibilitySource = (typeof RESPONSIBILITY_SOURCES)[number];

/** Οι ρόλοι έργου που κάνουν κάποιον υπεύθυνο των ακινήτων του έργου (ο δημιουργός μπαίνει ως `project_manager`). */
export const PROJECT_RESPONSIBLE_ROLE_IDS: readonly string[] = ['project_manager', 'sales_agent'];

/** Ποιος είναι υπεύθυνος για ένα ακίνητο, και **γιατί**. */
export interface Responsibility {
  readonly uids: readonly string[];
  readonly source: ResponsibilitySource;
}

/** Τα γεγονότα ενός ακινήτου — ωμά· η ενεργότητα κρίνεται **εδώ**, μία φορά. */
export interface PropertyResponsibilityFacts {
  readonly explicitUid: string | null;
  readonly projectUids: readonly string[];
}

/** Τα γεγονότα ενός γραφείου, όπως τα συνέλεξε ο διακομιστής. */
export interface OfficeResponsibilityFacts {
  /** Τα ενεργά μέλη του χώρου — το φίλτρο κάθε κρίκου (και του μισθωτή: ξένος δεν είναι ποτέ μέλος). */
  readonly activeUids: ReadonlySet<string>;
  readonly documentManagers: readonly string[];
  readonly administrators: readonly string[];
  readonly properties: Readonly<Record<string, PropertyResponsibilityFacts>>;
}

const NO_PROPERTY_FACTS: PropertyResponsibilityFacts = { explicitUid: null, projectUids: [] };

function activeOnly(uids: readonly (string | null)[], active: ReadonlySet<string>): string[] {
  return [...new Set(uids.filter((uid): uid is string => uid !== null && active.has(uid)))].sort();
}

/** Η αλυσίδα για ένα ακίνητο· `null` = κανένας κρίκος δεν έχει ενεργό μέλος. */
export function responsibilityOf(propertyId: string | null, office: OfficeResponsibilityFacts): Responsibility | null {
  const facts = (propertyId === null ? undefined : office.properties[propertyId]) ?? NO_PROPERTY_FACTS;
  const links: readonly (readonly [ResponsibilitySource, readonly (string | null)[]])[] = [
    ['explicit', [facts.explicitUid]],
    ['project', facts.projectUids],
    ['document-manager', office.documentManagers],
    ['administrator', office.administrators],
  ];
  for (const [source, candidates] of links) {
    const uids = activeOnly(candidates, office.activeUids);
    if (uids.length > 0) return { uids, source };
  }
  return null;
}

/** Κλιμακώνεται στη διοίκηση; Μόνο ό,τι **έληξε** ή **μπλοκάρει** (και το κενό που μπλοκάρει) — ποτέ lead/d30/d7/d0. */
export function isEscalationEligible(alert: ExpiryAlert): boolean {
  return alert.stage === 'expired' || alert.blocking;
}

/** Έχει ήδη κλιμακωθεί **αυτή** η λήξη της γραμμής; (άλλη `expiresOn` = ανανέωση ⇒ ξαναρχίζει) */
function alreadyEscalated(alert: ExpiryAlert, ledger: AlertLedger): boolean {
  const said = ledger[alert.rowId];
  return said !== undefined && said.expiresOn === alert.expiresOn && said.escalated;
}

/** Οι ακμές **κλιμάκωσης**: επιλέξιμες σήμερα και όχι ήδη ειπωμένες στη διοίκηση. */
export function escalationEdges(current: readonly ExpiryAlert[], ledger: AlertLedger): ExpiryAlert[] {
  return current.filter((alert) => isEscalationEligible(alert) && !alreadyEscalated(alert, ledger));
}

/** Γιατί ένας παραλήπτης βλέπει μια γραμμή. */
export type AlertReason = ResponsibilitySource | 'escalation';

/** Μία σύνοψη προς έναν άνθρωπο: **μόνο** οι δικές του γραμμές, με τον λόγο της καθεμιάς. */
export interface RecipientDigest {
  readonly recipientUid: string;
  readonly alerts: readonly ExpiryAlert[];
  readonly reasons: Readonly<Record<string, AlertReason>>;
}

/** Το σχέδιο αποστολής μιας σάρωσης. */
export interface ExpiryRoutingPlan {
  readonly digests: readonly RecipientDigest[];
  /** Γραμμές με ακμή που **κανείς** δεν μπορεί να μάθει — το ημερολόγιο ΔΕΝ προχωρά όσο υπάρχουν. */
  readonly unroutable: readonly string[];
  /** Οι ακμές κλιμάκωσης που **έχουν** παραλήπτη — μόνο αυτές σημαδεύονται `escalated`. */
  readonly escalated: readonly string[];
}

export interface ExpiryRoutingInput {
  readonly fresh: readonly ExpiryAlert[];
  readonly escalations: readonly ExpiryAlert[];
  readonly office: OfficeResponsibilityFacts;
  /** Γραμμή → ακίνητο (`null` όταν η γραμμή δεν δένεται σε ακίνητο). */
  readonly propertyOfRow: (rowId: string) => string | null;
}

type Inbox = Map<string, Map<string, { readonly alert: ExpiryAlert; readonly reason: AlertReason }>>;

function deposit(inbox: Inbox, uid: string, alert: ExpiryAlert, reason: AlertReason): void {
  const box = inbox.get(uid) ?? new Map<string, { readonly alert: ExpiryAlert; readonly reason: AlertReason }>();
  // Ο πρώτος λόγος μένει: ο υπεύθυνος παραμένει υπεύθυνος ακόμη κι αν είναι και διαχειριστής.
  if (!box.has(alert.rowId)) box.set(alert.rowId, { alert, reason });
  inbox.set(uid, box);
}

function digestsOf(inbox: Inbox): RecipientDigest[] {
  return [...inbox.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([recipientUid, box]) => {
      const entries = [...box.values()].sort((a, b) => a.alert.rowId.localeCompare(b.alert.rowId));
      return {
        recipientUid,
        alerts: entries.map((entry) => entry.alert),
        reasons: Object.fromEntries(entries.map((entry) => [entry.alert.rowId, entry.reason])),
      };
    });
}

/**
 * Δρομολογεί τις ακμές: κάθε ακμή σταδίου στους υπεύθυνους της αλυσίδας, κάθε ακμή κλιμάκωσης **και** στους
 * διαχειριστές· μία σύνοψη ανά άνθρωπο, ταξινομημένη (σταθερό αποτύπωμα ⇒ σταθερό `eventId`).
 */
export function routeExpiryAlerts(input: ExpiryRoutingInput): ExpiryRoutingPlan {
  const inbox: Inbox = new Map();
  const unroutable: string[] = [];
  for (const alert of input.fresh) {
    const owner = responsibilityOf(input.propertyOfRow(alert.rowId), input.office);
    if (owner === null) unroutable.push(alert.rowId);
    else owner.uids.forEach((uid) => deposit(inbox, uid, alert, owner.source));
  }
  const admins = activeOnly(input.office.administrators, input.office.activeUids);
  const escalated = admins.length === 0 ? [] : input.escalations.map((alert) => alert.rowId);
  for (const alert of admins.length === 0 ? [] : input.escalations) {
    admins.forEach((uid) => deposit(inbox, uid, alert, 'escalation'));
  }
  return { digests: digestsOf(inbox), unroutable, escalated };
}
