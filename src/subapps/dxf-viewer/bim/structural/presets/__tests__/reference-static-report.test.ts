/**
 * Cross-check: engine defaults ↔ πραγματική εγκεκριμένη μελέτη (ADR-479).
 *
 * Το reference {@link THERMI_288_08} γίνεται **ζωντανό συμβόλαιο**: αν κάποια
 * default τιμή της μηχανής αποκλίνει από την πραγματική μελέτη Θέρμη 288/08, το
 * test δείχνει ακριβώς πού. Επίσης guard-άρει το human-readable docs JSON έναντι
 * του code SSoT (μηδέν silent drift).
 *
 * @see ../reference-static-report.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEFAULT_CONCRETE_GRADE } from '../../concrete-grades';
import { REBAR_GRADE } from '../../rebar-catalog';
import { EN1990_ULS_FACTORS } from '../../loads/load-combinations';
import { OCCUPANCY_IMPOSED_KPA } from '../../loads/occupancy-loads';
import {
  DEFAULT_SEISMIC_GROUND_ACCEL_RATIO,
  DEFAULT_SEISMIC_GROUND_TYPE,
} from '../../loads/seismic-params';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../../codes/greek-legacy-provider';
import type { StructuralCodeProvider } from '../../codes/structural-code-types';
import { DEFAULT_STRUCTURAL_SETTINGS } from '../../structural-settings';
import { THERMI_288_08 } from '../reference-static-report';
import { buildStructuralSettingsForPreset } from '../structural-preset-defaults';

const REF = THERMI_288_08;

// ── 1. Engine defaults == πραγματική μελέτη (equality) ───────────────────────

describe('engine SSoT defaults ↔ Θέρμη 288/08 (equality)', () => {
  it('default concrete grade ταυτίζεται με τη μελέτη (C25/30)', () => {
    expect(DEFAULT_CONCRETE_GRADE).toBe(REF.concreteGrade);
  });

  it('ποιότητα χάλυβα οπλισμού ταυτίζεται (B500C)', () => {
    expect(REBAR_GRADE).toBe(REF.rebarGrade);
  });

  it('ωφέλιμο q_k κατοικίας ταυτίζεται (2.0 kPa, EN1991-1-1 Cat A)', () => {
    expect(OCCUPANCY_IMPOSED_KPA.residential).toBe(REF.imposedLoadsKpa.residential);
  });

  it('ωφέλιμο q_k καταστημάτων ταυτίζεται (5.0 kPa, Cat D)', () => {
    expect(OCCUPANCY_IMPOSED_KPA.shopping).toBe(REF.imposedLoadsKpa.shopping);
  });

  it('default κατηγορία εδάφους EC8 ταυτίζεται (B)', () => {
    expect(DEFAULT_SEISMIC_GROUND_TYPE).toBe(REF.seismic.groundType);
  });

  it('default a_gR/g ταυτίζεται (0.16 — Ζώνη I)', () => {
    expect(DEFAULT_SEISMIC_GROUND_ACCEL_RATIO).toBe(REF.seismic.groundAccelRatio);
  });

  it('θεμελιώδης συνδυασμός ULS ταυτίζεται (1.35·G + 1.50·Q)', () => {
    expect(EN1990_ULS_FACTORS.gammaG).toBe(REF.ulsFactors.gammaG);
    expect(EN1990_ULS_FACTORS.gammaQ).toBe(REF.ulsFactors.gammaQ);
  });
});

// ── 2. Code-min covers ≤ study covers (η μελέτη ικανοποιεί τα code minima) ────

const COL_CTX = { widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160_000 } as const;
const BEAM_CTX = {
  widthMm: 250,
  depthMm: 500,
  spanMm: 5000,
  grossAreaMm2: 125_000,
  supportType: 'simple',
} as const;
const PAD_CTX = {
  kind: 'pad',
  widthMm: 1500,
  lengthMm: 1500,
  thicknessMm: 500,
  grossAreaMm2: 2_250_000,
} as const;
const SLAB_CTX = {
  kind: 'suspended',
  widthMm: 4000,
  lengthMm: 5000,
  thicknessMm: 200,
  grossAreaMm2: 20_000_000,
} as const;

describe.each<[string, StructuralCodeProvider]>([
  ['eurocode', EUROCODE_PROVIDER],
  ['greek-legacy', GREEK_LEGACY_PROVIDER],
])('code-min επικαλύψεις ≤ μελέτη — %s', (_id, provider) => {
  it('κολώνα: engineMin ≤ study (35mm)', () => {
    const cnom = provider.columnReinforcementLimits(COL_CTX, 16).nominalCoverMm;
    expect(cnom).toBeLessThanOrEqual(REF.covers.columnMm);
  });

  it('δοκός: engineMin ≤ study (35mm)', () => {
    const cnom = provider.beamReinforcementLimits(BEAM_CTX, 16).nominalCoverMm;
    expect(cnom).toBeLessThanOrEqual(REF.covers.beamMm);
  });

  it('πέδιλο: engineMin ≤ study (60mm)', () => {
    const cnom = provider.footingReinforcementLimits(PAD_CTX).nominalCoverMm;
    expect(cnom).toBeLessThanOrEqual(REF.covers.foundationMm);
  });

  it('πλάκα (αναρτημένη): engineMin ≤ study (30mm)', () => {
    const cnom = provider.slabFoundationReinforcementLimits(SLAB_CTX).nominalCoverMm;
    expect(cnom).toBeLessThanOrEqual(REF.covers.slabMm);
  });
});

// ── 3. Built-in preset factory correctness ───────────────────────────────────

describe('buildStructuralSettingsForPreset', () => {
  it('greek-rc-ec8 ⇒ eurocode + τιμές μελέτης', () => {
    const s = buildStructuralSettingsForPreset('greek-rc-ec8');
    expect(s).toEqual({
      codeId: 'eurocode',
      defaultConcreteGrade: REF.concreteGrade,
      occupancy: REF.primaryOccupancy,
      seismicGroundType: REF.seismic.groundType,
      seismicGroundAccelRatio: REF.seismic.groundAccelRatio,
      soilBearingCapacityKpa: REF.soil.allowableBearingKpa,
    });
  });

  it('greek-rc-legacy ⇒ μόνο ο κανονισμός αλλάζει (greek-legacy)', () => {
    const ec8 = buildStructuralSettingsForPreset('greek-rc-ec8');
    const legacy = buildStructuralSettingsForPreset('greek-rc-legacy');
    expect(legacy.codeId).toBe('greek-legacy');
    expect({ ...legacy, codeId: ec8.codeId }).toEqual(ec8);
  });

  it('blank ⇒ τα γυμνά DEFAULT_STRUCTURAL_SETTINGS', () => {
    expect(buildStructuralSettingsForPreset('blank')).toEqual(DEFAULT_STRUCTURAL_SETTINGS);
  });
});

// ── 4. Docs JSON ↔ code SSoT sync guard (μηδέν silent drift) ─────────────────

describe('docs JSON mirror ↔ THERMI_288_08 (sync guard)', () => {
  const jsonPath = resolve(
    __dirname,
    '../../../../../../../docs/centralized-systems/reference/structural-guides/static-report-reference-parameters.json',
  );
  const doc = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
    shared: {
      materials: { concrete: { grade: string } };
      liveLoads: { residentialKnM2: number; shopsKnM2: number };
      seismic: { soilCategory: string; groundAccelerationAgRatio: number };
      soil: { allowableBearingPressureKnM2: number };
      durability: { concreteCoverMm: { slabs: number; beams: number; columns: number; foundations: number } };
    };
    buildings: ReadonlyArray<{ id: string; dynamics: { naturalPeriodTxSec: number; naturalPeriodTySec: number } }>;
  };

  it('υλικά/φορτία/σεισμός/έδαφος ταυτίζονται με το code SSoT', () => {
    expect(doc.shared.materials.concrete.grade).toBe(REF.concreteGrade);
    expect(doc.shared.liveLoads.residentialKnM2).toBe(REF.imposedLoadsKpa.residential);
    expect(doc.shared.liveLoads.shopsKnM2).toBe(REF.imposedLoadsKpa.shopping);
    expect(doc.shared.seismic.soilCategory).toBe(REF.seismic.groundType);
    expect(doc.shared.seismic.groundAccelerationAgRatio).toBe(REF.seismic.groundAccelRatio);
    expect(doc.shared.soil.allowableBearingPressureKnM2).toBe(REF.soil.allowableBearingKpa);
  });

  it('επικαλύψεις ταυτίζονται', () => {
    expect(doc.shared.durability.concreteCoverMm.slabs).toBe(REF.covers.slabMm);
    expect(doc.shared.durability.concreteCoverMm.beams).toBe(REF.covers.beamMm);
    expect(doc.shared.durability.concreteCoverMm.columns).toBe(REF.covers.columnMm);
    expect(doc.shared.durability.concreteCoverMm.foundations).toBe(REF.covers.foundationMm);
  });

  it('ιδιοπεριόδους ανά κτίριο ταυτίζονται (Κ1/Κ2/Κ3)', () => {
    for (const ref of REF.buildings) {
      const json = doc.buildings.find((b) => b.id === ref.id);
      expect(json).toBeDefined();
      expect(json?.dynamics.naturalPeriodTxSec).toBe(ref.naturalPeriodTxSec);
      expect(json?.dynamics.naturalPeriodTySec).toBe(ref.naturalPeriodTySec);
    }
  });
});

// ── 5. Documented gaps (engine δεν τα έχει ακόμα — βλ. ADR-479) ───────────────

// ψ1/ψ2 (quasi-permanent / frequent) συντελεστές κινητών φορτίων: η μελέτη τους έχει
// (ψ1=0.5, ψ2=0.3) αλλά το engine χρησιμοποιεί μόνο τον θεμελιώδη συνδυασμό 6.10.
// eslint-disable-next-line jest/no-disabled-tests
it.todo('engine: ψ1/ψ2 συντελεστές συνδυασμού (σεισμικός/quasi-permanent) — DEFER');
