/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΠΥΛΗΣ PIXELS** — καθαρή συνάρτηση πάνω σε ΜΙΑ μέτρηση (CHECK 3.101).
 * @related ADR-909 §6.7 · ./pixel-gate-contract · docs/gates/3.101.md
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/judge-pixel-gate
 *
 * Δύο κάδοι, **ποτέ ένας**:
 *
 * | | Κριτήριο | Κάδος |
 * |---|---|---|
 * | Κ0 | τύπος που **δεν φτάνει** στην εικόνα (χάνεται στη μετατροπή της σκηνής) | 🔴 ratchet κατά ταυτότητα |
 * | Κ1 | Ασπρόμαυρο / Γκρι ⇒ κανένα χρωματιστό pixel | 🔴 ratchet κατά ταυτότητα |
 * | Κ2 | καμία γραμμή με αντίθεση < 3:1 προς το χαρτί | 🔴 ratchet κατά ταυτότητα |
 * | Κ3 | καμία γραμμή κάτω από το δάπεδο πάχους | 🔴 ratchet κατά ταυτότητα |
 * | Κ4 | η μέτρηση **έγινε** (κάθε τύπος έχει δείγμα, ό,τι φαίνεται ζωγράφισε, ό,τι κρύβεται όχι, **καμία απώλεια πόρου**) | ⛔ μηδενική ανοχή |
 * | Κ5 | δύο λήψεις ⇒ ίδια pixels | ⛔ μηδενική ανοχή |
 * | Κ6 | μετρήθηκε το **χειρότερο** σενάριο: όλες οι ομάδες αναμμένες | ⛔ μηδενική ανοχή |
 *
 * 🔑 Η ταυτότητα ενός ευρήματος είναι `κριτήριο:στάθμη:τύπος` — **όχι** πλήθος pixels: με αριθμό, η
 * ανταλλαγή «διόρθωσα τον θερμοσίφωνα, έσπασα τον λέβητα» θα περνούσε αθόρυβα (ADR-749).
 */

import { MIN_ENTITY_CONTRAST } from '../../../config/adaptive-entity-color';
import { contrastRatio } from '../../../config/color-math';
import { PRINT_PAPER_HEX } from '../../../config/print-color-policy';
import type { PixelGateLevel, PixelGateMeasurement, PixelGateStroke } from './pixel-gate-contract';

export type PixelGateCriterion = 'K0' | 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6';

export interface PixelGateFinding {
  readonly id: string;
  readonly criterion: PixelGateCriterion;
  readonly detail: string;
}

export interface PixelGateVerdict {
  /** Κ0–Κ3: συγκρίνονται με τη baseline, και τελειώνουν στο μηδέν. */
  readonly ratchet: readonly PixelGateFinding[];
  /** Κ4–Κ6: **δεν μπαίνουν ποτέ** σε baseline. */
  readonly zeroTolerance: readonly PixelGateFinding[];
}

/** Ό,τι οφείλει να ισχύει — από τα SSoT του κώδικα, ποτέ γραμμένο δίπλα στην κρίση. */
export interface PixelGateExpectation {
  readonly renderableTypes: readonly string[];
  readonly groups: readonly string[];
  readonly plotStyles: readonly string[];
}

/** Στάθμες όπου **κάθε** χρώμα είναι ελάττωμα. Το «Έγχρωμο» κρίνεται μόνο για αντίθεση και πάχος. */
const COLOURLESS_STYLES: readonly string[] = ['monochrome', 'grayscale'];

/** Ανοχή στρογγύλευσης της κλίμακας του μετασχηματισμού — όχι περιθώριο για λεπτότερες γραμμές. */
const WIDTH_EPSILON_PX = 0.01;

const NO_SAMPLE = 'unlocated';

