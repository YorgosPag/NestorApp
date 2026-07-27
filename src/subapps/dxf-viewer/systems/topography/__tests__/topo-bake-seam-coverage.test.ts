/**
 * ADR-650 §M10g — CAPABILITY ANCHOR: **δεν υπάρχει ψήσιμο χωρίς σφραγίδα.**
 *
 * Το §M10f γεννήθηκε επειδή τέσσερις παραγωγοί γεννήθηκαν χωρίς τη γέφυρα WORLD→DISPLAY: ο
 * κανόνας υπήρχε, αλλά τίποτα δεν τον **ρωτούσε**. Η σφραγίδα του §M10g θα έπαθε ακριβώς το
 * ίδιο αν έμπαινε «και στους τρεις παραγωγούς»: ο τέταρτος θα ερχόταν χωρίς αυτήν.
 *
 * Άρα ο έλεγχος εδώ δεν είναι «οι τρεις hooks σφραγίζουν» (αυτό είναι το ΔΕΙΓΜΑ). Είναι ο
 * κανόνας: **κανένα module της τοπογραφίας δεν φτάνει στο `completeEntities` παρακάμπτοντας τη
 * ΜΙΑ ραφή** (`topo-bake-commit`). Ένας νέος παραγωγός που θα το έκανε, σκάει εδώ — πριν
 * προλάβει να γεννήσει ψημένη γεωμετρία άγνωστου πλαισίου.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TOPO_BAKED_GROUPS, TOPO_BAKED_GROUP_IDS, bakedGroupOfLayerName, bakedGroupSpec,
} from '../topo-baked-groups';
import {
  getBakedFrame, getBakedFrames, resetBakedFramesForTest, restoreBakedFrames, setBakedFrame,
} from '../topo-baked-frame-store';
import type { ProjectFrameStamp } from '../../geo-referencing/project-frame';

const TOPOGRAPHY_DIR = path.join(__dirname, '..');

/**
 * Τα ΜΟΝΑ modules της τοπογραφίας που επιτρέπεται να αγγίζουν απευθείας το `completeEntities`,
 * με τον λόγο τους. Κάθε προσθήκη εδώ είναι **συνειδητή απόφαση**, όχι παράλειψη.
 */
const DIRECT_COMMIT_ALLOWLIST: Readonly<Record<string, string>> = {
  // Η ίδια η ραφή — αυτή ΕΙΝΑΙ ο τυλιγμένος καλών.
  'topo-bake-commit.ts': 'η ΜΙΑ ραφή του ψησίματος (γράφει σκηνή + σφραγίδα)',
  // Οι ισοϋψείς είναι ΠΑΡΑΓΩΓΟ της πηγής: ξαναχτίζονται πλήρως από τον `regenerate-topo` σε
  // κάθε αλλαγή πλαισίου, οπότε δεν έχουν τι να «θυμούνται» — δεν σφραγίζονται εξ ορισμού.
  'useTopoContours.ts': 'παράγωγο προϊόν — ξαναχτίζεται, δεν μετακινείται με delta',
};

/** Κάθε `.ts` module της τοπογραφίας (όχι tests, όχι υποφάκελοι — η ρίζα του domain). */
function topographyModules(): string[] {
  return fs.readdirSync(TOPOGRAPHY_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('.test.'));
}

