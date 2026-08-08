/**
 * 🔴 ADR-775 §13 — **ΤΟ ΙΧΝΟΣ ΚΛΗΣΕΩΝ ΣΧΕΔΙΑΣΗΣ ως κύριο δίχτυ** του καμβά DXF.
 *
 * ## Τι ρωτά, και γιατί καμία υπάρχουσα δοκιμή δεν το ρωτούσε
 * «Όταν δώσω στον `DxfRenderer` μια σκηνή, **χαράζει**;» — και, ένα επίπεδο παρακάτω,
 * «χαράζει **αυτά** που περιέχει η σκηνή;».
 *
 * Η σουίτα e2e νόμιζε ότι το ρωτούσε. Μετρημένο 2026-08-08: **39 από 39** committed golden
 * δεν περιείχαν ούτε μία γραμμή σχεδίου — 22 φωτογράφιζαν τη **σελίδα σφάλματος** και 17 κενό
 * καμβά — και **τέσσερα** από αυτά ήταν **πράσινα**, δηλαδή βεβαίωναν τη βλάβη. Η αιτία ήταν
 * ότι το δοκιμαστήριο δεν είχε `CursorSystem`, άρα ο `DxfCanvas` πετούσε στο πρώτο render και
 * **κανένας καμβάς δεν προσαρτήθηκε ποτέ**, από την πρώτη μέρα της σουίτας.
 *
 * Ένα pixel golden **δεν μπορεί** να πιάσει αυτό: ένα ολόμαυρο PNG είναι απολύτως έγκυρο PNG.
 * Ένα **κενό ίχνος κλήσεων** είναι προφανώς κενό. Γι' αυτό το ίχνος είναι το **κύριο** δίχτυ
 * και τα pixels το **δευτερεύον** — αντίστροφα απ' ό,τι κάναμε τρεις μήνες.
 *
 * ## Γιατί τρέχει σε jest χωρίς browser
 * Ο {@link createRecordingCanvas} δίνει στον `DxfRenderer` καμβά που παραδίδει ψεύτικο
 * context. Κόστος: δευτερόλεπτα, όχι **41,4 λεπτά** — και χωρίς dev server, χωρίς Docker,
 * χωρίς golden αρχεία που μπορούν να «συγχρονιστούν» μαζικά σε λάθος κατάσταση.
 */

// Stub Firebase auth chain before any imports — `DxfRenderer` → `EntityRendererComposite` →
// `BaseEntityRenderer` → `PhaseManager` → `GripProvider` → settings-provider → firestore.
// Ίδιο μοτίβο με τα υπάρχοντα tests των renderers (π.χ. `ColumnRenderer-hatch.test.ts`):
// η αλυσίδα είναι **υπαρκτή στον παραγωγικό κώδικα**, όχι τεχνούργημα της δοκιμής.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DxfRenderer } from '../DxfRenderer';
import {
  createPaintLog,
  createRecordingCanvas,
  totalDrawCalls,
  type PaintLog,
} from '../../../testing/paint-recorder';
import type { DxfScene } from '../dxf-types';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

const VIEWPORT: Viewport = { width: 1280, height: 800 };

/**
 * Ο μετασχηματισμός του `fitToView` πάνω στο fixture, **μετρημένος στον ζωντανό ζωγράφο**
 * (2026-08-08, `/test-harness/dxf-canvas`). Καρφωμένος επίτηδες: αν τον υπολόγιζε το test
 * μόνο του, θα δοκίμαζε τον δικό του υπολογισμό και θα ήταν πράσινο ό,τι κι αν έκανε ο
 * `FitToViewService`.
 */
const FITTED: ViewTransform = { scale: 3.6, offsetX: -260, offsetY: -320 };

/**
 * 🔑 **ΤΟ ΙΔΙΟ fixture με τη σουίτα e2e** — διαβασμένο από τον δίσκο, όχι ξαναγραμμένο εδώ.
 *
 * ⚠️ Η πρώτη γραφή αυτής της δοκιμής **ξαναέγραφε** τη σκηνή με το χέρι «επειδή το jest δεν
 * σερβίρει δημόσια assets». Το `fs` όμως τα διαβάζει μια χαρά, και η χειρόγραφη εκδοχή
 * μάντεψε λάθος ονόματα πεδίων ⇒ ο renderer ζωγράφισε **μηδέν** και η δοκιμή έγινε κόκκινη
 * για λόγο **άσχετο** με τον ζωγράφο. Δεύτερο αντίγραφο του fixture είναι δεύτερη αλήθεια
 * που αποκλίνει σιωπηλά: όταν αλλάξει το fixture της e2e, το ίχνος θα φρουρούσε σκηνή που
 * κανείς δεν ζωγραφίζει πια.
 */
function scene(): DxfScene {
  const file = join(process.cwd(), 'public', 'test-fixtures', 'dxf', 'regression-scene.json');
  return JSON.parse(readFileSync(file, 'utf8')) as DxfScene;
}

