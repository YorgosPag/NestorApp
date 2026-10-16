/**
 * @fileoverview **Η δήλωση της φόρμας βιτρίνας, όπως φεύγει στο σύρμα** — εξήχθη από το `AgencyShowcaseContent`
 * (N.7.1, 500 γραμμές) κατά το ADR-915 §21 — η οθόνη έφτανε το όριο.
 * @related components/mandate/AgencyShowcaseContent.tsx · lib/agency/showcase-wire.ts
 * @module components/mandate/showcase-declaration
 */

import type { ShowcaseCredentialDraft } from '@/components/mandate/ShowcaseCredentialField';
import type { ShowcaseWireDeclaration } from '@/lib/agency/showcase-wire';
import type { DeclaredCoverage } from '@/types/agency-coverage';
import type { PlaceRef } from '@/types/geo/public-place';

/**
 * **Τι φεύγει στο σύρμα** — και **μόνο ταξινομημένες** ειδικότητες.
 *
 * 🔴 Μια ειδικότητα χωρίς `escoUri` *(ελεύθερο κείμενο)* **δεν μπαίνει σε κανένα
 * φίλτρο**, και η διαδρομή θα την απέρριπτε ούτως ή άλλως. Το φιλτράρισμα εδώ
 * δεν είναι σιωπηλή απόρριψη: ο **επιλογέας το λέει ήδη στον άνθρωπο**, δίπλα
 * στο πεδίο, **πριν** πατήσει *(`occupationUnclassified`)*.
 *
 * ⛔ **Κανένα `position`**: τη γεωμετρία την παράγει ο **διακομιστής** από τη γη.
 * Δες `lib/agency/showcase-wire.ts`.
 */
export function declarationOf(
  alias: string,
  credentials: readonly ShowcaseCredentialDraft[],
  place: PlaceRef | null,
  coverage: DeclaredCoverage | null,
): ShowcaseWireDeclaration {
  return {
    alias,
    // ⚠️ ADR-841 §7 Α23 Φ3.1 — προσωρινή επιλογή· η οθόνη επιλογής ονόματος/έδρας έρχεται στη Φ3.3.
    publicName: { kind: 'legal-name' },
    seatDisclosure: null,
    credentials: credentials
      .filter((draft): draft is ShowcaseCredentialDraft & { escoUri: string } => draft.escoUri !== null)
      .map((draft) => ({
        escoUri: draft.escoUri,
        registrationNumber: draft.registrationNumber,
        registrationChapter: draft.registrationChapter,
      })),
    place,
    coverage,
  };
}
