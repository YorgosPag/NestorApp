/**
 * Άγκυρες **του ακροατηρίου του χάρτη** (ADR-777 §2.2).
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ.** Ο πίνακας προσδοκιών είναι **χειρόγραφος**, γραμμένος από την
 * απόφαση του Giorgio και από τη μέτρηση των τριών σημερινών καταναλωτών — **όχι**
 * διαβάζοντας το `MAP_CHROME`. Ένα test που έγραφε `expect(MAP_CHROME.x).toEqual(
 * MAP_CHROME.x)` θα ήταν ο κριτής που κρίνει τον εαυτό του.
 *
 * 🔴 **ΚΑΙ ΤΟ ΖΕΥΓΟΣ ΤΩΝ ΚΛΕΙΔΙΩΝ.** Οι ετικέτες των υποβάθρων είναι κλειδιά i18n που
 * καταλήγουν σε **δημόσια** οθόνη. Ένα κλειδί που δεν υπάρχει δεν σκάει — **βάφεται
 * ωμό**. Είναι η οικογένεια που αυτό το repo πλήρωσε τέσσερις φορές (CHECK 3.34 ·
 * 3.36 · 3.51), και η μισή απόδειξη («το κλειδί υπάρχει» ή «κάποιος το ζητά») είναι
 * ακριβώς αυτή που απέτυχε. Εδώ ελέγχονται **και τα δύο άκρα**.
 */

import fs from 'fs';
import path from 'path';

import {
  MAP_CHROME,
  MAP_CHROME_PRESETS,
  MAP_STYLE_CATALOG,
  showsBasemapPanel,
  type MapChromePreset,
} from '../map-chrome';
import { INITIAL_MAP_STYLE, MAP_STYLES, type MapStyleType } from '../../services/map/MapStyleManager';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ — τα πραγματικά locale αρχεία, όχι πλαστά
// =============================================================================

function loadLocale(language: 'el' | 'en'): Record<string, unknown> {
  const file = path.join(process.cwd(), 'src', 'i18n', 'locales', language, 'geo-canvas.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function resolveKey(tree: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>(
    (node, segment) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
    tree
  );
}

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ
// =============================================================================

describe('Μ0 — το λεξιλόγιο των υποβάθρων είναι ΕΝΑ', () => {
  it('τα MAP_STYLES είναι τα τέσσερα γνωστά, με σειρά (ADR-891 Φ1: έφυγαν τα μη εμπορικά)', () => {
    expect([...MAP_STYLES]).toEqual(['osm', 'voyager', 'dark', 'greece']);
  });

  it('ο κατάλογος καλύπτει ΚΑΘΕ υπόβαθρο — κλειστή λογιστική', () => {
    expect(Object.keys(MAP_STYLE_CATALOG).sort()).toEqual([...MAP_STYLES].sort());
    for (const style of MAP_STYLES) {
      expect(typeof MAP_STYLE_CATALOG[style].icon).toBeDefined();
      expect(MAP_STYLE_CATALOG[style].labelKey).toMatch(/^map\.controls\./);
    }
  });

  it('τα τρία ακροατήρια είναι ονομασμένα και κλειστά', () => {
    expect([...MAP_CHROME_PRESETS]).toEqual(['workspace', 'embedded', 'showcase']);
    expect(Object.keys(MAP_CHROME).sort()).toEqual([...MAP_CHROME_PRESETS].sort());
  });
});

// =============================================================================
// Κ1 — Ο ΠΛΗΡΗΣ ΠΙΝΑΚΑΣ ΙΚΑΝΟΤΗΤΩΝ, ΧΕΙΡΟΓΡΑΦΟΣ
// =============================================================================

describe('Κ1 — τι δίνει ο χάρτης σε κάθε ακροατήριο', () => {
  interface Expected {
    readonly basemapCount: number;
    readonly basemapSwitcher: 'icons' | 'labels' | 'none';
    readonly coordinateReadout: boolean;
    readonly pickerControls: boolean;
    readonly statusBar: boolean;
    readonly accuracyLegend: boolean;
  }

  const TABLE: ReadonlyArray<readonly [MapChromePreset, Expected]> = [
    ['workspace', { basemapCount: 4, basemapSwitcher: 'icons', coordinateReadout: true,  pickerControls: true,  statusBar: true,  accuracyLegend: true }],
    ['embedded',  { basemapCount: 4, basemapSwitcher: 'icons', coordinateReadout: true,  pickerControls: false, statusBar: false, accuracyLegend: false }],
    ['showcase',  { basemapCount: 1, basemapSwitcher: 'none',  coordinateReadout: false, pickerControls: false, statusBar: false, accuracyLegend: false }],
  ];

  it.each(TABLE)('%s', (preset, expected) => {
    const actual = MAP_CHROME[preset];
    expect(actual.basemaps).toHaveLength(expected.basemapCount);
    expect(actual.basemapSwitcher).toBe(expected.basemapSwitcher);
    expect(actual.coordinateReadout).toBe(expected.coordinateReadout);
    expect(actual.pickerControls).toBe(expected.pickerControls);
    expect(actual.statusBar).toBe(expected.statusBar);
    expect(actual.accuracyLegend).toBe(expected.accuracyLegend);
  });

  it('ο πίνακας κρίνει ΚΑΘΕ ακροατήριο — κανένα δεν ξεφεύγει', () => {
    expect(TABLE.map(([preset]) => preset).sort()).toEqual([...MAP_CHROME_PRESETS].sort());
  });
});

