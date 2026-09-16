/**
 * @fileoverview **Η ΣΥΝΑΙΝΕΣΗ ΤΟΥ ΠΩΛΗΤΗ ΓΙΑ ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ** — γεγονότα append-only πάνω στην εντολή.
 * @related ADR-864 §5.4 · §17 (Φ3 Μέρος Β) · ADR-861 §7 · types/owner-property-mandate.ts
 * @module types/private-marketing-consent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΓΕΓΟΝΟΤΑ ΚΑΙ ΟΧΙ ΠΕΔΙΟ — ΚΑΙ ΓΙΑΤΙ ΠΑΝΩ ΣΤΗΝ ΕΝΤΟΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Πάνω στην εντολή** (§5.4): η συναίνεση αφορά **αυτό** το γραφείο και **αυτή** τη
 *   διάρκεια (δήλωση `relationship` του κειμένου). Νέο γραφείο ή παράταση ⇒ άλλη σύμβαση ⇒ η
 *   παλιά συναίνεση **δεν** μεταφέρεται (Α17). Καμία νέα συλλογή (§5.4, ADR-749).
 * - **Γεγονότα append-only** (πρακτική αρχείων συναίνεσης ΓΚΠΔ): η ανάκληση είναι **νέα**
 *   εγγραφή, ποτέ σβήσιμο. Ένα `consented: boolean` θα ξεχνούσε **ποιο κείμενο** διαβάστηκε
 *   (Α8) — και θα το ξεχνούσε σιωπηλά.
 * - **Η έκδοση ταξιδεύει με αποτύπωμα** (ADR-861): «τι διάβασε» = παγωμένη έκδοση + τιμές θέσεων.
 *
 * ⚠️ Δηλωμένη απόκλιση από το σχέδιο §17.5: **κανένα γεγονός `concluded`**. Το τέλος της εντολής
 * είναι **παράγωγο** (λήξη/ανάκληση/νέοι όροι — {@link PrivateMarketingTerm}), και γεγονός που
 * αντιγράφει παράγωγη κατάσταση είναι δεύτερη αλήθεια (ADR-749).
 *
 * **Layering**: leaf — τύποι + κλειστά λεξιλόγια. Μόνο `import type` προς την εντολή (CHECK 3.80).
 */

import type { LegalDocumentLocale } from '@/constants/legal-documents';
import type { MarketingAudience } from '@/constants/marketing-audiences';
import type { MandateProof } from '@/types/owner-property-mandate';

/** Το νομικό κείμενο που υπογράφει κάθε συναίνεση κλειστής διάθεσης (ADR-861 §7.3α). */
export const PRIVATE_MARKETING_DOCUMENT = 'private-marketing-disclosure' as const;

/** Κοινό **εκτός** `public` — το μόνο που χρειάζεται συναίνεση. */
export type ClosedMarketingAudience = Exclude<MarketingAudience, 'public'>;

/** Στενευτής — **όχι** δεύτερη απαρίθμηση του λεξιλογίου (CHECK 3.73): ορίζεται ως «όχι `public`». */
export function isClosedMarketingAudience(audience: MarketingAudience): audience is ClosedMarketingAudience {
  return audience !== 'public';
}

/** **Ποιο κείμενο** — αριθμός έκδοσης **και** αποτύπωμα (Α8). Ποτέ «η τελευταία». */
export interface ConsentTextRef {
  readonly document: typeof PRIVATE_MARKETING_DOCUMENT;
  readonly version: number;
  /** `sha256:…` από το μητρώο — επαληθεύσιμο από οποιονδήποτε (ADR-861 §7.2). */
  readonly digest: string;
}

/**
 * **Η διάρκεια της εντολής που ίσχυε τη στιγμή της συναίνεσης** (Α17).
 *
 * 🔑 Η δήλωση `relationship` λέει *«αυτό το γραφείο, έως {expiresOn}»*. Αν αλλάξει έστω και ένα
 * από τα τρία, ο άνθρωπος **δεν** έδωσε συναίνεση για ό,τι ισχύει τώρα.
 */
export interface PrivateMarketingTerm {
  readonly agencyCompanyId: string;
  readonly startsAt: string;
  readonly expiresAt: string;
}

/** Οι τιμές των θέσεων όπως **τις διάβασε** ο άνθρωπος (`LEGAL_TEXT_PLACEHOLDERS`). */
export interface ConsentPlaceholderValues {
  readonly agency: string;
  readonly expiresOn: string;
}

/** Από πού ήρθε η απάντηση — τρεις δρόμοι (Ε-11 · Ε-12). */
const PRIVATE_MARKETING_CHANNELS = ['link', 'account', 'form'] as const;
export type PrivateMarketingChannel = (typeof PRIVATE_MARKETING_CHANNELS)[number];

/** Τι γίνεται η καταχώρηση όταν ανακληθεί η συναίνεση (Ε-13). **Ποτέ** κλειστή. */
export const PRIVATE_MARKETING_REVOCATION_OUTCOMES = ['public', 'withdrawn'] as const;
export type PrivateMarketingRevocationOutcome = (typeof PRIVATE_MARKETING_REVOCATION_OUTCOMES)[number];