/** Ανεξάρτητο από στάθμη ⇒ **ένα** εύρημα ανά τύπο, από την πρώτη λήψη. */
function unconvertibleFindings(m: PixelGateMeasurement): PixelGateFinding[] {
  return (m.levels[0]?.cells ?? [])
    .filter((cell) => cell.unconvertible)
    .map((cell) => ({
      id: `K0:${cell.sample}`,
      criterion: 'K0' as const,
      detail: 'η μετατροπή της σκηνής δεν έδωσε κανένα στοιχείο — ο τύπος δεν ζωγραφίζεται ποτέ',
    }));
}

function chromaFindings(level: PixelGateLevel): PixelGateFinding[] {
  if (!COLOURLESS_STYLES.includes(level.plotStyle)) return [];
  return level.cells
    .filter((cell) => cell.chromaticPx > 0)
    .map((cell) => ({
      id: `K1:${level.plotStyle}:${cell.sample}`,
      criterion: 'K1' as const,
      detail: `${cell.chromaticPx} χρωματιστά px, απόκλιση καναλιών ως ${cell.maxChannelSpread}`,
    }));
}

/** Ομαδοποίηση ανά δείγμα: ένα εύρημα ανά τύπο, με **όλα** τα χρώματα / πάχη του στη λεπτομέρεια. */
function strokeFindings(
  level: PixelGateLevel,
  criterion: 'K2' | 'K3',
  offends: (stroke: PixelGateStroke) => boolean,
  describe: (stroke: PixelGateStroke) => string,
): PixelGateFinding[] {
  const bySample = new Map<string, Set<string>>();
  for (const stroke of level.strokes) {
    if (!offends(stroke)) continue;
    const sample = stroke.sample ?? NO_SAMPLE;
    const details = bySample.get(sample) ?? new Set<string>();
    details.add(describe(stroke));
    bySample.set(sample, details);
  }
  return [...bySample].map(([sample, details]) => ({
    id: `${criterion}:${level.plotStyle}:${sample}`,
    criterion,
    detail: [...details].sort().join(' · '),
  }));
}

function faintFindings(level: PixelGateLevel): PixelGateFinding[] {
  return strokeFindings(
    level,
    'K2',
    (stroke) => contrastRatio(stroke.colourHex, PRINT_PAPER_HEX) < MIN_ENTITY_CONTRAST,
    (stroke) => `${stroke.colourHex} (${contrastRatio(stroke.colourHex, PRINT_PAPER_HEX).toFixed(2)}:1)`,
  );
}

function thinFindings(level: PixelGateLevel, minLineWidthPx: number): PixelGateFinding[] {
  return strokeFindings(
    level,
    'K3',
    (stroke) => stroke.widthPx < minLineWidthPx - WIDTH_EPSILON_PX,
    (stroke) => `${stroke.widthPx.toFixed(2)} px < ${minLineWidthPx}`,
  );
}

function fail(criterion: PixelGateCriterion, id: string, detail: string): PixelGateFinding {
  return { id: `${criterion}:${id}`, criterion, detail };
}

function coverageFindings(m: PixelGateMeasurement, expected: PixelGateExpectation): PixelGateFinding[] {
  const sampled = new Set(m.sampleTypes);
  const known = new Set(expected.renderableTypes);
  const measured = new Set(m.levels.map((level) => level.plotStyle as string));
  return [
    ...expected.renderableTypes
      .filter((type) => !sampled.has(type))
      .map((type) => fail('K4', `no-sample:${type}`, 'τύπος στοιχείου χωρίς δείγμα — η πύλη δεν τον βλέπει')),
    ...m.sampleTypes
      .filter((type) => !known.has(type))
      .map((type) => fail('K4', `ghost-sample:${type}`, 'δείγμα για τύπο που δεν υπάρχει πια')),
    ...expected.plotStyles
      .filter((style) => !measured.has(style))
      .map((style) => fail('K4', `no-level:${style}`, 'στάθμη χρώματος που δεν μετρήθηκε')),
  ];
}

