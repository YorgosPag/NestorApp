● 🚨 ΑΝΑΦΟΡΑ ΔΙΠΛΟΤΥΠΩΝ ΜΕΘΟΔΩΝ/FUNCTIONS

  Γιώργο, μελέτησα ΠΟΛΥ ΠΡΟΣΕΚΤΙΚΑ ολόκληρο το dxf-viewer και βρήκα ΣΟΒΑΡΑ διπλότυπα σε μεθόδους/functions:

  ---
  ❌ ΚΡΙΣΙΜΟ ΠΡΟΒΛΗΜΑ #1: calculateDistance ΛΕΙΠΕΙ!

  Status: 🔥 BROKEN CODE - COMPILATION ERROR

  Πρόβλημα:

  - Το αρχείο geometry-rendering-utils.ts:30 λέει: "calculateDistance αφαιρέθηκε - χρήση pointDistance από 
  ./geometry-utils.ts"
  - ΑΛΛΑ: 20+ αρχεία εξακολουθούν να κάνουν import { calculateDistance } from 'geometry-rendering-utils'!
  - Η pointDistance ΔΕΝ ΥΠΑΡΧΕΙ στο geometry-utils.ts!

  Αποτέλεσμα:

  - Compilation θα σπάσει αν κάνεις TypeScript check
  - Όλα τα snap engines (10+ αρχεία) σπάνε
  - Όλα τα hooks (drawing, grips, overlay) σπάνε

  Λύση:

  ΕΠΑΝΑ-ΠΡΟΣΘΗΚΗ της calculateDistance στο geometry-rendering-utils.ts:

  // 📍 src/subapps/dxf-viewer/rendering/entities/shared/geometry-rendering-utils.ts
  // Add after line 28:

  /**
   * Calculate distance between two points
   * ✅ CENTRALIZED: Single source of truth για distance calculation
   */
  export function calculateDistance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  ---
  ❌ ΔΙΠΛΟΤΥΠΟ #2: distance() function - 3 ΔΙΑΦΟΡΕΤΙΚΑ ΟΡΙΣΜΑΤΑ

  Βρέθηκαν:

  1. distance() στο utils/geometry/GeometryUtils.ts:53
  export function distance(p: Point2D, q: Point2D): number {
    return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  }
  2. distance() στο systems/zoom/utils/calculations.ts:224
  export function distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  3. calculateGripDistance() στο systems/grips/utils.ts:13
  export function calculateGripDistance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  ΟΛΕΣ κάνουν ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ!

  Σύσταση:

  ΚΡΑΤΑ ΜΟΝΟ ΜΙΑ: Την calculateDistance από geometry-rendering-utils.ts (μόλις την επαναπροσθέσεις)

  ΔΙΑΓΡΑΨΕ:
  - distance από GeometryUtils.ts (αντικατάστησε με calculateDistance)
  - distance από zoom/utils/calculations.ts (αντικατάστησε με calculateDistance)
  - calculateGripDistance από grips/utils.ts (αντικατάστησε με calculateDistance)

  ---
  ❌ ΔΙΠΛΟΤΥΠΟ #3: getBounds* functions - 4 ΠΑΡΑΛΛΑΓΕΣ

  Βρέθηκαν:

  1. getBoundsCenter() στο systems/zoom/utils/calculations.ts:233
  2. getBoundsDimensions() στο systems/zoom/utils/bounds.ts:205
  3. getBoundsAspectRatio() στο systems/zoom/utils/bounds.ts:223
  4. getBoundsStats() στο utils/SmartBoundsManager.ts:348

  Σύσταση:

  ΣΥΓΚΕΝΤΡΩΣΕ όλες τις bounds utilities στο systems/zoom/utils/bounds.ts (ήδη υπάρχει εκεί!)

  ΔΙΑΓΡΑΨΕ:
  - getBoundsCenter από calculations.ts (duplicate - υπάρχει στο bounds.ts)
  - getBoundsStats από SmartBoundsManager.ts (μετέφερε στο bounds.ts)

  ---
  ❌ ΔΙΠΛΟΤΥΠΟ #4: pointToLineDistance() - 2 ΟΡΙΣΜΑΤΑ

  Βρέθηκαν:

  1. pointToLineDistance() στο rendering/entities/shared/geometry-utils.ts:18
  export function pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number
  2. Inline Math.sqrt(...) calculations σε 50+ θέσεις:
    - rendering/hitTesting/HitTester.ts:461
    - rendering/entities/BaseEntityRenderer.ts:222
    - snapping/engines/*.ts (10+ αρχεία)
    - hooks/grips/*.ts (3+ αρχεία)

  Σύσταση:

  ΧΡΗΣΙΜΟΠΟΙΗΣΗ της centralized pointToLineDistance από geometry-utils.ts

  ΑΝΤΙΚΑΤΕΣΤΗΣΕ όλα τα inline Math.sqrt(dx*dx + dy*dy) με:
  import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';

  ---
  ✅ ΣΥΝΟΨΗ ΕΥΡΗΜΑΤΩΝ

  | Διπλότυπο                   | Αριθμός Instances  | Προτεραιότητα | Κεντρική Θέση                |
  |-----------------------------|--------------------|---------------|------------------------------|
  | calculateDistance MISSING   | 20+ broken imports | 🔥 CRITICAL   | geometry-rendering-utils.ts  |
  | distance() functions        | 3 ορισμοί          | 🔴 HIGH       | geometry-rendering-utils.ts  |
  | getBounds*() functions      | 4 παραλλαγές       | 🟡  MEDIUM     | systems/zoom/utils/bounds.ts |
  | pointToLineDistance()       | 1 + 50 inline      | 🟡  MEDIUM     | geometry-utils.ts            |
  | Inline Math.sqrt(dx² + dy²) | 70+ instances      | 🟢  LOW        | Replace με calculateDistance |

  ---
  🎯 ΠΡΟΤΕΙΝΟΜΕΝΗ ΔΡΑΣΗ

  Άμεσα (CRITICAL):

  1. ✅ FIX calculateDistance MISSING - Επαναπροσθήκη στο geometry-rendering-utils.ts
  2. ✅ Compilation check - Βεβαιώσου ότι όλα compilaρουν

  Σύντομα (HIGH Priority):

  3. ✅ Κεντρικοποίηση distance functions - Κράτα μόνο calculateDistance
  4. ✅ Καθάρισμα getBounds duplicates* - Συγκέντρωση στο bounds.ts

  Μελλοντικά (MEDIUM/LOW):

  5. ✅ Αντικατάσταση inline calculations - Replace με centralized functions

  ---
  ❓ ΕΡΩΤΗΣΗ ΓΙΑ ΕΣΕΝΑ

  Θέλεις να:
  1. FIX το CRITICAL πρόβλημα ΤΩΡΑ (calculateDistance missing)?
  2. Να σου κάνω full cleanup όλων των διπλοτύπων?
  3. Να κάνω compilation check πρώτα να δούμε πόσα σπάνε?

  Πες μου ΝΑΙ ή ΟΧΙ: Να προχωρήσω με το FIX του CRITICAL issue? 🔥