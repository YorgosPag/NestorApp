'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** του `/pro` όταν ο κατάλογος ανοίγει «για» ακίνητο (ADR-945 §7.6 · ADR-744 §27.4).
 * @related agency-issuance-quote-context.tsx (ο πάροχος — στατικός, χωρίς κανένα namespace) · AgencyCard.tsx ·
 *   AgencyDirectoryContent.tsx · AgencyProfileQuoteSlot.tsx
 * @module components/mandate/issuance-quote-surfaces
 *
 * Το «Ζήτησε προσφορά» και η λωρίδα «Ζητάς προσφορά για: …» υπάρχουν **μόνο** όταν ο ιδιώτης ήρθε από ακίνητο **και** ο
 * διακόπτης `OWNER_ISSUANCE_REQUESTS` είναι ανοιχτός. Μιλούν το λεξιλόγιο του μητρώου εγγράφων (`document-registry` ·
 * ετικέτες είδους στο `conveyance`/`legality`) — με στατική εισαγωγή αυτό θα έμπαινε στο πρώτο καρέ **κάθε** επίσκεψης του
 * καταλόγου, της αρχικής και της `/stay`. Πίσω από την επιφάνεια: κώδικας **και** κείμενα ως **ένα** αίτημα, μόνο όταν
 * χρειάζονται (πρότυπο `registry-surfaces.tsx`).
 *
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 * ⛔ Όχι τοπικό `next/dynamic`: χρέος εισδοχής χωρίς αναμονή (καρέ με ωμά κλειδιά) — το αρνείται ο γεννήτορας.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

export const IssuanceQuoteSurfaces = defineLazySurfaces({
  /**
   * `slot="context-bar"` — «Ζητάς προσφορά για: …» πάνω από τη λίστα · `slot="request-button"` — «Ζήτησε προσφορά» στην
   * κάρτα και στο προφίλ. ΜΙΑ επιφάνεια: ίδιο λεξιλόγιο, ίδιο chunk (`AgencyIssuanceQuoteSurface`).
   */
  AgencyIssuanceQuote: {
    load: () => import('@/components/mandate/AgencyIssuanceQuoteSurface').then((mod) => ({ default: mod.AgencyIssuanceQuoteSurface })),
  },
});
