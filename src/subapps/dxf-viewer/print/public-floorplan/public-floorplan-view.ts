/**
 * @fileoverview **Η ΟΨΗ ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΑΤΟΨΗΣ** — το πρότυπο ρυθμίσεων με το οποίο ζωγραφίζεται, πάντα το ίδιο.
 * @related ADR-909 Β2.2 · §4 («το προφίλ ΔΕΝ διαβάζει τις ρυθμίσεις όψης του επιπέδου»)
 * @module subapps/dxf-viewer/print/public-floorplan/public-floorplan-view
 *
 * 🔴 **ΤΟ ΠΡΟΒΛΗΜΑ**: η μηχανή εκτύπωσης ζωγραφίζει με ό,τι ισχύει **στη συνεδρία** — απομόνωση, επίπεδο
 * τομής, V/G ανά κατηγορία, «DXF Σχέδιο», οπλισμός. Παράδειγμα: με απομονωμένη μία κολόνα, η «Δημοσίευση
 * κάτοψης» θα έστελνε στο κοινό **μόνο την κολόνα**. Και οι ρυθμίσεις όψης αλλάζουν **χωρίς** να αλλάξει
 * `revision` *(ADR-845 Ο-25: `_v` 56 έναντι `revision` 5)* — η παλαιότητα δεν θα το έβλεπε ποτέ.
 *
 * 🏆 **Η ΛΥΣΗ ΕΙΝΑΙ ΤΟΥ REVIT**: η δημοσίευση βγαίνει από **View Template**, και το *Temporary Hide/Isolate*
 * «does not affect printing». Εδώ: οι **προεπιλογές** του `resolveBimSettings` είναι το πρότυπο, και η
 * απομόνωση αναστέλλεται — για όση ώρα τρέχει η σύγχρονη απόδοση, και μόνο τότε.
 */

import { resolveBimSettings } from '../../config/bim-render-settings-types';
import { renderWithViewSettings, type ViewSettingsTemplate } from '../../state/bim-render-settings-view-scope';
import { renderWithIsolateSuspended } from '../../systems/isolate/IsolateEffectsStore';

/**
 * **Το πρότυπο**: κάθε ρύθμιση όψης στην προεπιλογή της — **εκτός** από την κλίμακα σχεδίασης.
 *
 * 🔑 «Όλα εκτός από», όχι «αυτά τα πέντε»: ρύθμιση που θα προστεθεί αύριο είναι ουδέτερη **χωρίς να τη
 * θυμηθεί κανείς** — το αντίστροφο θα την άφηνε να διαρρέει από τη συνεδρία ως τη στιγμή που θα φαινόταν.
 *
 * Η κλίμακα μένει της συνεδρίας: ορίζει το μέγεθος των κειμένων σχολιασμού, και είναι ιδιότητα του
 * **σχεδίου** που ο άνθρωπος έχει ήδη διαλέξει — όχι προσωρινή απόκρυψη.
 */
export function publicFloorplanViewTemplate(): ViewSettingsTemplate {
  const { drawingScale: _scale, drawingScaleUserSet: _locked, ...view } = resolveBimSettings(null);
  return view;
}

/**
 * **Τρέξε το `render` στην όψη της δημόσιας κάτοψης.**
 *
 * ⚠️ Σύγχρονο· κανένα `await` μέσα (το συμβόλαιο των δύο εμβελειών που συνθέτει).
 */
export function renderInPublicFloorplanView<T>(render: () => T): T {
  return renderWithIsolateSuspended(() => renderWithViewSettings(publicFloorplanViewTemplate(), render));
}
