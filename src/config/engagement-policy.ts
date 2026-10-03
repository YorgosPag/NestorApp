/**
 * Πολιτική λήξης συμμετοχής σε υπόθεση (ADR-862 §5.3.3 · ADR-901 §5.3/§5.7).
 *
 * 🔑 Η λήξη **παράγεται** από αυτούς τους αριθμούς — **ποτέ** πληκτρολογείται ανά έγγραφο.
 *
 * - **Πρόταση** (`offered`): 14 ημέρες για «Αναλαμβάνω» — ✅ ADR-901 Ε-5 (ο επαγγελματίας λείπει συχνά
 *   στα δικαστήρια). Ίδιος αριθμός με τη λήξη της πρόσκλησης, γιατί είναι η **ίδια** απόφαση.
 * - **Ενεργή** (`active`): η **κύρια** λήξη είναι το κλείσιμο/ακύρωση της υπόθεσης (⇒ `completed`).
 *   Το ταβάνι εδώ είναι **δίχτυ ασφαλείας** (N.7.2 #4): υπόθεση που ξεχάστηκε ανοιχτή δεν κρατά
 *   ζωντανή την πρόσβαση ενός ξένου για πάντα. ⛔ ΜΗΝ το διαβάσεις ως «περίοδο χάριτος» μετά την
 *   ανάκληση — η ανάκληση είναι **άμεση** (ADR-787 Ε-2 §5).
 *
 * @module config/engagement-policy
 */

import type { ChecklistProvider } from '@/config/conveyance-checklist/types';
import type { ConveyanceCaseState } from '@/types/conveyance-case';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 📤 ADR-901 Φ4.4 — **ΠΟΤΕ** στέλνει έγγραφα (transmittal) κάθε ρόλος: ρόλος × κατάσταση υπόθεσης.
 *
 * 🔑 **Δυνατότητα από τον ΡΟΛΟ, όχι σφραγισμένη στο μέλος** — όπως οι μεγάλοι: στο Autodesk Docs το «View + Upload»
 * ορίζεται ανά ρόλο/εταιρεία και το **κληρονομεί** κάθε μέλος (και όσα υπήρχαν ήδη)· στο Zanzibar τα δικαιώματα
 * **υπολογίζονται** τη στιγμή του ελέγχου από κανόνες πάνω στη σχέση. Γι' αυτό **δεν** υπάρχει αποθηκευμένο scope
 * «contribute» στη συμμετοχή (ούτε backfill): το `conveyance:case:view` μένει η **συναίνεση/πρόσβαση** και η
 * αποστολή **παράγεται** από αυτόν τον πίνακα.
 *
 * 🏆 Και **χρονικός** (το πάγωμα Ε-6 / Α9 ζει εδώ, όχι σε if διάσπαρτα): μετά την υπογραφή ο δικηγόρος δεν αλλάζει
 * πια τίποτα — ο συμβολαιογράφος συνεχίζει (οριστικό · αποδεικτικό φόρου · καταχώριση). Κλείσιμο/ακύρωση ⇒ κανείς.
 * `Record` πάνω σε **όλους** τους ρόλους: νέος ρόλος χωρίς πολιτική = σφάλμα μεταγλώττισης, όχι σιωπηλή άρνηση.
 */
export const CONTRIBUTION_STATES_BY_ROLE: Readonly<Record<LegalProfessionalRole, readonly ConveyanceCaseState[]>> = {
  seller_lawyer: ['open'],
  buyer_lawyer: ['open'],
  notary: ['open', 'signed', 'registered'],
};

