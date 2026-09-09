/**
 * @fileoverview **ΑΓΚΥΡΑ — Η ΚΑΜΕΡΑ ΜΙΛΑΕΙ ΜΙΑ ΓΛΩΣΣΑ, ΚΑΙ ΤΟ ΑΠΟΔΕΙΚΝΥΕΙ.**
 * @related lib/geo/camera-motion.ts · components/geo/use-camera-frame.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΚΑΙ ΓΙΑΤΙ ΤΟ ΔΕΥΤΕΡΟ ΜΕΡΟΣ ΕΙΝΑΙ ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **ΜΕΡΟΣ Α** δοκιμάζει τη μηχανή. Θα περνούσε **και αν κανείς δεν τη χρησιμοποιούσε** —
 * ακριβώς το σχήμα που πλήρωσε η Φ4β *(το `COVERAGE_MAP_HEIGHT_CLASS` εξήχθη, κανείς δεν
 * το κάλεσε, και το ADR περιέγραφε τον μηχανισμό ως υπάρχοντα)*. **Ένα `export` χωρίς
 * καταναλωτή δεν είναι SSoT· είναι πρόταση.**
 *
 * **ΜΕΡΟΣ Β** ρωτά το ίδιο το δέντρο: *«υπάρχει κίνηση κάμερας που ΔΕΝ λογοδοτεί;»*.
 * Αυτό είναι που κάνει την ενοποίηση **μόνιμη** αντί για στιγμιαία.
 *
 * ⚠️ **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ `forbiddenPattern` ΣΤΟ `.ssot-registry.json`**: μετρήθηκε ότι
 * ένας φρουρός στα `flyTo`/`fitBounds` **πριν** την ενοποίηση θα μπλόκαρε **9 νόμιμα**
 * σημεία — πολύ πάνω από τον πήχη <10% ψευδώς θετικών για **μπλοκάρουσα** πύλη, δηλαδή
 * θα γεννιόταν ο επόμενος **αδρανής φρουρός** *(ADR-749 §5: 606 από 671)*. Μετά την
 * ενοποίηση τα ψευδώς θετικά είναι **0/9**, αλλά το όργανο που το μετρά πρέπει να
 * **εκτελεί**, όχι να ταιριάζει κείμενο — γι' αυτό ζει σε άγκυρα.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  cameraFlight,
  cameraFraming,
  type CameraIntent,
  type FrameEdge,
  type PrecisionCeiling,
} from '../camera-motion';

// ════════════════════════════════════════════════════════════════════════════
// ΜΕΡΟΣ Α — Η ΜΗΧΑΝΗ
// ════════════════════════════════════════════════════════════════════════════

describe('Α. cameraFlight — η πρόθεση γίνεται κίνηση', () => {
  it('🔴 «travel» ΔΕΝ φέρνει κλειδί `duration` — η ΠΑΡΟΥΣΙΑ του σκοτώνει τον van Wijk', () => {
    const options = cameraFlight('travel');

    /*
      ⚠️ **Η ΨΥΧΗ ΟΛΟΚΛΗΡΗΣ ΤΗΣ ΑΛΛΑΓΗΣ, ΣΕ ΜΙΑ ΓΡΑΜΜΗ.** Το MapLibre γράφει
      `e.duration = "duration" in e ? +e.duration : 1e3*S/speed` — ελέγχει την
      **ύπαρξη του κλειδιού**, όχι την τιμή. Ένα `{ duration: undefined }` περνά τον
      έλεγχο και υπολογίζει `+undefined` ⇒ **NaN** ⇒ πτήση που δεν τελειώνει ποτέ.
      🔑 Κανένα `toMatchObject` δεν πιάνει αυτό — μόνο ο τελεστής `in`.
    */
    expect('duration' in options).toBe(false);
    expect(options).toEqual({ speed: expect.any(Number) });
  });

  it('⛔ «travel» ΔΕΝ φέρνει `maxDuration` — ΔΕΝ είναι φραγμός, είναι ΕΓΚΑΤΑΛΕΙΨΗ', () => {
    /*
      🔴 **ΑΥΤΟ ΤΟ TEST ΕΠΙΚΥΡΩΝΕ ΤΟ ΛΑΘΟΣ, ΜΕΧΡΙ ΠΟΥ ΤΟ ΜΑΤΙ ΚΟΙΤΑΞΕ** (2026-09-09).
      Η πρώτη γραφή απαιτούσε `maxDuration: expect.any(Number)` — δηλαδή **απαιτούσε τη
      βλάβη**. Η τεκμηρίωση τύπων του MapLibre λέει *«If duration exceeds maximum duration,
      it resets to 0»*, και ο κώδικας το κάνει: κάθε πτήση πάνω από το όριο γίνεται
      **ακαριαίο πήδημα**. Μετρημένο ζωντανά: 300 χλμ ⇒ **2 ms**, 700 χλμ ⇒ **1 ms**,
      ζουμ 12→17 ⇒ **1 ms**.

      🔑 Το μάθημα δεν είναι «πρόσεχε το maxDuration». Είναι ότι **μια άγκυρα γραμμένη από
      τον ίδιο που έκανε την παραδοχή, κληρονομεί την παραδοχή** — και μένει πράσινη.
    */
    expect('maxDuration' in cameraFlight('travel')).toBe(false);
    expect('maxDuration' in cameraFraming('travel', 'pin', 'area')).toBe(false);
  });

  it('«arrive» είναι ακαριαίο, και το λέει ρητά', () => {
    expect(cameraFlight('arrive')).toEqual({ duration: 0 });
  });

  it('🔴 οι δύο προθέσεις ΔΙΑΦΕΡΟΥΝ — αλλιώς η δήλωση δεν κάνει τίποτα', () => {
    /*
      Άγκυρα μετάλλαξης: αν κάποιος «απλοποιήσει» τη `cameraFlight` ώστε να επιστρέφει
      το ίδιο και για τις δύο προθέσεις, ΟΛΑ τα υπόλοιπα tests θα έμεναν πράσινα.
    */
    expect(cameraFlight('arrive')).not.toEqual(cameraFlight('travel'));
  });

  it('η ταχύτητα μένει στο εύρος που ΜΕΤΡΗΘΗΚΕ ότι διαβάζεται ως κίνηση', () => {
    const travel = cameraFlight('travel');
    if ('duration' in travel) throw new Error('αδύνατο — δες την ένωση τύπων');
    /*
      Η ταχύτητα είναι η **μόνη** βαλβίδα, και το εύρος της είναι δεμένο σε **μέτρηση**:
      με `1.2` οθόνες/δευτ. η κοντινή μετακίνηση βγήκε **884 ms** και η χειρότερη
      πανελλαδική **3,8 s**. Κάτω από `0.5` η μακρινή ξεπερνά τα 9 s· πάνω από `3`
      η κοντινή πέφτει κάτω από 350 ms και διαβάζεται ως τίναγμα.
    */
    expect(travel.speed).toBeGreaterThanOrEqual(0.5);
    expect(travel.speed).toBeLessThanOrEqual(3);
  });
});

