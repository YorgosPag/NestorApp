/**
 * @jest-environment node
 *
 * CHECK 3.101 — η **κρίση** της πύλης pixels, χωρίς browser (ADR-909 §6.7).
 *
 * Κάθε κριτήριο έχει (α) μια μέτρηση που **περνά** και (β) την ελάχιστη αλλαγή της που **κόβει** —
 * άγκυρα που δεν μπορεί να κοκκινίσει για τον δηλωμένο της λόγο είναι σχόλιο.
 */

import { diffPixelGateBaseline, judgePixelGate, type PixelGateExpectation } from '../judge-pixel-gate';
import type { PixelGateCell, PixelGateLevel, PixelGateMeasurement, PixelGateStroke } from '../pixel-gate-contract';

const EXPECTED: PixelGateExpectation = {
  renderableTypes: ['wall', 'pipe', 'dimension'],
  groups: ['plumbing', 'texts'],
  plotStyles: ['monochrome', 'grayscale', 'colour'],
};

const BLACK_STROKE: PixelGateStroke = { sample: 'wall', colourHex: '#000000', widthPx: 4, count: 3 };

function cell(sample: string, over: Partial<PixelGateCell> = {}): PixelGateCell {
  return { sample, shown: true, unconvertible: false, inkPx: 100, chromaticPx: 0, maxChannelSpread: 0, ...over };
}

function level(plotStyle: PixelGateLevel['plotStyle'], over: Partial<PixelGateLevel> = {}): PixelGateLevel {
  return {
    plotStyle,
    groups: EXPECTED.groups,
    widthPx: 4096,
    heightPx: 2048,
    cells: [cell('wall'), cell('pipe'), cell('dimension', { shown: false, inkPx: 0 })],
    strokes: [BLACK_STROKE],
    unruledTypes: [],
    digest: 'abc',
    repeatDigest: 'abc',
    repeatDrift: [],
    fidelity: [],
    ...over,
  };
}

function measurement(levels: readonly PixelGateLevel[], over: Partial<PixelGateMeasurement> = {}): PixelGateMeasurement {
  return { sampleTypes: EXPECTED.renderableTypes, minLineWidthPx: 4, levels, ...over };
}

const CLEAN = [level('monochrome'), level('grayscale'), level('colour')];

function idsOf(m: PixelGateMeasurement): { ratchet: string[]; zero: string[] } {
  const verdict = judgePixelGate(m, EXPECTED);
  return { ratchet: verdict.ratchet.map((f) => f.id), zero: verdict.zeroTolerance.map((f) => f.id) };
}

