/**
 * 🔴 ADR-739 §31 / **ADR-754 §14** — οι **ζωγραφισμένοι** δείκτες του πίνακα.
 *
 * Τρεις παγίδες κλειδώνουν εδώ, και **καμία τους δεν δίνει σφάλμα όταν σπάσει** — απλώς ο
 * δείκτης δεν αλλάζει ποτέ, που είναι ακριβώς το παράπονο που γέννησε τη φάση:
 *
 *  1. **Φράγμα συσκευής**: Windows/Chrome απορρίπτουν **σιωπηλά** δείκτη πάνω από ~32 device-px.
 *  2. **Σημείο ενέργειας**: δηλώνεται σε **εμφανιζόμενα** CSS px, που διαφέρουν ανά διαδρομή
 *     εκπομπής (`image-set(... Nx)` vs σκέτο `url()`) — σε `dpr < 1` το κέντρο ξεφεύγει.
 *  3. **PNG, όχι SVG**: ο Chrome απορρίπτει SVG data-URL δείκτες.
 *
 * ⚠️ Το `getContext('2d')` της jsdom είναι κενό, οπότε —όπως και το test του σταυρονήματος—
 * μετριέται το **συμβόλαιο ζωγραφικής** (ποιες κλήσεις, με ποια σειρά, σε ποιες συντεταγμένες)
 * και το **σχήμα της τιμής** που επιστρέφεται. Το «φαίνεται;» δεν απαντιέται από κανένα test:
 * τον δείκτη τον ζωγραφίζει ο ΟΣ, **έξω** από τον καμβά (ADR-754 §14.4).
 */

import {
  buildTableArrowCursorValue,
  buildTableFillCursorValue,
  buildTableMoveCursorValue,
} from '../table-indicator-cursor-image';

interface FillRectCall {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly style: string;
}

interface MockCtx {
  beginPath: jest.Mock; moveTo: jest.Mock; lineTo: jest.Mock; closePath: jest.Mock;
  stroke: jest.Mock; fill: jest.Mock; fillRect: jest.Mock; scale: jest.Mock;
  save: jest.Mock; restore: jest.Mock; clip: jest.Mock;
  strokeStyle: string; fillStyle: string; lineWidth: number; lineJoin: string; lineCap: string;
}

let ctx: MockCtx;
let fillRects: FillRectCall[];
let canvas: { width: number; height: number; getContext: jest.Mock; toDataURL: jest.Mock };
const origCreate = document.createElement.bind(document);
const origDpr = window.devicePixelRatio;

const setDpr = (v: number) =>
  Object.defineProperty(window, 'devicePixelRatio', { value: v, configurable: true, writable: true });

beforeEach(() => {
  fillRects = [];
  ctx = {
    beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), closePath: jest.fn(),
    stroke: jest.fn(), fill: jest.fn(), scale: jest.fn(),
    save: jest.fn(), restore: jest.fn(), clip: jest.fn(),
    // Το χρώμα καταγράφεται **τη στιγμή** της κλήσης: η σειρά «φωτοστέφανο πρώτο» είναι η
    // προδιαγραφή, και ένα σκέτο `toHaveBeenCalledWith` δεν τη βλέπει.
    fillRect: jest.fn((x: number, y: number, w: number, h: number) =>
      fillRects.push({ x, y, w, h, style: ctx.fillStyle })),
    strokeStyle: '', fillStyle: '', lineWidth: 1, lineJoin: '', lineCap: '',
  };
  canvas = {
    width: 0, height: 0,
    getContext: jest.fn(() => ctx),
    toDataURL: jest.fn(() => 'data:image/png;base64,ABC'),
  };
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : origCreate(tag),
  );
  setDpr(1);
});

afterEach(() => {
  jest.restoreAllMocks();
  setDpr(origDpr);
});

// ──────────────────────────────────────────────────────────────────────────────
// Τα δύο βέλη — καρφί ότι η εξαγωγή του ρασταροποιητή δεν άλλαξε τίποτα
// ──────────────────────────────────────────────────────────────────────────────