// =============================================================================
// Κ2 — 🔴 ΤΟ ΔΗΜΟΣΙΟ: ΕΝΑ ΥΠΟΒΑΘΡΟ, ΚΑΝΕΝΑΣ ΔΙΑΚΟΠΤΗΣ
// =============================================================================

describe('Κ2 — το `showcase` είναι η απόφαση του Giorgio, γραμμένη', () => {
  it('ΕΝΑ υπόβαθρο: εκείνο με το οποίο ΑΝΟΙΓΕΙ ο χάρτης (ADR-891 Φ1)', () => {
    // Πριν: «Χάρτης» = CARTO Positron, ενώ η σελίδα άνοιγε σε OSM ⇒ κανένα κουμπί πατημένο.
    expect(MAP_CHROME.showcase.basemaps.map((b) => b.style)).toEqual([INITIAL_MAP_STYLE]);
  });

  it('🔴 ΚΑΝΕΝΑΣ «Δορυφόρος» — ήταν οδικός χάρτης (CARTO Voyager) με όνομα δορυφόρου', () => {
    expect(MAP_CHROME.showcase.basemaps.map((b) => b.labelKey)).not.toContain('map.basemap.satellite');
  });

  it('με ένα υπόβαθρο δεν υπάρχει διακόπτης — ούτε πάνελ, αφού δεν υπάρχουν και συντεταγμένες', () => {
    expect(MAP_CHROME.showcase.basemapSwitcher).toBe('none');
    expect(showsBasemapPanel(MAP_CHROME.showcase)).toBe(false);
    expect(showsBasemapPanel(MAP_CHROME.workspace)).toBe(true);
    expect(showsBasemapPanel(MAP_CHROME.embedded)).toBe(true);
  });

  it('🔴 ΚΑΜΙΑ συντεταγμένη, ΚΑΝΕΝΑ υψόμετρο — ο επισκέπτης ψάχνει σπίτι', () => {
    expect(MAP_CHROME.showcase.coordinateReadout).toBe(false);
  });

  it('🔴 ΚΑΝΕΝΑ από τα άλλα πάνελ', () => {
    expect(MAP_CHROME.showcase.pickerControls).toBe(false);
    expect(MAP_CHROME.showcase.statusBar).toBe(false);
    expect(MAP_CHROME.showcase.accuracyLegend).toBe(false);
  });

  it('η ετικέτα του είναι ΑΠΛΗ, όχι η τεχνική του καταλόγου', () => {
    // «OpenStreetMap» ονομάζει την **πηγή πλακιδίων** — λέξη που ο επισκέπτης δεν ξέρει.
    const showcaseKeys = MAP_CHROME.showcase.basemaps.map((b) => b.labelKey);
    expect(showcaseKeys).toEqual(['map.basemap.map']);
    expect(showcaseKeys).not.toContain(MAP_STYLE_CATALOG[INITIAL_MAP_STYLE].labelKey);
  });
});

// =============================================================================
// Κ3 — ΚΑΝΕΝΑ ΑΚΡΟΑΤΗΡΙΟ ΔΕΝ ΕΠΙΝΟΕΙ ΥΠΟΒΑΘΡΟ
// =============================================================================

describe('Κ3 — κάθε προσφερόμενο υπόβαθρο ανήκει στο κλειστό λεξιλόγιο', () => {
  it.each([...MAP_CHROME_PRESETS])('%s', (preset) => {
    for (const choice of MAP_CHROME[preset].basemaps) {
      expect(MAP_STYLES).toContain(choice.style as MapStyleType);
    }
  });

  it('κανένα ακροατήριο δεν προσφέρει το ίδιο υπόβαθρο δύο φορές', () => {
    for (const preset of MAP_CHROME_PRESETS) {
      const styles = MAP_CHROME[preset].basemaps.map((b) => b.style);
      expect(new Set(styles).size).toBe(styles.length);
    }
  });

  it('τα εσωτερικά εργαλεία προσφέρουν ΟΛΑ — καμία σιωπηλή απώλεια στη μετακόμιση', () => {
    for (const preset of ['workspace', 'embedded'] as const) {
      expect(MAP_CHROME[preset].basemaps.map((b) => b.style)).toEqual([...MAP_STYLES]);
    }
  });
});

// =============================================================================
// Κ4 — 🔴 ΤΟ ΑΛΛΟ ΜΙΣΟ ΤΗΣ ΑΠΟΔΕΙΞΗΣ: ΤΑ ΚΛΕΙΔΙΑ ΥΠΑΡΧΟΥΝ, ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// =============================================================================

describe('Κ4 — κάθε ετικέτα υποβάθρου υπάρχει σε el ΚΑΙ en, μη κενή', () => {
  const ALL_LABEL_KEYS = [
    ...Object.values(MAP_STYLE_CATALOG).map((entry) => entry.labelKey),
    ...MAP_CHROME_PRESETS.flatMap((preset) => MAP_CHROME[preset].basemaps.map((b) => b.labelKey)),
  ];

  const UNIQUE_KEYS = [...new Set(ALL_LABEL_KEYS)].sort();

  it('ο παρονομαστής δηλώνεται: 5 διακριτά κλειδιά (4 τεχνικά + 1 απλό)', () => {
    expect(UNIQUE_KEYS).toHaveLength(5);
  });

  it.each(['el', 'en'] as const)('%s', (language) => {
    const tree = loadLocale(language);
    for (const key of UNIQUE_KEYS) {
      const value = resolveKey(tree, key);
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });
});
