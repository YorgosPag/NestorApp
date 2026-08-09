/**
 * ΑΓΚΥΡΕΣ — ADR-782 Φ2: **η απόδοση του παρόχου δεν είναι προαιρετική**.
 *
 * Το ερώτημα που κλειδώνουν: *«μπορεί να ζωγραφιστεί χάρτης χωρίς να φαίνεται η μνεία του
 * παρόχου;»*. Η απάντηση οφείλει να είναι **όχι**, και όχι επειδή κάποιος θυμήθηκε να προσαρτήσει
 * ένα component, αλλά επειδή η ζωγραφική **ρωτά**.
 *
 * ⚠️ Οι άγκυρες `Α6`/`Α7` διαβάζουν **πραγματικό κώδικα** από τον δίσκο και όχι fixture: το
 * ερώτημά τους είναι «ποιος καλεί τι», και ένα fixture θα απαντούσε για κώδικα που δεν τρέχει.
 */

import fs from 'fs';
import path from 'path';
import {
  resolveBasemapContent,
  resolveBasemapPaint,
} from '../basemap-paint-decision';
import {
  hasBasemapAttributionSurface,
  registerBasemapAttributionSurface,
  resetBasemapAttributionSurfaces,
} from '../basemap-attribution-surface';
import {
  resetBasemapStore,
  setBasemapEnabled,
  setBasemapOpacity,
} from '../basemap-store';
import { setApproximateAnchor } from '../basemap-availability';
import { BASEMAP_SOURCES } from '../basemap-source';

/** Φέρνει το έργο σε κατάσταση «ξέρω πού είσαι» χωρίς να αγγίξει τη γεωαναφορά του έργου. */
function locateApproximately(): void {
  setApproximateAnchor({ lat: 40.64, lon: 22.94, originKey: 'test' });
}

beforeEach(() => {
  resetBasemapStore();
  resetBasemapAttributionSurfaces();
  setApproximateAnchor(null);
});