describe('buildTableArrowCursorValue — αμετάβλητο μετά την εξαγωγή του κοινού ρασταροποιητή', () => {
  it('dpr 1 ⇒ σκέτο url με κέντρο 10 και εφεδρεία `pointer`', () => {
    expect(buildTableArrowCursorValue('down')).toBe('url("data:image/png;base64,ABC") 10 10, pointer');
    expect(canvas.width).toBe(20);
  });

  it('dpr 2 ⇒ `image-set` στο φυσικό μέγεθος, σημείο ενέργειας σε CSS px', () => {
    setDpr(2);
    // cssSize 16 (16×2 = 32 device px = το φράγμα), σημείο ενέργειας 8.
    expect(buildTableArrowCursorValue('right'))
      .toBe('image-set(url("data:image/png;base64,ABC") 2x) 8 8, pointer');
    expect(canvas.width).toBe(32);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  });

  it('χαράζει το περίγραμμα και το βάφει: φωτοστέφανο πρώτο, γέμισμα μετά', () => {
    buildTableArrowCursorValue('down');
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(6);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('«δεξιά» = το ΙΔΙΟ σχήμα με εναλλαγμένους άξονες, όχι δεύτερος πίνακας σημείων', () => {
    buildTableArrowCursorValue('down');
    const down = ctx.lineTo.mock.calls.map(([x, y]) => [x, y]);
    ctx.lineTo.mockClear();
    buildTableArrowCursorValue('right');
    const right = ctx.lineTo.mock.calls.map(([x, y]) => [y, x]);
    expect(right).toEqual(down);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-754 §14 — ο λεπτός μαύρος σταυρός της λαβής συμπλήρωσης
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §14 buildTableFillCursorValue — ο λεπτός μαύρος σταυρός (Excel parity)', () => {
  it('dpr 1 ⇒ κουτί 22 px, σημείο ενέργειας στο κέντρο, εφεδρεία `crosshair`', () => {
    expect(buildTableFillCursorValue()).toBe('url("data:image/png;base64,ABC") 11 11, crosshair');
    expect(canvas.width).toBe(22);
    expect(canvas.height).toBe(22);
  });

  /**
   * 🔑 **ΚΑΜΙΑ ΚΛΙΜΑΚΩΣΗ, ΚΑΜΙΑ ΓΡΑΜΜΗ.** Ο σταυρός είναι μία ράβδος πάχους ενός pixel: ένα
   * `scale()` + `stroke()` σε CSS px θα την άπλωνε σε δύο pixel μισής έντασης — γκρίζος, θολός
   * σταυρός, δηλαδή το αντίθετο του «λεπτός και μαύρος». Το test καρφώνει την **απόφαση**, όχι
   * το αποτέλεσμα: το αποτέλεσμα δεν φαίνεται σε jsdom.
   */
  it('🔑 ζωγραφίζει με γεμισμένα ορθογώνια σε pixel συσκευής — ΟΧΙ scale/stroke', () => {
    buildTableFillCursorValue();
    expect(ctx.scale).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(fillRects).toHaveLength(4);
  });

  it('φωτοστέφανο πρώτο (λευκό), μαύρες ράβδοι μετά — αλλιώς χάνεται πάνω στη μπλε λαβή', () => {
    buildTableFillCursorValue();
    expect(fillRects.map((r) => r.style)).toEqual(['#ffffff', '#ffffff', '#000000', '#000000']);
  });

  it('ο σταυρός είναι ΚΕΝΤΡΑΡΙΣΜΕΝΟΣ — το ίδιο σημείο με το σημείο ενέργειας', () => {
    buildTableFillCursorValue();
    const [, , horizontal, vertical] = fillRects;
    // dpr 1: κουτί 22, ράβδος 1 ⇒ αρχή στο round((22−1)/2) = 11, κέντρο 11,5 ≈ hotspot 11.
    expect(horizontal).toEqual({ x: 1, y: 11, w: 20, h: 1, style: '#000000' });
    expect(vertical).toEqual({ x: 11, y: 1, w: 1, h: 20, style: '#000000' });
  });

  it('το φωτοστέφανο φτάνει από άκρη σε άκρη — κλείνει και τις τέσσερις αιχμές', () => {
    buildTableFillCursorValue();
    const [haloH, haloV] = fillRects;
    expect(haloH).toEqual({ x: 0, y: 10, w: 22, h: 3, style: '#ffffff' });
    expect(haloV).toEqual({ x: 10, y: 0, w: 3, h: 22, style: '#ffffff' });
  });

  /**
   * 🔑 **ΕΝΑ ΟΛΟΚΛΗΡΟ PIXEL ΑΝΑ ΒΗΜΑ dpr** — ο κανόνας που ακολουθούν και οι δείκτες του ΟΣ.
   * Κλάσμα εδώ σημαίνει εξομάλυνση, και εξομάλυνση σε ράβδο ενός pixel σημαίνει γκρι.
   */
  it.each([
    [1, 22, 1],
    [2, 32, 2],
    [3, 32, 3],
  ])('🔑 dpr %s ⇒ κουτί %s device-px, ράβδος %s device-px (ακέραια, πάντα)', (dpr, box, bar) => {
    setDpr(dpr);
    buildTableFillCursorValue();
    expect(canvas.width).toBe(box);
    expect(fillRects[2].h).toBe(bar);
    expect(fillRects[3].w).toBe(bar);
  });

  it('🔴 το φυσικό μέγεθος μένει ≤ 32 device-px σε ΚΑΘΕ dpr — αλλιώς σιωπηλή απόρριψη', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.5, 3, 4]) {
      setDpr(dpr);
      buildTableFillCursorValue();
      expect(canvas.width).toBeLessThanOrEqual(32);
    }
  });

  it('dpr 2 ⇒ `image-set` με το σημείο ενέργειας σε ΕΜΦΑΝΙΖΟΜΕΝΑ CSS px', () => {
    setDpr(2);
    // cssSize 16 (το 22 φράσσεται από το 32/2), εμφανίζεται στα 16 CSS px ⇒ κέντρο 8.
    expect(buildTableFillCursorValue())
      .toBe('image-set(url("data:image/png;base64,ABC") 2x) 8 8, crosshair');
  });

  /**
   * 🔴 Η διόρθωση του 2026-07-04, εφαρμοσμένη και εδώ από τον κοινό ρασταροποιητή: σε `dpr < 1`
   * (σελίδα στο 80%) το PNG εκπέμπεται ως σκέτο `url()` και δείχνεται **1:1 στο φυσικό** του
   * μέγεθος — άρα το σημείο ενέργειας είναι το μισό **εκείνου**, όχι του CSS.
   */
  it('🔴 dpr < 1 ⇒ σημείο ενέργειας στο κέντρο της ΕΜΦΑΝΙΖΟΜΕΝΗΣ εικόνας', () => {
    setDpr(0.8);
    // cssSize 22 → φυσικό round(22×0,8) = 18 ⇒ κέντρο 9 (όχι 11).
    expect(buildTableFillCursorValue()).toBe('url("data:image/png;base64,ABC") 9 9, crosshair');
    expect(canvas.width).toBe(18);
  });

  it('χωρίς context 2D ⇒ η λέξη-κλειδί εφεδρείας, ποτέ εξαίρεση', () => {
    canvas.getContext = jest.fn(() => null);
    expect(buildTableFillCursorValue()).toBe('crosshair');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-739 §36.10 — ο σταυρός με τα βέλη της μετακίνησης
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §36.10 buildTableMoveCursorValue — ο σταυρός με τα βέλη', () => {
  /**
   * 🔑 **Η ΕΦΕΔΡΕΙΑ ΕΙΝΑΙ Η ΣΗΜΕΡΙΝΗ ΣΥΜΠΕΡΙΦΟΡΑ, ΚΑΙ ΕΙΝΑΙ ΟΛΟ ΤΟ ΕΠΙΧΕΙΡΗΜΑ.** Το ράστερ
   * αντικαθιστά τη λέξη-κλειδί `move`· αν ο ΟΣ το απορρίψει, εμφανίζεται **ακριβώς** ό,τι
   * εμφανιζόταν πριν. Χειρότερη περίπτωση = status quo — μοναδικό στην οικογένεια.
   */
  it('🔑 εφεδρεία `move` — η χειρότερη περίπτωση είναι η ΠΡΟΗΓΟΥΜΕΝΗ συμπεριφορά', () => {
    expect(buildTableMoveCursorValue()).toBe('url("data:image/png;base64,ABC") 11 11, move');
    canvas.getContext = jest.fn(() => null);
    expect(buildTableMoveCursorValue()).toBe('move');
  });

  /**
   * 🔴🔴 **Η ΕΝΤΟΛΗ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, ΚΛΕΙΔΩΜΕΝΗ**: «*κάν' τα ισάξια σε μέγεθος*» (2026-08-06).
   *
   * Η ισότητα ελέγχεται στο **κουτί που παράγεται**, όχι σε δύο σταθερές: έτσι πιάνεται και η
   * περίπτωση που κάποιος περάσει διαφορετικό μέγεθος στον έναν ρασταροποιητή. Και ελέγχεται σε
   * **κάθε** dpr, γιατί εκεί ζει το φράγμα των 32 device-px που θα μπορούσε να συρρικνώσει τον
   * έναν και όχι τον άλλον.
   */
  it.each([1, 1.25, 1.5, 2, 2.5, 3, 0.8])('🔴 dpr %s ⇒ ΙΣΟ κουτί με τον σταυρό συμπλήρωσης', (dpr) => {
    setDpr(dpr);
    buildTableMoveCursorValue();
    const moveBox = canvas.width;
    buildTableFillCursorValue();
    expect(moveBox).toBe(canvas.width);
  });

  it('🔑 τέσσερις βραχίονες από ΕΝΑ προφίλ — 4×6 σημεία, κανένα γραμμένο δεύτερη φορά', () => {
    buildTableMoveCursorValue();
    // 7 σημεία ο πρώτος βραχίονας (1 `moveTo` + 6 `lineTo`) + 6 ανά επόμενο = 24 συνολικά.
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(6 + 3 * 6);
  });

  /**
   * 🔑 **ΤΕΤΡΑΜΕΡΗΣ ΣΥΜΜΕΤΡΙΑ — ΚΑΙ ΜΕ ΤΗ ΣΕΙΡΑ, ΟΧΙ ΜΟΝΟ ΩΣ ΣΥΝΟΛΟ.**
   *
   * ⚠️ **Η πρώτη γραφή αυτού του test ήταν άχρηστη, και το έδειξε η μετάλλαξη**: σύγκρινε το
   * **σύνολο** των κορυφών με το στραμμένο σύνολο. Με αντίθετο πρόσημο στροφής (`[-y, x]`) το
   * σύνολο μένει **ταυτόσημο** — αλλάζει μόνο η **σειρά διαδρομής** — άρα το test έμενε πράσινο
   * ενώ το πολύγωνο **διασταυρώνεται με τον εαυτό του** (ο δεύτερος βραχίονας ξεκινά από την
   * απέναντι μεριά). Το `fill()` ζωγραφίζει τέτοιο πολύγωνο **χωρίς να παραπονεθεί**.
   *
   * Ο σωστός αναλλοίωτος είναι **κυκλικός**: η κορυφή `i + 6` οφείλει να είναι η στραμμένη
   * κορυφή `i`, για κάθε `i`. Αυτό κωδικοποιεί ταυτόχρονα τη συμμετρία **και** τη συνέχεια της
   * διαδρομής — δηλαδή ακριβώς ό,τι εγγυάται το `R(αρχή) = τέλος` της {@link rotateQuarter}.
   */
  it('🔑 κορυφή i+6 = στραμμένη κορυφή i — συμμετρία ΚΑΙ συνέχεια διαδρομής', () => {
    buildTableMoveCursorValue();
    const half = canvas.width / 2;
    const points = [
      ...ctx.moveTo.mock.calls.map(([x, y]) => [x, y] as const),
      ...ctx.lineTo.mock.calls.map(([x, y]) => [x, y] as const),
    ];
    const key = (p: readonly [number, number]) => `${p[0].toFixed(4)}|${p[1].toFixed(4)}`;
    // Στροφή 90° γύρω από το κέντρο, ο ίδιος τύπος με τη χάραξη.
    const turn = ([x, y]: readonly [number, number]) =>
      [half + (y - half), half - (x - half)] as const;
    expect(points).toHaveLength(25);
    for (let i = 0; i + 6 < points.length; i++) {
      expect(key(points[i + 6])).toBe(key(turn(points[i])));
    }
  });

  /**
   * 🔴🔴 **Η ΕΝΤΟΛΗ ΤΗΣ ΟΘΟΝΗΣ, ΚΛΕΙΔΩΜΕΝΗ**: «*τώρα έγινε μικρό και **μαύρο** και δεν μου
   * αρέσει· θέλω **άσπρο** και σωστά τελειώματα*» (Giorgio, 2026-08-06).
   *
   * Η πρώτη γραφή αντέγραψε το βέλος επιλογής άξονα (μαύρο γέμισμα, λευκό φωτοστέφανο). Λάθος
   * πρότυπο: ο δείκτης μετακίνησης **κάθε** λειτουργικού είναι λευκός με μαύρο περίγραμμα, και
   * αυτόν έβλεπε ο χρήστης σε αυτό ακριβώς το pixel πριν το §36.10.
   */
  it('🔴 ΑΣΠΡΟ σώμα, ΜΑΥΡΟ περίγραμμα — γέμισμα ΠΡΩΤΑ, περίγραμμα μετά', () => {
    buildTableMoveCursorValue();
    expect(ctx.scale).toHaveBeenCalled();
    expect(ctx.fill.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.stroke.mock.invocationCallOrder[0]);
    expect(ctx.strokeStyle).toBe('#000000');
  });

  /**
   * 🔑 **«ΚΑΘΑΡΕΣ ΓΡΑΜΜΕΣ» = ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΜΕΝΕΙ ΜΕΣΑ.** Χωρίς `clip()`, η μισή γραμμή πέφτει
   * **έξω** από το σχήμα, πάνω σε διαφανές φόντο: θολή αιχμή, και υποχρεωτικό περιθώριο που
   * κρατούσε τον σταυρό μικρότερο από τη λαβή. Το διπλό πάχος υπάρχει **γι' αυτό**: το μισό
   * κόβεται, άρα μένει ακριβώς το ζητούμενο πάχος, με κοφτή ακμή.
   */
  it('🔑 περίγραμμα ΠΡΟΣ ΤΑ ΜΕΣΑ: αποκοπή στο σχήμα + διπλό πάχος + γωνίες `miter`', () => {
    buildTableMoveCursorValue();
    expect(ctx.clip).toHaveBeenCalledTimes(1);
    expect(ctx.clip.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.stroke.mock.invocationCallOrder[0]);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.lineJoin).toBe('miter');
  });

  /**
   * 🔴 **ΙΣΟ ΜΕΛΑΝΙ, ΟΧΙ ΜΟΝΟ ΙΣΟ ΚΟΥΤΙ** — το εύρημα της οθόνης. Τα δύο κουτιά ήταν ήδη ίσα
   * και ο ιδιοκτήτης έβλεπε τον σταυρό μετακίνησης **μικρότερο**: οι ράβδοι της λαβής πάνε από
   * άκρη σε άκρη, οι βραχίονες σταματούσαν στο 92%. Το μάτι βλέπει το **σχήμα**.
   */
  /**
   * 🔴🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΕΙΔΕ Η ΟΘΟΝΗ: «είναι μαύρο το σημαδάκι, το θέλω λευκό» (06/08).**
   *
   * Ο κώδικας έγραφε `lineWidth = OUTLINE_CSS_PX * 2`, δηλαδή —με `clip()`— **2 px περίγραμμα
   * προς τα μέσα ανά πλευρά** πάνω σε στέλεχος πλάτους **2,7 px**. Τα δύο περιγράμματα
   * συναντιόντουσαν στο κέντρο: το «λευκό σώμα» δεν είχε πού να υπάρξει και ο δείκτης έβγαινε
   * **ολόκληρος μαύρος**. Και τα δύο τότε tests ήταν **πράσινα** — μετρούσαν *ποιο* χρώμα, ποτέ
   * *πόσο*.
   *
   * 🔑 Ο αναλλοίωτος: **τουλάχιστον το μισό στέλεχος μένει λευκό**.
   *
   * ⚠️ Η πρώτη γραφή απαιτούσε απλώς «λεπτότερο από το μισό στέλεχος» — και η **μετάλλαξη το
   * πέρασε**: με στέλεχος 4,8 px, ένα περίγραμμα 2 px ανά πλευρά αφήνει 0,8 px λευκό, δηλαδή
   * *τυπικά* λευκό και *οπτικά* μαύρο. Ένα κατώφλι που επιτρέπει το 17% δεν μετρά αυτό που
   * ονομάζει. Το μισό είναι το ελάχιστο που αντέχει και τη στρογγυλοποίηση σε ακέραια pixel.
   */
  it('🔴 το ΛΕΥΚΟ ΣΩΜΑ ΕΠΙΒΙΩΝΕΙ: τουλάχιστον το μισό στέλεχος μένει λευκό', () => {
    buildTableMoveCursorValue();
    // Η πρώτη κορυφή είναι η εσωτερική γωνία του στελέχους ⇒ η απόστασή της από το κέντρο
    // **είναι** το μισό πλάτος του στελέχους, σε CSS px (dpr 1 ⇒ CSS px == device px).
    const stemHalfPx = (ctx.moveTo.mock.calls[0][0] as number) - canvas.width / 2;
    expect(ctx.lineWidth / 2).toBeLessThanOrEqual(stemHalfPx / 2);
  });

  it('🔴 οι αιχμές ακουμπούν την ΑΚΜΗ του κουτιού — ίδιο μελάνι με τις ράβδοι της λαβής', () => {
    buildTableMoveCursorValue();
    const size = canvas.width;
    const xs = ctx.lineTo.mock.calls.map(([x]) => x as number);
    const ys = ctx.lineTo.mock.calls.map(([, y]) => y as number);
    expect(Math.min(...xs, ...ys)).toBeCloseTo(0);
    expect(Math.max(...xs, ...ys)).toBeCloseTo(size);
  });

  it('🔴 το φυσικό μέγεθος μένει ≤ 32 device-px σε ΚΑΘΕ dpr — αλλιώς σιωπηλή απόρριψη', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.5, 3, 4]) {
      setDpr(dpr);
      buildTableMoveCursorValue();
      expect(canvas.width).toBeLessThanOrEqual(32);
    }
  });
});