/** Το γραφείο **ζητά** κλειστή διάθεση — δεν αλλάζει τίποτα ορατό (Ε-11). */
interface PrivateMarketingRequested {
  readonly kind: 'requested';
  /** Ταυτότητα γεγονότος — η παροχή δηλώνει **ποιο** αίτημα εκτελεί (Α19). */
  readonly id: string;
  readonly at: string;
  readonly requestedByUserId: string;
  readonly audience: ClosedMarketingAudience;
}

/** Ο ιδιοκτήτης **συναινεί** — και το στένεμα εκτελείται στην ίδια πράξη (Ε-11). */
export interface PrivateMarketingGranted {
  readonly kind: 'granted';
  readonly id: string;
  readonly at: string;
  /** Το αίτημα που εκτελέστηκε· `null` όταν ο ιδιοκτήτης στένεψε ο ίδιος (λογαριασμός). */
  readonly requestId: string | null;
  readonly audience: ClosedMarketingAudience;
  readonly text: ConsentTextRef;
  /** Τα ids των δηλώσεων που επιβεβαιώθηκαν **χωριστά** (Bright MLS, μονογραφή ανά δήλωση). */
  readonly acknowledged: readonly string[];
  readonly values: ConsentPlaceholderValues;
  readonly locale: LegalDocumentLocale;
  readonly channel: PrivateMarketingChannel;
  /** Ο λογαριασμός που ενήργησε — `null` στον σύνδεσμο (ο ιδιοκτήτης δεν έχει λογαριασμό). */
  readonly actorUserId: string | null;
  /** Στο έντυπο: `AgencyAttestation` με **υποχρεωτικό** έγγραφο (Α20). */
  readonly proof: MandateProof;
  readonly term: PrivateMarketingTerm;
}

/** Ο ιδιοκτήτης **ανακαλεί** — η καταχώρηση γίνεται δημόσια ή αποσύρεται, ατομικά (Α16). */
interface PrivateMarketingRevoked {
  readonly kind: 'revoked';
  readonly id: string;
  readonly at: string;
  readonly outcome: PrivateMarketingRevocationOutcome;
  readonly channel: Exclude<PrivateMarketingChannel, 'form'>;
  readonly actorUserId: string | null;
}

export type PrivateMarketingEvent =
  | PrivateMarketingRequested
  | PrivateMarketingGranted
  | PrivateMarketingRevoked;

/**
 * **Πού βρίσκεται η συναίνεση** — όνομα, ποτέ `boolean` (Α8).
 *
 * | Κατάσταση | Σημαίνει |
 * |---|---|
 * | `granted` | ενεργή συναίνεση για **τους τρέχοντες** όρους της εντολής |
 * | `requested` | εκκρεμεί αίτημα, καμία ενεργή συναίνεση |
 * | `outdated` | υπήρξε συναίνεση, αλλά για **άλλους** όρους (Α17) |
 * | `revoked` | η τελευταία πράξη ήταν ανάκληση |
 * | `absent` | τίποτα δεν ζητήθηκε ποτέ |
 */
export type PrivateMarketingStanding =
  | { readonly kind: 'granted'; readonly grant: PrivateMarketingGranted }
  | { readonly kind: 'requested'; readonly request: PrivateMarketingRequested }
  | { readonly kind: 'outdated' }
  | { readonly kind: 'revoked' }
  | { readonly kind: 'absent' };

/**
 * **Γιατί αρνήθηκε η υπηρεσία συναίνεσης** — κλειστό σύνολο, κωδικός = κλειδί i18n (N.11).
 *
 * ⚠️ Το `private-marketing-consent-missing` **ΔΕΝ** είναι εδώ: είναι παραβίαση **εντολής**
 * (`MANDATE_INVARIANTS`), γιατί την παράγει **κάθε** γραφέας, όχι μόνο αυτή η υπηρεσία.
 */
export const PRIVATE_MARKETING_REFUSALS = [
  /** Δεν υπάρχει δεσμευτική εντολή — η συναίνεση δεν έχει αντικείμενο (Α7β). */
  'consent-not-applicable',
  /** Υποβλήθηκε **παλιά** έκδοση κειμένου — ο άνθρωπος πρέπει να διαβάσει τη νέα (Α8α). */
  'consent-text-superseded',
  /** Λείπει επιβεβαίωση έστω μίας δήλωσης (Α8β). */
  'consent-incomplete',
  /** Το αίτημα που εκτελείται **δεν** είναι το τρέχον (Α19). */
  'consent-request-stale',
  /** Έντυπο χωρίς ανεβασμένο υπογεγραμμένο αρχείο (Α20). */
  'consent-document-missing',
  /** Ανάκληση χωρίς ενεργή συναίνεση — δεν υπάρχει τι να ανακληθεί. */
  'consent-not-granted',
  /** Αίτημα ενώ η συναίνεση **ήδη ισχύει** για τους τρέχοντες όρους — το στένεμα περνά ήδη. */
  'consent-already-granted',
] as const;

export type PrivateMarketingRefusal = (typeof PRIVATE_MARKETING_REFUSALS)[number];
