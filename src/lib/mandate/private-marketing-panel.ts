/**
 * @fileoverview **Η ΣΥΝΑΙΝΕΣΗ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ, ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Η ΟΘΟΝΗ** — ένας τύπος, δύο οθόνες λογαριασμού.
 * @related ADR-864 §18.4 Δ2 · Α25 · Α26 · services/mandate/private-marketing-panel.service.ts ·
 *   app/(auth)/mandate/[token]/page.tsx
 * @module lib/mandate/private-marketing-panel
 *
 * 🔑 **Ό,τι αποφασίζει τον CAS, το αποφασίζει ο διακομιστής** (Α25): η **επωνυμία** (`companies`, όχι η
 * βιτρίνα που βλέπει ο ιδιοκτήτης αλλού) και η **λήξη** μορφοποιούνται **στον διακομιστή**, μία φορά, και ταξιδεύουν
 * στην οθόνη μέσα σε αυτόν τον τύπο· η οθόνη στέλνει πίσω **ακριβώς** αυτές. Υπολογισμός στον browser θα έβγαζε άλλο όνομα ⇒ κάθε
 * «Συναινώ» θα γύριζε `consent-text-superseded`.
 *
 * 🔴 **Η κατάσταση ταξιδεύει ΜΕ ΟΝΟΜΑ** (Α26): `outdated` **δεν** συμπτύσσεται σε `absent` — ο άνθρωπος
 * οφείλει να μάθει «οι όροι άλλαξαν», όχι «δεν συναινέσατε ποτέ».
 *
 * ⛔ **Καμία απόδειξη στο σύρμα**: από τη συναίνεση φεύγουν μόνο έκδοση · ημερομηνία · κανάλι · κοινό (ό,τι
 * δείχνει μια γραμμή τύπου Figma «έκδοση · πότε · πώς»). `proof.documentPath` και `actorUserId` μένουν στη βάση.
 *
 * **Layering**: leaf — τύποι + ελαφριές καθαρές συναρτήσεις. ⚠️ **Κανένα** runtime import προς το μητρώο εκδόσεων
 * (`consentValuesFor` → `legal-document-versions`): ο browser εισάγει αυτό το module. Ο κατασκευαστής πάνελ ζει στον
 * διακομιστή (`privateMarketingPanelOf`, services/mandate/private-marketing-panel.service.ts).
 */

import type { MarketingAudience } from '@/constants/marketing-audiences';
import type { EvidenceView } from '@/lib/mandate/mandate-evidence';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { privateMarketingStandingOf } from '@/lib/mandate/private-marketing-standing';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import type {
  ClosedMarketingAudience,
  ConsentPlaceholderValues,
  PrivateMarketingChannel,
} from '@/types/private-marketing-consent';

/** Η κατάσταση **χωρίς** την απόδειξη — ό,τι χρειάζεται μια γραμμή κατάστασης. */
export type PrivateMarketingStandingView =
  | { readonly kind: 'granted'; readonly version: number; readonly at: string; readonly channel: PrivateMarketingChannel; readonly audience: ClosedMarketingAudience }
  | { readonly kind: 'requested'; readonly requestId: string; readonly at: string; readonly audience: ClosedMarketingAudience }
  | { readonly kind: 'outdated' }
  | { readonly kind: 'revoked' }
  | { readonly kind: 'declined'; readonly at: string }
  | { readonly kind: 'absent' };

/** Μία εντολή — ένα γραφείο. */
export interface PrivateMarketingPanel {
  readonly agencyCompanyId: string;
  /** Η επωνυμία **του CAS** — κενό όταν η `companies` δεν τη γνωρίζει (η οθόνη το ονομάζει). */
  readonly agencyName: string;
  readonly standing: PrivateMarketingStandingView;
  /** Οι τιμές θέσεων, **έτοιμες** — αυτές ακριβώς επιστρέφει η φόρμα (Α25). */
  readonly values: ConsentPlaceholderValues;
  /**
   * **Πότε ανοίγει το επόμενο αίτημα** — `null` = τώρα (Α30). Του **διακομιστή**, από τον ίδιο κριτή που
   * αρνείται (`nextRequestAtOf`): η οθόνη δεν δείχνει κουμπί που θα γύριζε `consent-request-cooling`.
   */
  readonly nextRequestAt: string | null;
  /** Τα **παγωμένα** υπογεγραμμένα έντυπα αυτής της εντολής (ADR-864 §19 · Α33) — χωρίς διαδρομή. */
  readonly evidence: readonly EvidenceView[];
}

/** Ποιος ρωτά — αλλάζει **τι** προσφέρει η οθόνη, όχι τι είναι αληθές. */
type PrivateMarketingViewer = 'owner' | 'agency';

export interface PrivateMarketingPanels {
  readonly viewer: PrivateMarketingViewer;
  readonly marketingAudience: MarketingAudience;
  /** Το κείμενο **σε ισχύ** — `null` αν δεν έχει παγώσει έκδοση (τότε καμία συναίνεση δεν δίνεται). */
  readonly disclosure: LegalDocumentVersion | null;
  readonly panels: readonly PrivateMarketingPanel[];
}

export function privateMarketingStandingViewOf(mandate: BrokeredListingMandate): PrivateMarketingStandingView {
  const standing = privateMarketingStandingOf(mandate);
  switch (standing.kind) {
    case 'granted':
      return { kind: 'granted', version: standing.grant.text.version, at: standing.grant.at, channel: standing.grant.channel, audience: standing.grant.audience };
    case 'requested':
      return { kind: 'requested', requestId: standing.request.id, at: standing.request.at, audience: standing.request.audience };
    case 'declined':
      return { kind: 'declined', at: standing.decline.at };
    default:
      return { kind: standing.kind };
  }
}

/**
 * **Ποια γραφεία περιμένουν συναίνεση του ιδιοκτήτη** (Α24) — κάθε εντολή **χωρίς** ενεργή συναίνεση.
 * `outdated` · `revoked` · `absent` · `requested` μετρούν όλα: μόνο το `granted` καλύπτει τους τρέχοντες όρους.
 */
export function panelsAwaitingConsent(panels: readonly PrivateMarketingPanel[]): readonly PrivateMarketingPanel[] {
  return panels.filter((panel) => panel.standing.kind !== 'granted');
}

/** Το αίτημα που εκτελείται για αυτό το γραφείο — `null` όταν ο ιδιοκτήτης στενεύει χωρίς αίτημα. */
export function pendingRequestIdOf(panel: PrivateMarketingPanel): string | null {
  return panel.standing.kind === 'requested' ? panel.standing.requestId : null;
}