/**
 * 📨 ADR-901 Φ4.5 — **ΣΕ ΠΟΙΟΝ** πάει το «Ζήτησε έγγραφο»: ο πάροχος της γραμμής → ο **λογαριασμός** που τον εκπροσωπεί.
 *
 * Όπως το «Ball in Court» του Procore, αλλά ο παραλήπτης **δεν** διαλέγεται με το χέρι: τον ορίζει ο πάροχος της
 * γραμμής, και ο κριτής (`lib/conveyance/document-request-policy.ts`) τον κρίνει ως **ενεργό τώρα** και ως κάποιον
 * που **βλέπει** τη γραμμή. Λίστα διανομής από το UI **δεν** υπάρχει (Α29).
 *
 * - `host`           — η πλευρά του πωλητή είναι ο οικοδεσπότης· μηχανικός και αρχές δεν έχουν λογαριασμό — τα
 *                      φέρνει ο οικοδεσπότης (όπως σήμερα: ανεβαίνουν στην καρτέλα «Έγγραφα»)
 * - `own-side-lawyer`— ο δικηγόρος **της πλευράς του αιτούντος** (`ownSideOnly`): ο καθένας ζητά τη δική του έκθεση
 * - `buyer_lawyer`   — αγοραστής και τράπεζα **δεν** είναι λογαριασμοί ως τη Φ5· τους εκπροσωπεί ο δικηγόρος τους
 *                      (όπως ο agent στο Dotloop). Χωρίς ενεργό δικηγόρο αγοραστή ⇒ `no-recipient`, δηλωμένα
 *
 * `Record` πάνω σε **όλους** τους παρόχους: νέος πάροχος χωρίς δρομολόγηση = σφάλμα μεταγλώττισης.
 */
export const REQUEST_RECIPIENT_BY_PROVIDER: Readonly<Record<ChecklistProvider, LegalProfessionalRole | 'host' | 'own-side-lawyer'>> = {
  seller: 'host',
  engineer: 'host',
  authority: 'host',
  notary: 'notary',
  lawyer: 'own-side-lawyer',
  buyer: 'buyer_lawyer',
  bank: 'buyer_lawyer',
};

/** ADR-901 Φ4.5 — πόσες γραμμές ζητούνται σε **ένα** πάτημα («Ζήτησε όλα τα ελλείποντα»): όριο αιτήματος, όχι UI. */
export const DOCUMENT_REQUEST_BATCH_MAX = 50;

export const ENGAGEMENT_OFFER_TTL_DAYS = 14;
export const ENGAGEMENT_ACTIVE_CEILING_DAYS = 365;

/** Η λήξη μιας **πρότασης** που γίνεται τη στιγμή `nowMs`. */
export function offerExpiresAt(nowMs: number): string {
  return new Date(engagementInvitationExpiryMs(nowMs)).toISOString();
}

/** Το ταβάνι μιας **ενεργής** συμμετοχής που αποδέχτηκε κάποιος τη στιγμή `nowMs`. */
export function activeExpiresAt(nowMs: number): string {
  return new Date(nowMs + ENGAGEMENT_ACTIVE_CEILING_DAYS * DAY_MS).toISOString();
}

/**
 * ADR-901 Ε-5 — αν ο επαγγελματίας δεν απαντήσει σε **3** ημέρες, υπενθυμίζεται **ο προσκαλών** (όχι ο
 * επαγγελματίας: ο οικοδεσπότης ξέρει αν πρέπει να τηλεφωνήσει, να ξαναστείλει ή να ορίσει άλλον).
 */
export const ENGAGEMENT_INVITATION_REMINDER_DAYS = 3;

/** Η λήξη μιας **πρόσκλησης** με email — ο **ίδιος** αριθμός με την πρόταση (μία απόφαση, Ε-5). */
export function engagementInvitationExpiryMs(nowMs: number): number {
  return nowMs + ENGAGEMENT_OFFER_TTL_DAYS * DAY_MS;
}

/** Πότε οφείλεται η υπενθύμιση στον προσκαλούντα — γράφεται **στην έκδοση**, ποτέ υπολογίζεται στο sweep. */
export function engagementInvitationReminderDueAt(nowMs: number): string {
  return new Date(nowMs + ENGAGEMENT_INVITATION_REMINDER_DAYS * DAY_MS).toISOString();
}