describe('CHECK 3.101 — κρίση της πύλης pixels', () => {
  it('Μ0 μάρτυρας: καθαρή μέτρηση ⇒ κανένα εύρημα σε κανέναν κάδο', () => {
    expect(idsOf(measurement(CLEAN))).toEqual({ ratchet: [], zero: [] });
  });

  it('Κ0 — τύπος που χάνεται στη μετατροπή: ΕΝΑ εύρημα, όχι ένα ανά στάθμη', () => {
    const lost = [cell('wall'), cell('pipe'), cell('dimension', { shown: false, inkPx: 0, unconvertible: true })];
    const m = measurement(CLEAN.map((l) => ({ ...l, cells: lost })));
    expect(idsOf(m)).toEqual({ ratchet: ['K0:dimension'], zero: [] });
  });

  describe('Κ1 — άχρωμη στάθμη, χρωματιστό pixel', () => {
    const blue = [cell('wall'), cell('pipe', { chromaticPx: 5080, maxChannelSpread: 198 })];

    it('ονομάζει τον τύπο και τη στάθμη', () => {
      const m = measurement([level('monochrome', { cells: blue }), level('grayscale'), level('colour')]);
      expect(idsOf(m).ratchet).toEqual(['K1:monochrome:pipe']);
    });

    it('στο «Έγχρωμο» το χρώμα ΔΕΝ είναι εύρημα', () => {
      const m = measurement([level('monochrome'), level('grayscale'), level('colour', { cells: blue })]);
      expect(idsOf(m).ratchet).toEqual([]);
    });
  });

  describe('Κ2 — γραμμή με αντίθεση κάτω από 3:1 προς το χαρτί', () => {
    it('ο μπεζ σοβάς κόβεται σε ΚΑΘΕ στάθμη, ένα εύρημα ανά τύπο', () => {
      const plaster: PixelGateStroke = { sample: 'wall', colourHex: '#e8e0d0', widthPx: 4, count: 9 };
      const yellow: PixelGateStroke = { sample: 'wall', colourHex: '#c8c800', widthPx: 4, count: 2 };
      const m = measurement([
        level('monochrome'),
        level('grayscale'),
        level('colour', { strokes: [BLACK_STROKE, plaster, yellow] }),
      ]);
      const verdict = judgePixelGate(m, EXPECTED);
      expect(verdict.ratchet.map((f) => f.id)).toEqual(['K2:colour:wall']);
      expect(verdict.ratchet[0].detail).toContain('#e8e0d0');
      expect(verdict.ratchet[0].detail).toContain('#c8c800');
    });

    it('γραμμή χωρίς θέση δεν χάνεται — κόβεται ως «unlocated»', () => {
      const lost: PixelGateStroke = { sample: null, colourHex: '#f0f0f0', widthPx: 4, count: 1 };
      const m = measurement([level('monochrome', { strokes: [BLACK_STROKE, lost] }), level('grayscale'), level('colour')]);
      expect(idsOf(m).ratchet).toEqual(['K2:monochrome:unlocated']);
    });

    it('σκούρο χρώμα (το μπλε των τοίχων) ΔΕΝ είναι εύρημα αντίθεσης', () => {
      const wallBlue: PixelGateStroke = { sample: 'wall', colourHex: '#0038f8', widthPx: 4, count: 1 };
      const m = measurement([level('monochrome'), level('grayscale'), level('colour', { strokes: [wallBlue] })]);
      expect(idsOf(m).ratchet).toEqual([]);
    });
  });

  describe('Κ3 — γραμμή κάτω από το δάπεδο πάχους', () => {
    it('1 px σε εικόνα με δάπεδο 4 ⇒ εύρημα', () => {
      const hair: PixelGateStroke = { sample: 'pipe', colourHex: '#000000', widthPx: 1, count: 4 };
      const m = measurement([level('monochrome', { strokes: [hair] }), level('grayscale'), level('colour')]);
      expect(idsOf(m).ratchet).toEqual(['K3:monochrome:pipe']);
    });

    it('ακριβώς στο δάπεδο (με στρογγύλευση) περνά', () => {
      const atFloor: PixelGateStroke = { sample: 'pipe', colourHex: '#000000', widthPx: 3.995, count: 1 };
      const m = measurement([level('monochrome', { strokes: [atFloor] }), level('grayscale'), level('colour')]);
      expect(idsOf(m).ratchet).toEqual([]);
    });
  });

  describe('Κ4 — η μέτρηση ΕΓΙΝΕ', () => {
    it('τύπος χωρίς δείγμα', () => {
      const m = measurement(CLEAN, { sampleTypes: ['wall', 'dimension'] });
      expect(idsOf(m).zero).toContain('K4:no-sample:pipe');
    });

    it('δείγμα για τύπο που δεν υπάρχει πια', () => {
      const m = measurement(CLEAN, { sampleTypes: [...EXPECTED.renderableTypes, 'ghost'] });
      expect(idsOf(m).zero).toContain('K4:ghost-sample:ghost');
    });

    it('στάθμη που δεν μετρήθηκε', () => {
      expect(idsOf(measurement([level('monochrome'), level('colour')])).zero).toEqual(['K4:no-level:grayscale']);
    });

    it('🔴 λήψη με απώλεια πόρου (σχήμα 3Δ / εικόνα που δεν φόρτωσε) ⇒ η μέτρηση είναι άκυρη', () => {
      // Η πύλη θα έκρινε το κουτί-εφεδρεία και θα έλεγε «μετρήθηκε» (ADR-909 Γ1β). Ανά στάθμη, ανά κωδικό.
      const boxed = level('grayscale', { fidelity: ['mesh-shape-missing', 'hatch-image-solid'] });
      const { ratchet, zero } = idsOf(measurement([level('monochrome'), boxed, level('colour')]));
      expect(zero).toEqual(['K4:fidelity:grayscale:mesh-shape-missing', 'K4:fidelity:grayscale:hatch-image-solid']);
      expect(ratchet).toEqual([]);
    });

    it('ό,τι φαίνεται οφείλει να ζωγραφίσει· ό,τι κρύβεται, όχι', () => {
      const cells = [cell('wall', { inkPx: 0 }), cell('pipe'), cell('dimension', { shown: false, inkPx: 12 })];
      const m = measurement([level('monochrome', { cells }), level('grayscale'), level('colour')]);
      expect(idsOf(m).zero).toEqual(['K4:no-ink:monochrome:wall', 'K4:leak:monochrome:dimension']);
    });

    it('δείγμα που δεν μετρήθηκε, τύπος χωρίς κανόνα, καμία γραμμή', () => {
      const broken = level('monochrome', { cells: [cell('wall'), cell('pipe')], unruledTypes: ['new-type'], strokes: [] });
      expect(idsOf(measurement([broken, level('grayscale'), level('colour')])).zero).toEqual([
        'K4:no-strokes:monochrome',
        'K4:unruled:monochrome:new-type',
        'K4:no-cell:monochrome:dimension',
      ]);
    });
  });

  it('Κ5 — δύο λήψεις που διαφέρουν, και άδειο αποτύπωμα', () => {
    const drift = level('monochrome', { repeatDigest: 'abd' });
    const empty = level('grayscale', { digest: '', repeatDigest: '' });
    expect(idsOf(measurement([drift, empty, level('colour')])).zero).toEqual(['K5:monochrome', 'K5:grayscale']);
  });

  it('Κ5 — το εύρημα ονομάζει ΠΟΙΟ δείγμα άλλαξε, όχι μόνο ότι «διαφέρουν»', () => {
    const drift = level('monochrome', { repeatDigest: 'abd', repeatDrift: ['text (120 px)', 'table (9 px)'] });
    const verdict = judgePixelGate(measurement([drift, level('grayscale'), level('colour')]), EXPECTED);
    const finding = verdict.zeroTolerance.find((f) => f.criterion === 'K5');
    expect(finding?.detail).toContain('text (120 px) · table (9 px)');
  });

  it('Κ6 — λήψη με λιγότερες ομάδες από όλες δεν είναι το χειρότερο σενάριο', () => {
    const easy = level('colour', { groups: ['texts'] });
    expect(idsOf(measurement([level('monochrome'), level('grayscale'), easy])).zero).toEqual(['K6:colour']);
  });

  describe('baseline κατά ταυτότητα', () => {
    const blue = [cell('wall'), cell('pipe', { chromaticPx: 9, maxChannelSpread: 90 })];
    const verdict = judgePixelGate(
      measurement([level('monochrome', { cells: blue }), level('grayscale'), level('colour')]),
      EXPECTED,
    );

    it('γνωστό εύρημα δεν μπλοκάρει', () => {
      expect(diffPixelGateBaseline(verdict, ['K1:monochrome:pipe'])).toEqual({ added: [], fixed: [] });
    });

    it('νέο εύρημα μπλοκάρει, ακόμη κι αν το πλήθος μένει ίδιο (ανταλλαγή)', () => {
      const diff = diffPixelGateBaseline(verdict, ['K1:monochrome:wall']);
      expect(diff.added.map((f) => f.id)).toEqual(['K1:monochrome:pipe']);
      expect(diff.fixed).toEqual(['K1:monochrome:wall']);
    });
  });
});