describe('Β. cameraFraming — η πρόθεση γίνεται κάδρο', () => {
  const EDGES: readonly FrameEdge[] = ['pin', 'label'];
  const CEILINGS: readonly PrecisionCeiling[] = ['suggested', 'area', 'confirmed'];
  const INTENTS: readonly CameraIntent[] = ['arrive', 'travel'];

  it('🔑 ΕΞΑΝΤΛΗΣΗ: κάθε συνδυασμός δίνει περιθώριο ΚΑΙ ταβάνι — καμία σιωπηλή τρύπα', () => {
    for (const intent of INTENTS) {
      for (const edge of EDGES) {
        for (const ceiling of CEILINGS) {
          const framing = cameraFraming(intent, edge, ceiling);
          expect(framing.padding).toBeGreaterThan(0);
          expect(framing.maxZoom).toBeGreaterThan(0);
        }
      }
    }
  });

  it('η κίνηση του καδραρίσματος είναι ΤΑΥΤΟΣΗΜΗ με την κίνηση της πτήσης', () => {
    for (const intent of INTENTS) {
      const { padding: _p, maxZoom: _z, ...motion } = cameraFraming(intent, 'pin', 'area');
      expect(motion).toEqual(cameraFlight(intent));
    }
  });

  it('🔴 η ετικέτα θέλει ΠΕΡΙΣΣΟΤΕΡΟ αέρα από την πινέζα — αλλιώς διαβάζεται κομμένη', () => {
    expect(cameraFraming('arrive', 'label', 'area').padding)
      .toBeGreaterThan(cameraFraming('arrive', 'pin', 'area').padding);
  });

  it('🔴 τα τρία ταβάνια είναι ΑΥΞΟΥΣΑ ακρίβεια: πρόταση < περιοχή < επιβεβαιωμένο', () => {
    /*
      ⚠️ Δεν είναι αισθητική διάταξη. Το ταβάνι δηλώνει **τι ισχυρίζεται το κάδρο**: μια
      γεωκωδικοποιημένη πρόταση δεν επιτρέπεται να δείχνει «δύο κτίρια», μια
      επιβεβαιωμένη διεύθυνση επιτρέπεται. Ανεστραμμένη σειρά = **ψέμα στην οθόνη**.
    */
    const zoomOf = (c: PrecisionCeiling) => cameraFraming('travel', 'pin', c).maxZoom;
    expect(zoomOf('suggested')).toBeLessThan(zoomOf('area'));
    expect(zoomOf('area')).toBeLessThan(zoomOf('confirmed'));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ΜΕΡΟΣ Β — ΤΟ ΔΕΝΤΡΟ. «ΥΠΑΡΧΕΙ ΚΙΝΗΣΗ ΠΟΥ ΔΕΝ ΛΟΓΟΔΟΤΕΙ;»
// ════════════════════════════════════════════════════════════════════════════

const SRC = join(__dirname, '..', '..', '..');
const AUTHORITY = '@/lib/geo/camera-motion';

/** Οι μέθοδοι που **κάδρουν**. Το `panBy` λείπει επίτηδες — δες παρακάτω. */
const FRAMING_CALL = /\.(flyTo|fitBounds|easeTo|jumpTo)\s*\(/g;

/** Παράμετροι που, γραμμένες **κυριολεκτικά** μέσα σε κλήση κάμερας, είναι το ελάττωμα. */
const SILENT_PARAM = /\b(duration|padding|maxZoom|essential)\s*:/;

/**
 * Ο κώδικας **χωρίς τα σχόλια**.
 *
 * 🔴 **ΤΟ ΒΡΗΚΕ Η ΙΔΙΑ Η ΑΓΚΥΡΑ, ΣΤΟ ΠΡΩΤΟ ΤΗΣ ΤΡΕΞΙΜΟ**: κατήγγειλε το
 * `useBoundaryLayers.ts` για `essential: true` — και είχε δίκιο ως προς το κείμενο, γιατί
 * εκεί στέκεται πλέον το **σχόλιο που εξηγεί ότι η σημαία αφαιρέθηκε**. Ένα όργανο που
 * δεν ξεχωρίζει τον κώδικα από την περιγραφή του τιμωρεί ακριβώς αυτόν που τεκμηρίωσε.
 *
 * ⚠️ Είναι σκόπιμα **απλός** αφαιρέτης, όχι λεκτικός αναλυτής: μια συμβολοσειρά που
 * περιέχει `//` θα κοπεί λάθος. Για την ερώτηση που κάνουμε *(«υπάρχει αυτή η
 * παράμετρος σε κλήση κάμερας;»)* το ρίσκο είναι **ψευδώς αρνητικό σε κώδικα που κανείς
 * δεν γράφει** — και η εναλλακτική *(πλήρης αναλυτής σε άγκυρα)* κοστίζει περισσότερο
 * από όσο προστατεύει.
 */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec|d)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Το κείμενο των ορισμάτων μιας κλήσης, με **ισοσταθμισμένες** παρενθέσεις. */
function argumentsOf(text: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(openIndex + 1, i);
  }
  return text.slice(openIndex + 1);
}

interface CameraCall {
  readonly file: string;
  readonly args: string;
}

/**
 * ⚠️ **ΤΟ ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ ΤΗΣ ΑΡΧΗΣ ΕΞΑΙΡΕΙΤΑΙ**, αλλιώς η τεκμηρίωσή του — που
 * *παραθέτει* τα ελαττώματα για να τα εξηγήσει — θα καταγγελλόταν ως ελάττωμα.
 */
const AUTHORITY_FILE = join(SRC, 'lib', 'geo', 'camera-motion.ts');

function cameraCalls(): CameraCall[] {
  const found: CameraCall[] = [];
  for (const file of sourceFiles(SRC)) {
    if (file === AUTHORITY_FILE) continue;
    const text = withoutComments(readFileSync(file, 'utf8'));
    FRAMING_CALL.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FRAMING_CALL.exec(text)) !== null) {
      const open = match.index + match[0].length - 1;
      found.push({ file: file.slice(SRC.length + 1).replace(/\\/g, '/'), args: argumentsOf(text, open) });
    }
  }
  return found;
}

describe('Γ. ΤΟ ΔΕΝΤΡΟ — καμία κίνηση κάμερας χωρίς λογοδοσία', () => {
  const calls = cameraCalls();

  it('υπάρχει πληθυσμός να φυλαχτεί — αλλιώς αυτό το αρχείο είναι πράσινο ΕΠΕΙΔΗ δεν κοίταξε', () => {
    /*
      🔴 Το σχήμα «`0` σημαίνει *κανείς δεν κοίταξε*, όχι *καθαρό*» έχει πληρωθεί
      **τέσσερις** φορές σε αυτό το έργο (i18n · ssot-discover · jscpd formats · 3.18).
      Αν ένα refactoring μετακινήσει τις κλήσεις, αυτή η γραμμή κοκκινίζει **πρώτη**.
    */
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });

  it('🔴 ΚΑΜΙΑ κλήση κάμερας δεν γράφει κυριολεκτικά duration / padding / maxZoom / essential', () => {
    const guilty = calls
      .filter(call => SILENT_PARAM.test(call.args))
      .map(call => `${call.file} → ${call.args.replace(/\s+/g, ' ').slice(0, 90)}`);

    expect(guilty).toEqual([]);
  });

  it('🔴 ΚΑΘΕ αρχείο που κινεί κάμερα ζητά την ΑΡΧΗ — όχι δικές του σταθερές', () => {
    const files = [...new Set(calls.map(call => call.file))];
    const orphans = files.filter(
      file => !withoutComments(readFileSync(join(SRC, file), 'utf8')).includes(AUTHORITY),
    );

    expect(orphans).toEqual([]);
  });

  it('♿ ΚΑΝΕΝΑ `essential: true` σε ΟΛΟ το δέντρο — ακυρώνει το prefers-reduced-motion', () => {
    /*
      🔴 Μετρημένο 2026-09-08: **δύο** πτήσεις του `geo-canvas` το περνούσαν, και ήταν
      **οι δύο μακρύτερες κινήσεις της εφαρμογής (2000 ms)** — δηλαδή οι μόνες που
      άνθρωπος με αιθουσαία διαταραχή **δεν μπορούσε** να απενεργοποιήσει. Το MapLibre
      σέβεται το `prefers-reduced-motion` από μόνο του· η σημαία το ακυρώνει ρητά.
      ⚠️ Σαρώνεται **όλο** το δέντρο, όχι μόνο οι κλήσεις: η σημαία μπορεί να ταξιδέψει
      μέσα σε αντικείμενο επιλογών που χτίζεται αλλού.
    */
    const guilty = sourceFiles(SRC)
      .filter(file => file !== AUTHORITY_FILE)
      .filter(file => /essential\s*:\s*true/.test(withoutComments(readFileSync(file, 'utf8'))))
      .map(file => file.slice(SRC.length + 1).replace(/\\/g, '/'));

    expect(guilty).toEqual([]);
  });
});

/**
 * ⚠️ **ΓΙΑΤΙ ΤΟ `panBy` ΔΕΝ ΦΥΛΑΓΕΤΑΙ ΕΔΩ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΕΙΨΗ.**
 *
 * Το `useAddressMapGeocoding` καλεί `map.panBy([dx, dy], { duration: 0 })` **μέσα σε
 * `requestAnimationFrame`**, όσο ο άνθρωπος σέρνει πινέζα προς την άκρη. Δεν είναι
 * καδράρισμα: είναι **σπρώξιμο ανά καρέ**, και το `duration: 0` εκεί δεν είναι διάλεκτος
 * — είναι **η μόνη σωστή τιμή** *(οτιδήποτε άλλο βάζει δεύτερη κίνηση πάνω στην κίνηση
 * του δαχτύλου)*.
 *
 * 🔑 Η αρχική μέτρηση το είχε καταγράψει ως «12η κλήση με τέταρτη διάρκεια». Ήταν
 * **λάθος ταξινόμηση, όχι λάθος τιμή** — και το να «ενοποιηθεί» θα ήταν ισοπέδωση.
 */