function paint(target: DxfScene | null, transform: ViewTransform): PaintLog {
  const log = createPaintLog();
  const renderer = new DxfRenderer(createRecordingCanvas(log, VIEWPORT));
  renderer.render(target, transform, VIEWPORT, {
    showGrid: false,
    showLayerNames: false,
    wireframeMode: false,
    selectedEntityIds: [],
  });
  return log;
}

describe('ADR-775 §13 — ίχνος κλήσεων σχεδίασης του καμβά DXF', () => {
  /**
   * 🔑 **Η ΑΓΚΥΡΑ.** Αυτή η μία γραμμή είναι όλη η διαφορά με τους τρεις μήνες: αν ο ζωγράφος
   * δεν χαράξει τίποτα, το ίχνος είναι **κενό** και η δοκιμή γίνεται κόκκινη αμέσως — ενώ ένα
   * κενό PNG πέρασε 39 φορές για συμβόλαιο.
   */
  it('Α1 — μια σκηνή με οντότητες παράγει ΜΗ ΚΕΝΟ ίχνος', () => {
    const log = paint(scene(), FITTED);
    expect(totalDrawCalls(log)).toBeGreaterThan(0);
  });

  /**
   * Το συμπλήρωμα του Α1, και ο λόγος που το Α1 δεν είναι αυτο-επικυρούμενο: αν ο
   * καταγραφέας μετρούσε ως «μελάνι» κάτι που κάθε πέρασμα κάνει ούτως ή άλλως (π.χ. το
   * `clearRect` του καθαρισμού), το Α1 θα ήταν πράσινο **και με κενή σκηνή**.
   */
  it('Α2 — ΚΕΝΗ σκηνή παράγει ΚΕΝΟ ίχνος (αλλιώς το Α1 δεν αποδεικνύει τίποτα)', () => {
    expect(totalDrawCalls(paint({ entities: [] } as unknown as DxfScene, FITTED))).toBe(0);
    expect(totalDrawCalls(paint(null, FITTED))).toBe(0);
  });

  /**
   * Το ίχνος δεν λέει μόνο «κάτι ζωγραφίστηκε» αλλά **τι**: κάθε οικογένεια οντοτήτων του
   * fixture οφείλει να αφήσει το δικό της αποτύπωμα. Χωρίς αυτό, ένας ζωγράφος που χάραζε
   * **μόνο** γραμμές θα ήταν πράσινος στο Α1 με τους κύκλους εξαφανισμένους.
   */
  /**
   * ⚠️ **ΜΕΤΡΗΜΕΝΟ ΟΡΙΟ, δηλωμένο**: ο καμβάς DXF χαράζει κύκλους/τόξα μέσω `ctx.ellipse`,
   * **όχι** `ctx.arc`. Μια μετάλλαξη που κατάπινε το `arc` άφησε **και τα 4 tests πράσινα**
   * ενώ η ίδια μετάλλαξη στο `ellipse` τα κοκκίνισε — δηλαδή ο κλάδος `arc` του καταγραφέα
   * είναι σήμερα **ανενεργός** για αυτό το fixture. Μένει (άλλοι ζωγράφοι τον καλούν), αλλά
   * καταγράφεται εδώ ότι **δεν έχει απόδειξη ζωής** από αυτή τη σουίτα — ένας φρουρός χωρίς
   * απόδειξη ζωής είναι σχόλιο, όχι φρουρός (ADR-749 §5).
   */
  it('Α3 — κύκλος και τόξο αφήνουν τόξα, το κείμενο αφήνει κείμενο', () => {
    const log = paint(scene(), FITTED);
    expect(log.arcs.length).toBeGreaterThanOrEqual(2);
    expect(log.texts.map((t) => t.text)).toContain('TEST');
  });

  /**
   * 🔴 Η **ΒΑΘΜΟΝΟΜΗΣΗ**: το ίχνος πρέπει να προσγειώνεται εκεί που προσγειώνονται τα
   * pixels. Μετρημένο στον ζωντανό ζωγράφο (2026-08-08) το μελάνι κάλυπτε
   * `x 129..1210 · y 9..730` για το ίδιο fixture και τον ίδιο μετασχηματισμό.
   *
   * ⚠️ Χωρίς αυτή τη δοκιμή, το ίχνος θα μπορούσε να είναι πλούσιο και **εντελώς εκτός
   * κάδρου** — δηλαδή «ζωγράφισα» με μαύρη οθόνη, που είναι **ακριβώς** η βλάβη που
   * ερευνούμε, μεταμφιεσμένη σε πράσινο.
   */
  it('Α4 — το ίχνος πέφτει ΜΕΣΑ στο κάδρο, εκεί που μετρήθηκαν τα pixels', () => {
    const log = paint(scene(), FITTED);
    const points = [
      ...log.strokes.flatMap((s) => s.points),
      ...log.arcs.map((a) => a.at),
      ...log.texts.map((t) => t.at),
    ];
    expect(points.length).toBeGreaterThan(0);
    const inFrame = points.filter(
      (p) => p.x >= 0 && p.x <= VIEWPORT.width && p.y >= 0 && p.y <= VIEWPORT.height,
    );
    expect(inFrame.length).toBe(points.length);
  });
});
