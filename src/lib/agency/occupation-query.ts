/**
 * @fileoverview **ΤΙ ΖΗΤΑ Η ΤΙΜΗ `?occupation=`** — ακριβής ειδικότητα ή οικογένεια.
 * @related ADR-896 §8 · config/occupation-families.ts · lib/agency/showcase-filter.ts
 * @module lib/agency/occupation-query
 *
 * 🔑 **ΕΝΑ ΦΙΛΤΡΟ, ΔΥΟ ΕΙΣΟΔΟΙ.** Τα τσιπ και το dropdown γράφουν στο **ίδιο**
 * `ShowcaseFilters.occupation` (και στο ίδιο `?occupation=`). Η τιμή είναι είτε URI ESCO
 * *(ακριβής ειδικότητα — όπως πάντα)* είτε `family:<id>` *(επιμελημένη οικογένεια)* —
 * το ίδιο ιδίωμα προθέματος με το `?area=municipality:4905`. Καμία δεύτερη κατάσταση.
 *
 * ⚠️ **Άγνωστη οικογένεια ⇒ `null`, όχι «κανείς δεν ταιριάζει».** Ένας παλιός σύνδεσμος
 * με οικογένεια που αποσύρθηκε θα έδειχνε αλλιώς κενό κατάλογο χωρίς λόγο.
 *
 * 🏆 **ΤΡΙΤΗ ΕΙΣΟΔΟΣ — `document:<είδος>`** *(ADR-915 §21)*: «ποιος μπορεί να **εκδώσει** αυτό το έγγραφο;». Ο
 * άνθρωπος ψάχνει με αυτό που χρειάζεται (ΠΕΑ), όχι με ένα επάγγελμα που ίσως δεν ξέρει. Ο κριτής διαβάζει τον
 * **εκδότη** του καταλόγου ειδών εγγράφων — μία πηγή. Ο άξονας μένει **ένας** (`occupation`): καμία νέα κατάσταση.
 */

import {
  OCCUPATION_FAMILIES,
  type OccupationFamily,
  type OccupationFamilyId,
} from '@/config/occupation-families';
import {
  ISSUER_QUALIFICATION_SPECS,
  type IssuerQualification,
} from '@/config/document-validity/document-issuers';
import {
  DOCUMENT_KINDS,
  documentKindSpec,
  type DocumentKind,
} from '@/config/document-validity/document-validity';
import { showcaseHoldsLicence } from '@/lib/agency/showcase-licence';
import type { PublicShowcase } from '@/types/agency-profile';

export const OCCUPATION_FAMILY_PREFIX = 'family:';
export const OCCUPATION_DOCUMENT_PREFIX = 'document:';

export type OccupationQuery =
  | { readonly kind: 'esco'; readonly uri: string }
  | { readonly kind: 'family'; readonly family: OccupationFamily }
  | { readonly kind: 'document'; readonly documentKind: DocumentKind };

const FAMILY_BY_ID: ReadonlyMap<string, OccupationFamily> = new Map(
  OCCUPATION_FAMILIES.map((family) => [family.id, family]),
);

/** Η τιμή URL/φίλτρου μιας οικογένειας — η **μία** γραφή του προθέματος. */
export function familyToken(id: OccupationFamilyId): string {
  return `${OCCUPATION_FAMILY_PREFIX}${id}`;
}

/** Η τιμή URL/φίλτρου του «ποιος μπορεί να εκδώσει αυτό το έγγραφο» — η **μία** γραφή του προθέματος. */
export function documentToken(kind: DocumentKind): string {
  return `${OCCUPATION_DOCUMENT_PREFIX}${kind}`;
}

function readDocumentKind(raw: string): DocumentKind | null {
  return DOCUMENT_KINDS.find((kind) => kind === raw) ?? null;
}

/** Η τιμή του φίλτρου ως ερώτημα· `null` για κενό, για οικογένεια ή για είδος εγγράφου που δεν υπάρχει. */
export function readOccupationQuery(value: string): OccupationQuery | null {
  const raw = value.trim();
  if (raw === '') return null;
  if (raw.startsWith(OCCUPATION_DOCUMENT_PREFIX)) {
    const documentKind = readDocumentKind(raw.slice(OCCUPATION_DOCUMENT_PREFIX.length));
    return documentKind === null ? null : { kind: 'document', documentKind };
  }
  if (!raw.startsWith(OCCUPATION_FAMILY_PREFIX)) return { kind: 'esco', uri: raw };

  const family = FAMILY_BY_ID.get(raw.slice(OCCUPATION_FAMILY_PREFIX.length));
  return family === undefined ? null : { kind: 'family', family };
}

/**
 * *«Αποδεικνύει η βιτρίνα αυτό το προσόν;»* — ειδικότητα ⇒ κάποιο από τα URI στα `credentials`· άδεια ⇒ δηλωμένη
 * άδεια (με αριθμό μητρώου — ο τύπος δεν επιτρέπει άλλη). Τίτλος χωρίς ισοδύναμο ESCO ⇒ `false`, δηλωμένα.
 */
export function showcaseHasQualification(showcase: PublicShowcase, qualification: IssuerQualification): boolean {
  const spec = ISSUER_QUALIFICATION_SPECS[qualification];
  if (spec.kind === 'licence') return showcaseHoldsLicence(showcase, spec.licence);
  return showcase.credentials.some(({ occupation }) => spec.escoUris.includes(occupation.escoUri));
}

/** *«Μπορεί αυτή η βιτρίνα να εκδώσει το έγγραφο;»* — any-of προσόντα· αρχή (ΑΑΔΕ/ΕΦΚΑ) ⇒ κανείς επαγγελματίας. */
function showcaseCanIssue(showcase: PublicShowcase, kind: DocumentKind): boolean {
  const { issuer } = documentKindSpec(kind);
  return issuer.kind === 'professional' && issuer.qualifications.some((q) => showcaseHasQualification(showcase, q));
}

/** Προσφέρει η βιτρίνα αυτό που ζητείται; — **μία** απάντηση για φίλτρο και πλήθη. */
export function showcaseOffersOccupation(
  showcase: PublicShowcase,
  query: OccupationQuery,
): boolean {
  if (query.kind === 'document') return showcaseCanIssue(showcase, query.documentKind);
  return showcase.credentials.some(({ occupation }) =>
    query.kind === 'esco'
      ? occupation.escoUri === query.uri
      : query.family.escoUris.includes(occupation.escoUri),
  );
}
