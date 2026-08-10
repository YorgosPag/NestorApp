/**
 * **`/demands/new` — δημιουργία ζήτησης** (ADR-777 Α9 · **Α8**).
 *
 * 🔴 **Η ΜΟΝΗ διαδρομή του χαρακτηριστικού που είναι αποκλειστικά desktop.** Και το
 * «αποκλειστικά» είναι γεγονός **bytes**: ξεχωριστή διαδρομή ⇒ αυτόματο route-level
 * code splitting· δυναμική εισαγωγή μέσα στην πύλη ⇒ η φόρμα δεν κατεβαίνει ούτε κι
 * όταν στενή οθόνη **ανοίξει** τη διεύθυνση. Δες {@link DemandCreationGate}.
 *
 * @module app/(me)/demands/new/page
 */

import { DemandCreationGate } from '@/components/demand/DemandCreationGate';

export default function NewDemandPage() {
  return <DemandCreationGate />;
}
