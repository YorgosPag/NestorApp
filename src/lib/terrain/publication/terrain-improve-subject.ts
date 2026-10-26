/**
 * @fileoverview **Ο κάτοχος της ενότητας «Τοπογραφικό»** της οθόνης «Βελτίωσε την αγγελία σου» (ADR-920 Β4.9 · ADR-842 Φ4).
 * @related components/owner-property/improve/improve-sections (ο καταχωρητής) ·
 *   components/owner-property/improve/owner-improve-subject (ο ιδιώτης ως κάτοχος) ·
 *   ./terrain-publish-target (οι δύο θύρες)
 * @module lib/terrain/publication/terrain-improve-subject
 *
 * 🔑 Η ενότητα **δεν** ξέρει ποιο έγγραφο είναι (ιδιώτης ή γραφείο) — ίδιο δόγμα με τους αδελφούς κατόχους (κοινόχρηστα,
 *   ΠΕΑ, αντικειμενική). Ξέρει **πού** δημοσιεύει και **ποια** δημόσια αγγελία να διαβάσει για το «τι βλέπει ήδη ο αγοραστής».
 */

import type { TerrainPublishTarget } from './terrain-publish-target';

export interface TerrainImproveSubject {
  /** Η πόρτα δημοσίευσης· `null` ⇒ δεν υπάρχει πού να φυλαχτεί το τοπογραφικό — η προεπισκόπηση μένει διαθέσιμη. */
  readonly target: TerrainPublishTarget | null;
  /** Η ταυτότητα της δημόσιας αγγελίας — από εκεί διαβάζεται, ζωντανά, το έδαφος που δημοσιεύεται τώρα. */
  readonly listingId: string;
}
