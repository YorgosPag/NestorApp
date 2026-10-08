'use client';

/**
 * @fileoverview **Η ΚΑΡΤΕΛΑ «ΑΓΓΕΛΙΑ»** — ποιος τη βλέπει και ποιοι ψάχνουν κάτι τέτοιο.
 * @related ADR-777 §8.30 · §12.6 · ADR-864 §5.1 (Ε-10) · features/property-detail-surface
 * @module components/properties/tabs/PropertyListingTab
 *
 * 🔑 **ΗΤΑΝ ΕΝΟΤΗΤΕΣ ΠΑΝΩ ΑΠΟ ΤΙΣ ΚΑΡΤΕΛΕΣ, ΚΑΙ ΕΓΙΝΑΝ ΚΑΡΤΕΛΑ.** Όσο ζούσαν στη σελίδα `/properties/[id]`
 * έσπρωχναν τη μπάρα καρτελών τρεις οθόνες κάτω, και η δεξιά στήλη της λίστας δεν τις είχε **καθόλου** — η ίδια
 * επιφάνεια με δύο διαφορετικά περιεχόμενα. Ως καρτέλα ανήκουν στη ΜΙΑ σύνθεση (`PropertyDetailSurface`).
 *
 * 🔑 **Το κοινό παραμένει ΠΡΑΞΗ, όχι πεδίο φόρμας** (ADR-864 Ε-10): αποθηκεύεται αμέσως μέσω της ΜΙΑΣ πύλης
 * μεταλλάξεων του γραφείου. Ίχνος + επαναπροβολή τα κάνει ήδη η διαδρομή PATCH.
 *
 * 🎯 **Το πάνελ ζήτησης είναι το ίδιο με την πλευρά ιδιώτη** — ίδιος διακομιστής, ίδιος κριτής· αλλιώς οι δύο
 * οθόνες θα μπορούσαν να δείξουν **διαφορετικό αριθμό για το ίδιο ακίνητο**.
 */

import React from 'react';

import { PlaceInterestPanel } from '@/components/demand/PlaceInterestPanel';
import { MarketingAudienceControl, type AudienceChangeOutcome } from '@/components/listings/MarketingAudienceControl';
import { marketingAudienceOf, type MarketingAudience } from '@/constants/marketing-audiences';
import { usePlaceInterest } from '@/hooks/demand/usePlaceInterest';
import { isOffered } from '@/services/listings/public-listing-projection';
import { updatePropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import type { Property } from '@/types/property';

/**
 * **Αλλαγή κοινού αγγελίας γραφείου** (ADR-864 §5.1) — μέσω της ΜΙΑΣ πύλης μεταλλάξεων.
 *
 * ⚠️ Επιστρέφει `failed` αντί να πετά: το component δείχνει την αποτυχία **με λόγια**, και η
 * εμφανιζόμενη τιμή μένει η αποθηκευμένη (η ζωντανή ανάγνωση φέρνει τη νέα όταν γραφτεί).
 * Τα εταιρικά `properties` **δεν** έχουν εντολή ⇒ καμία άρνηση συναίνεσης εδώ (ADR-864 §17, δηλωμένο όριο).
 */
async function changePropertyAudience(
  property: Property,
  next: MarketingAudience,
): Promise<AudienceChangeOutcome> {
  try {
    const result = await updatePropertyWithPolicy({
      propertyId: property.id,
      currentProperty: property,
      updates: { marketingAudience: next },
    });
    return result.success ? { kind: 'saved' } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

export function PropertyListingTab({ property }: { readonly property: Property }): React.ReactElement {
  const interest = usePlaceInterest(property.id);
  const audience = marketingAudienceOf(property.marketingAudience);
  return (
    <article className="flex flex-col gap-4 p-2">
      {/* Ίδιο πλαίσιο με τις αδελφές ενότητες: ό,τι είναι ενότητα της καρτέλας έχει όριο, τίποτα δεν αιωρείται. */}
      <section className="rounded-md border border-border bg-card p-4">
        <MarketingAudienceControl
          audience={audience}
          offered={isOffered(property)}
          onChange={(next) => changePropertyAudience(property, next)}
        />
      </section>

      <PlaceInterestPanel interest={interest} audience={audience} />
    </article>
  );
}