afterAll(() => {
  resetBasemapStore();
  resetBasemapAttributionSurfaces();
  setApproximateAnchor(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Α1 — ο πίνακας παρόχων
// ─────────────────────────────────────────────────────────────────────────────
describe('Α1 — κάθε πάροχος ΟΦΕΙΛΕΙ απόδοση, και ο σύνδεσμος είναι μέρος της', () => {
  it('κανένας πάροχος δεν έχει κενή απόδοση', () => {
    const sources = Object.values(BASEMAP_SOURCES);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.attribution.length).toBeGreaterThan(0);
      // Κενά κομμάτια θα περνούσαν το πλήθος και δεν θα έγραφαν τίποτα στην οθόνη.
      expect(source.attribution.some((segment) => segment.text.trim().length > 0)).toBe(true);
    }
  });

  it('ο OSM αποδίδεται με τη μορφή που δέχεται η οδηγία, ΚΑΙ με σύνδεσμο στην άδεια', () => {
    const osm = BASEMAP_SOURCES['osm-standard'];
    const plain = osm.attribution.map((segment) => segment.text).join('');
    expect(plain).toBe('© OpenStreetMap contributors');

    // Η οδηγία ζητά ρητά η λέξη «OpenStreetMap» — όχι όλο το κείμενο — να είναι ο σύνδεσμος.
    const linked = osm.attribution.filter((segment) => segment.href);
    expect(linked).toHaveLength(1);
    expect(linked[0].text).toBe('OpenStreetMap');
    expect(linked[0].href).toBe('https://www.openstreetmap.org/copyright');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Α2-Α5 — η ΜΙΑ απόφαση
// ─────────────────────────────────────────────────────────────────────────────
describe('Α2 — οι λόγοι άρνησης είναι ΟΝΟΜΑΤΑ, όχι ένα false', () => {
  it('σβηστό υπόβαθρο ⇒ disabled (και ΟΧΙ unattributed, όσο κι αν λείπει η επιφάνεια)', () => {
    // Η σειρά είναι συμβόλαιο: ένα σβηστό υπόβαθρο ΔΕΝ αναφέρεται ποτέ ως πρόβλημα άδειας.
    const decision = resolveBasemapPaint();
    expect(decision).toEqual({ show: false, refusal: 'disabled' });
  });

  it('αναμμένο αλλά χωρίς θέση ⇒ unlocated', () => {
    setBasemapEnabled(true);
    expect(resolveBasemapPaint()).toEqual({ show: false, refusal: 'unlocated' });
  });

  it('αναμμένο με μηδενική αδιαφάνεια ⇒ transparent', () => {
    setBasemapEnabled(true);
    locateApproximately();
    setBasemapOpacity(0);
    expect(resolveBasemapPaint()).toEqual({ show: false, refusal: 'transparent' });
  });
});

describe('Α3 — 🔴 χάρτης ΧΩΡΙΣ επιφάνεια απόδοσης ΔΕΝ ζωγραφίζεται', () => {
  it('όλα έτοιμα, καμία επιφάνεια ⇒ unattributed', () => {
    setBasemapEnabled(true);
    locateApproximately();
    expect(hasBasemapAttributionSurface()).toBe(false);
    expect(resolveBasemapPaint()).toEqual({ show: false, refusal: 'unattributed' });
  });

  it('με εγγεγραμμένη επιφάνεια ⇒ ζωγραφίζει, με τον πάροχο που όντως θα αποδοθεί', () => {
    setBasemapEnabled(true);
    locateApproximately();
    registerBasemapAttributionSurface('test-surface');

    const decision = resolveBasemapPaint();
    expect(decision.show).toBe(true);
    if (!decision.show) throw new Error('unreachable');
    expect(decision.content.source).toBe(BASEMAP_SOURCES['osm-standard']);
    expect(decision.content.availability).toBe('approximate');
  });

  it('η απεγγραφή ΣΤΑΜΑΤΑ τη ζωγραφική — η μνεία έφυγε, ο χάρτης φεύγει μαζί', () => {
    setBasemapEnabled(true);
    locateApproximately();
    const unregister = registerBasemapAttributionSurface('test-surface');
    expect(resolveBasemapPaint().show).toBe(true);

    unregister();
    expect(resolveBasemapPaint()).toEqual({ show: false, refusal: 'unattributed' });
  });

  it('διπλή προσάρτηση του ΙΔΙΟΥ αναγνωριστικού δεν αφήνει το μητρώο «κατά ένα γεμάτο»', () => {
    // StrictMode/HMR προσαρτούν δύο φορές. Με μετρητή αντί για σύνολο, η μία απεγγραφή θα
    // άφηνε τον χάρτη ζωντανό αφού η μνεία είχε ήδη φύγει από την οθόνη.
    const first = registerBasemapAttributionSurface('dupe');
    const second = registerBasemapAttributionSurface('dupe');
    first();
    expect(hasBasemapAttributionSurface()).toBe(false);
    second();
    expect(hasBasemapAttributionSurface()).toBe(false);
  });
});

describe('Α4 — η ασυμμετρία των δύο ερωτημάτων είναι ΤΟ ΑΝΤΙΚΥΚΛΙΚΟ', () => {
  it('χωρίς επιφάνεια: η ΑΠΟΔΟΣΗ λέει «δείξε», ο ΖΩΓΡΑΦΟΣ λέει «όχι»', () => {
    setBasemapEnabled(true);
    locateApproximately();

    // Αν και τα δύο ρωτούσαν για την επιφάνεια, τίποτα δεν θα ξεκινούσε ποτέ.
    expect(resolveBasemapContent().show).toBe(true);
    expect(resolveBasemapPaint().show).toBe(false);
  });

  it('οι δύο συναρτήσεις συμφωνούν σε ΚΑΘΕ άρνηση που δεν αφορά την άδεια', () => {
    for (const setup of [
      () => undefined,
      () => setBasemapEnabled(true),
      () => {
        setBasemapEnabled(true);
        locateApproximately();
        setBasemapOpacity(0);
      },
    ]) {
      resetBasemapStore();
      setApproximateAnchor(null);
      setup();
      expect(resolveBasemapPaint()).toEqual(resolveBasemapContent());
    }
  });
});

describe('Α5 — η ακριβής γεωαναφορά δεν χρειάζεται άγκυρα κατά προσέγγιση', () => {
  it('η κατάσταση περνά αυτούσια στο περιεχόμενο (δεν «στρογγυλοποιείται» σε boolean)', () => {
    setBasemapEnabled(true);
    locateApproximately();
    registerBasemapAttributionSurface('test-surface');
    const decision = resolveBasemapContent();
    if (!decision.show) throw new Error('unreachable');
    // Ο καταναλωτής πρέπει να μπορεί να ξεχωρίσει «ακριβώς» από «κατά προσέγγιση» — η ένδειξη
    // «κατά προσέγγιση» της διεπαφής εξαρτάται από αυτό.
    expect(decision.content.availability).toBe('approximate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Α6-Α7 — ποιος ρωτά τι (πραγματικός κώδικας, όχι fixture)
// ─────────────────────────────────────────────────────────────────────────────
/** Η ρίζα του subapp — ίδιο ιδίωμα με το `canvas-layer-stack-transform-decoupling.test.tsx`. */
const SUBAPP_ROOT = path.resolve(__dirname, '..', '..', '..');

const PAINTERS = [
  'components/dxf-layout/useBasemapPainter.ts',
  'bim-3d/scene/basemap/BasemapGroundLayer.ts',
];

function readRepoFile(relative: string): string {
  const text = fs.readFileSync(path.resolve(SUBAPP_ROOT, relative), 'utf-8');
  // Ένα κενό/λανθασμένο μονοπάτι θα έκανε κάθε «δεν περιέχει» έλεγχο να περάσει ψεύτικα — το
  // σχήμα «0 = κανείς δεν κοίταξε», μέσα στο ίδιο το test που το κυνηγά.
  if (text.trim().length === 0) throw new Error(`κενό αρχείο: ${relative}`);
  return text;
}

describe('Α6 — 🔴 κανένας ζωγράφος δεν ρωτά το ερώτημα ΧΩΡΙΣ τον όρο της άδειας', () => {
  it.each(PAINTERS)('%s καλεί resolveBasemapPaint και ΟΧΙ resolveBasemapContent', (file) => {
    const source = readRepoFile(file);
    expect(source).toContain('resolveBasemapPaint');
    expect(source).not.toContain('resolveBasemapContent');
  });
});

describe('Α6β — 🔴 η επιφάνεια ΕΙΝΑΙ προσαρτημένη στον καμβά', () => {
  // Χωρίς αυτή την άγκυρα, η διαγραφή του mount **δεν κοκκινίζει τίποτα**: η ζωγραφική απλώς
  // σταματά. Νομικά ασφαλές, λειτουργικά «χάλασε ο χάρτης» — και το ίχνος οδηγεί στο δίκτυο, όχι
  // σε αυτή τη γραμμή. Η πιο ακριβή μορφή σιωπηλής βλάβης που επιτρέπει ο μηχανισμός.
  //
  // ⚠️ Η αλυσίδα ελέγχεται **ολόκληρη**, κρίκο-κρίκο. Έλεγχος μόνο του τελικού leaf θα έμενε
  // πράσινος αν κάποιος αφαιρούσε το ενδιάμεσο `CanvasStackHudLeaves` από τον Shell.
  it('ο CanvasLayerStack προσαρτά τα HUD και των δύο προβολών', () => {
    const shell = readRepoFile('components/dxf-layout/CanvasLayerStack.tsx');
    expect(shell).toMatch(/<CanvasStackHudLeaves\b/);
  });

  it('τα HUD και των δύο προβολών προσαρτούν την απόδοση', () => {
    const hud = readRepoFile('components/dxf-layout/canvas-layer-stack-hud-leaves.tsx');
    expect(hud).toMatch(/<BasemapAttributionLeaf\b/);
  });
});

describe('Α7 — κανένας ζωγράφος δεν ξαναγράφει το κατηγόρημα μόνος του', () => {
  it.each(PAINTERS)('%s δεν κρίνει μόνος του enabled/opacity/availability', (file) => {
    const source = readRepoFile(file);
    // Το ακριβές σχήμα που ζούσε αυτούσιο σε ΔΥΟ αρχεία πριν το ADR-782 Φ2. Αν ξαναεμφανιστεί,
    // έχει γεννηθεί δεύτερη αλήθεια — και θα φανεί ως «ο χάρτης δουλεύει στο 2Δ, όχι στο 3Δ».
    expect(source).not.toMatch(/\.enabled\s*(\|\||&&|\))/);
    expect(source).not.toMatch(/opacity\s*<=\s*0/);
    expect(source).not.toContain("=== 'unknown'");
  });
});
