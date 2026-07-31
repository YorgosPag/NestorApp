/**
 * Regression guard — «ποιος κατέχει τον κοινό PreviewCanvas» (ADR-624 + ADR-189 §3.13).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο γενικός `processDrawingHover` καθαρίζει ΟΛΟΚΛΗΡΟ τον PreviewCanvas
 * όποτε δεν υπάρχει `previewEntity`. Κάθε εργαλείο που ζωγραφίζει εκεί με δικό του RAF
 * και ΔΕΝ παράγει previewEntity πρέπει να παρακάμπτει αυτό το μονοπάτι — αλλιώς το ghost
 * του σβήνεται σε ΚΑΘΕ κίνηση ποντικιού.
 *
 * Το bug χτύπησε δύο φορές: πρώτα στα placement ghosts (ADR-624), μετά στη δυναμική
 * γραμμή του «Παράλληλου οδηγού» (2026-07-18) — που είναι `category: 'drawing'`, άρα
 * περνούσε το `isInDrawingMode` και έτρωγε το clear.
 */

import {
  toolOwnsPlacementGhost,
  toolOwnsPreviewCanvas,
  TOOL_DEFINITIONS,
} from '../tool-definitions';
import type { ToolType } from '../../../ui/toolbar/types';

describe('toolOwnsPreviewCanvas', () => {
  it('καλύπτει τα placement ghosts (υπερσύνολο του toolOwnsPlacementGhost)', () => {
    const placementTools: readonly string[] = ['mep-fixture', 'floorplan-symbol', 'electrical-panel'];
    for (const tool of placementTools) {
      if (!toolOwnsPlacementGhost(tool)) continue; // αγνόησε ids που δεν υπάρχουν πια
      expect(toolOwnsPreviewCanvas(tool)).toBe(true);
    }
  });

  it('καλύπτει τον «Παράλληλο οδηγό» — το gesture preview χωρίς οντότητα', () => {
    expect(toolOwnsPreviewCanvas('guide-parallel')).toBe(true);
    // Δεν δημιουργεί οντότητα, άρα ο παλιός placement-only έλεγχος ΔΕΝ τον έπιανε.
    expect(toolOwnsPlacementGhost('guide-parallel')).toBe(false);
  });

  it('ΤΟ ΚΛΕΙΔΙ ΤΟΥ BUG: ο «Παράλληλος οδηγός» είναι drawing tool, άρα περνά το isInDrawingMode', () => {
    // Αν κάποιος αλλάξει αυτό το category, ο λόγος ύπαρξης της παράκαμψης αλλάζει —
    // και πρέπει να ξανασκεφτεί κανείς τη ροή, όχι να σβήσει σιωπηλά το test.
    expect(TOOL_DEFINITIONS['guide-parallel' as ToolType].category).toBe('drawing');
  });

  it('καλύπτει το «Εικόνα» (attach-image) — ghost που ζωγράφιζε και σβηνόταν στο ίδιο frame', () => {
    // ADR-736 §6: μετρημένο ζωντανά — 3 `drawImage` στον PreviewCanvas, 0 ορατά pixels,
    // γιατί ο `processDrawingHover` καθάριζε αμέσως μετά μέσα στον ΙΔΙΟ mousemove.
    expect(toolOwnsPreviewCanvas('attach-image')).toBe(true);
    expect(toolOwnsPlacementGhost('attach-image')).toBe(true);
  });

  it('ΤΟ ΚΛΕΙΔΙ ΤΟΥ BUG: τα 4 catalog entourage αδέλφια δίνουν ΤΟΝ ΙΔΙΟ τύπο οντότητας χωρίς ghost', () => {
    // Γι' αυτό το `attach-image` δηλώνεται ανά **tool id** και όχι ως entity type `'image'`:
    // ένας τύπος-ιδιοκτήτης θα έκανε ιδιοκτήτες και αυτά τα 4, που τοποθετούν στα τυφλά
    // (ADR-654) — και ο καμβάς δεν θα καθαριζόταν ποτέ όσο είναι ενεργά.
    for (const tool of ['furniture-plan', 'people-plan', 'vehicles-plan', 'plants-plan']) {
      expect(toolOwnsPreviewCanvas(tool)).toBe(false);
    }
    // Αν κάποιο από τα 4 αποκτήσει ghost mount, ΑΥΤΟ το test κοκκινίζει — και αυτό είναι το
    // νόημα: πρέπει να μπει στο `PLACEMENT_GHOST_OWNER_TOOLS`, όχι να σβηστεί η γραμμή.
  });

  it('ΔΕΝ πιάνει εργαλεία που δεν κατέχουν τον καμβά', () => {
    expect(toolOwnsPreviewCanvas('select')).toBe(false);
    expect(toolOwnsPreviewCanvas('line')).toBe(false);
    expect(toolOwnsPreviewCanvas('guide-x')).toBe(false);
    expect(toolOwnsPreviewCanvas(null)).toBe(false);
    expect(toolOwnsPreviewCanvas(undefined)).toBe(false);
  });
});
