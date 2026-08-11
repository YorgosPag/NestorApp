/**
 * **`/offers/new` — καταχώρηση ακινήτου από ιδιώτη** (ADR-777 Α14 · **Α8**).
 *
 * 🔴 **Η ΜΟΝΗ διαδρομή του χαρακτηριστικού που είναι αποκλειστικά desktop.** Και το
 * «αποκλειστικά» είναι γεγονός **bytes**: ξεχωριστή διαδρομή ⇒ αυτόματο route-level
 * code splitting· δυναμική εισαγωγή μέσα στην πύλη ⇒ η φόρμα δεν κατεβαίνει ούτε κι
 * όταν στενή οθόνη **ανοίξει** τη διεύθυνση. Δες {@link OwnerPropertyCreationGate}.
 *
 * @module app/(me)/offers/new/page
 */

import { OwnerPropertyCreationGate } from '@/components/owner-property/OwnerPropertyCreationGate';

export default function NewOfferPage() {
  return <OwnerPropertyCreationGate />;
}