function levelMeasuredFindings(level: PixelGateLevel, sampleTypes: readonly string[]): PixelGateFinding[] {
  const style = level.plotStyle;
  const cells = new Map(level.cells.map((cell) => [cell.sample, cell]));
  const findings: PixelGateFinding[] = [];
  if (level.strokes.length === 0) findings.push(fail('K4', `no-strokes:${style}`, 'καμία γραμμή δεν καταγράφηκε'));
  for (const type of level.unruledTypes) {
    findings.push(fail('K4', `unruled:${style}:${type}`, 'το προφίλ δεν έχει κανόνα για αυτόν τον τύπο'));
  }
  for (const code of level.fidelity) {
    findings.push(
      fail('K4', `fidelity:${style}:${code}`, 'η λήψη έχασε πόρο — μετρήθηκε εφεδρικό σχέδιο (κουτί / επίπεδο χρώμα), όχι το στοιχείο'),
    );
  }
  for (const type of sampleTypes) {
    const cell = cells.get(type);
    if (cell === undefined) findings.push(fail('K4', `no-cell:${style}:${type}`, 'το δείγμα δεν μετρήθηκε'));
    else if (cell.shown && cell.inkPx === 0) {
      findings.push(fail('K4', `no-ink:${style}:${type}`, 'φαίνεται στο κοινό αλλά δεν ζωγράφισε ούτε ένα pixel'));
    } else if (!cell.shown && cell.inkPx > 0) {
      findings.push(fail('K4', `leak:${style}:${type}`, `κρυφό στο κοινό αλλά ζωγράφισε ${cell.inkPx} px`));
    }
  }
  return findings;
}

function determinismFindings(level: PixelGateLevel): PixelGateFinding[] {
  if (level.digest !== '' && level.digest === level.repeatDigest) return [];
  const where = level.repeatDrift.length > 0 ? ` — ${level.repeatDrift.join(' · ')}` : '';
  return [
    fail('K5', level.plotStyle, `δύο λήψεις διαφέρουν: ${level.digest || '∅'} ≠ ${level.repeatDigest || '∅'}${where}`),
  ];
}

function worstCaseFindings(level: PixelGateLevel, expected: PixelGateExpectation): PixelGateFinding[] {
  if (level.groups.join() === expected.groups.join()) return [];
  return [fail('K6', level.plotStyle, `ομάδες λήψης [${level.groups.join()}] ≠ όλες [${expected.groups.join()}]`)];
}

export function judgePixelGate(m: PixelGateMeasurement, expected: PixelGateExpectation): PixelGateVerdict {
  const ratchet = [
    ...unconvertibleFindings(m),
    ...m.levels.flatMap((level) => [
      ...chromaFindings(level),
      ...faintFindings(level),
      ...thinFindings(level, m.minLineWidthPx),
    ]),
  ];
  const zeroTolerance = [
    ...coverageFindings(m, expected),
    ...m.levels.flatMap((level) => [
      ...levelMeasuredFindings(level, m.sampleTypes),
      ...determinismFindings(level),
      ...worstCaseFindings(level, expected),
    ]),
  ];
  return { ratchet, zeroTolerance };
}

export interface PixelGateBaselineDiff {
  /** Νέα ευρήματα — **μπλοκάρουν**. */
  readonly added: readonly PixelGateFinding[];
  /** Ευρήματα της baseline που **δεν υπάρχουν πια** — κλείδωσε την πρόοδο. */
  readonly fixed: readonly string[];
}

/** Σύγκριση **κατά ταυτότητα**: ούτε νέο εύρημα περνά, ούτε διορθωμένο μένει γραμμένο. */
export function diffPixelGateBaseline(
  verdict: PixelGateVerdict,
  baselineIds: readonly string[],
): PixelGateBaselineDiff {
  const baseline = new Set(baselineIds);
  const current = new Set(verdict.ratchet.map((finding) => finding.id));
  return {
    added: verdict.ratchet.filter((finding) => !baseline.has(finding.id)),
    fixed: baselineIds.filter((id) => !current.has(id)),
  };
}