describe('ADR-650 §M10g — η ΜΙΑ ραφή του ψησίματος', () => {
  const importsCompleteEntities = (file: string): boolean => {
    const source = fs.readFileSync(path.join(TOPOGRAPHY_DIR, file), 'utf8');
    return /^\s*import\s+\{[^}]*\bcompleteEntit(?:y|ies)\b[^}]*\}\s+from/m.test(source);
  };

  it('ο κατάλογος των modules διαβάστηκε (αλλιώς ο έλεγχος από κάτω δεν αποδεικνύει τίποτα)', () => {
    expect(topographyModules().length).toBeGreaterThan(20);
  });

  it('κανένα module εκτός allowlist δεν εισάγει `completeEntities`', () => {
    const offenders = topographyModules()
      .filter((file) => !(file in DIRECT_COMMIT_ALLOWLIST))
      .filter(importsCompleteEntities);
    expect(offenders).toEqual([]);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: τα allowlisted modules όντως το εισάγουν (η λίστα δεν είναι μπαγιάτικη)', () => {
    for (const file of Object.keys(DIRECT_COMMIT_ALLOWLIST)) {
      expect(importsCompleteEntities(file)).toBe(true);
    }
  });

  it('οι τρεις παραγωγοί ψημένων προϊόντων περνούν από τη ραφή, δηλώνοντας ομάδα', () => {
    const declared: Record<string, string> = {
      'useTopoGrid.ts': "group: 'grid'",
      'useTopoPointLabels.ts': "group: 'pointLabels'",
      'useNorthArrow.ts': "group: 'north'",
    };
    for (const [file, groupLiteral] of Object.entries(declared)) {
      const source = fs.readFileSync(path.join(TOPOGRAPHY_DIR, file), 'utf8');
      expect(source).toContain('commitBakedTopoEntities');
      expect(source).toContain(groupLiteral);
    }
  });
});

describe('ADR-650 §M10g — ο δηλωτικός πίνακας των ομάδων είναι πλήρης', () => {
  it('κάθε ομάδα έχει layers και δηλωμένο προσανατολισμό glyphs', () => {
    for (const group of TOPO_BAKED_GROUP_IDS) {
      const spec = bakedGroupSpec(group);
      expect(spec.layerNames.length).toBeGreaterThan(0);
      expect(['paper', 'world']).toContain(spec.glyphOrientation);
    }
  });

  it('κάθε δηλωμένο layer γυρίζει πίσω στην ομάδα του (ο πίνακας είναι αμφιμονοσήμαντος)', () => {
    for (const spec of TOPO_BAKED_GROUPS) {
      for (const layerName of spec.layerNames) {
        expect(bakedGroupOfLayerName(layerName)).toBe(spec.group);
      }
    }
  });

  it('άγνωστο layer δεν ανήκει πουθενά (καμία σιωπηλή «προεπιλεγμένη» ομάδα)', () => {
    expect(bakedGroupOfLayerName('A-WALL')).toBeNull();
    expect(bakedGroupOfLayerName('TOPO-CONTOUR-MAJOR')).toBeNull();
  });
});

describe('ADR-650 §M10g — ο store των σφραγίδων απολυμαίνει ό,τι έρχεται από το έγγραφο', () => {
  const STAMP: ProjectFrameStamp = { originWorldXMm: 1, originWorldYMm: 2, rotationDeg: 3 };

  afterEach(() => resetBakedFramesForTest());

  it('γράψιμο + ανάγνωση ανά επίπεδο και ομάδα', () => {
    setBakedFrame('flr_a', 'grid', STAMP);
    expect(getBakedFrame('flr_a', 'grid')).toEqual(STAMP);
    expect(getBakedFrame('flr_a', 'north')).toBeNull();
    expect(getBakedFrame('flr_b', 'grid')).toBeNull(); // άλλο επίπεδο = άλλη σφραγίδα
  });

  it('κατεστραμμένες/άγνωστες εγγραφές πέφτουν έξω (fail-closed, όχι «κοντινή τιμή»)', () => {
    restoreBakedFrames({
      flr_a: {
        grid: STAMP,
        north: { originWorldXMm: NaN, originWorldYMm: 0, rotationDeg: 0 },
        // @ts-expect-error — σκόπιμα άγνωστη ομάδα, όπως θα ερχόταν από παλιό/χαλασμένο έγγραφο
        legend: STAMP,
      },
      // @ts-expect-error — σκόπιμα κακοσχηματισμένο επίπεδο
      flr_b: 'not-an-object',
    });
    expect(getBakedFrames()).toEqual({ flr_a: { grid: STAMP } });
  });

  it('απούσα σφραγίδα (legacy έγγραφο) ⇒ άδειο, όχι εικασία', () => {
    restoreBakedFrames(undefined);
    expect(getBakedFrames()).toEqual({});
  });
});
