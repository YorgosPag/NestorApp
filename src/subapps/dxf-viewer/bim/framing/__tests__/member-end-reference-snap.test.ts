/**
 * ADR-508 §end-reference — `member-end-reference-snap` (pure, end-cap 3-tier flush + location line).
 *
 * Fixture (mirror του screenshot Giorgio): **κάθετος** υφιστάμενος τοίχος (0,0)→(0,1000), πάχος 200
 * (μακριές παρειές x=±100, κορυφές y=0 / y=1000). Νέος **οριζόντιος** τοίχος πάχους 300 → ghostHalf=150.
 *
 * Το pivot (1ο κλικ = `start`) μπαίνει ΠΑΝΤΑ στην **κορυφή** (location line)· η `justification` ορίζει
 * ποια γραμμή του φαντάσματος (3γ/2β/1α) κουμπώνει εκεί → προς ποια παρειά «κρέμεται» το σώμα:
 *   · 3γ (νότια) ≡ κορυφή → σώμα ΟΛΟ έξω (body axis y=1150)
 *   · 2β (άξονας) ≡ κορυφή → κεντραρισμένο (body axis y=1000)
 *   · 1α (βόρεια) ≡ κορυφή → σώμα ΟΛΟ μέσα (body axis y=850)
 * Full-chain test επικυρώνει ότι το justification → alignmentPoint → `buildDefaultWallParams` βάζει
 * τον body axis ΑΚΡΙΒΩΣ στο `g` (η γεωμετρία προηγουμένως που έδειχνε το ghost).
 */

import {
  resolveMemberEndReferenceSnap,
  resolveMemberEndCornerCapSnap,
} from '../member-end-reference-snap';
import {
  type LinearMemberSnapTarget,
  type LinearMemberFaceSnapOptions,
} from '../linear-member-face-snap';
import { resolveMemberGhostSnapFromStore } from '../member-ghost-snap';
import {
  alignmentPointForWallJustification,
  buildDefaultWallParams,
} from '../../../hooks/drawing/wall-completion';

/** Κάθετος τοίχος ύψους 1000, πάχος 200 (παρειές x=±100· κορυφές y=0 και y=1000). */
const VERTICAL: LinearMemberSnapTarget = {
  id: 'v1',
  axis: [{ x: 0, y: 0 }, { x: 0, y: 1000 }],
  outline: [
    { x: -100, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 1000 }, { x: -100, y: 1000 },
  ],
};

// Νέος τοίχος πάχους 300 → ghostHalf=150. ghost stub 1200, capture 600.
const OPTS: LinearMemberFaceSnapOptions = { ghostLenScene: 1200, captureScene: 600, memberWidthScene: 300 };

describe('resolveMemberEndReferenceSnap — pivot στην κορυφή + justification ανά βαθμίδα (ανατολικά)', () => {
  it('Στάδιο A (κέρσορας ψηλά, 3γ≡κορυφή): pivot στην κορυφή (100,1000) + justification left', () => {
    const r = resolveMemberEndReferenceSnap({ x: 120, y: 1140 }, [VERTICAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: 100, y: 1000 });
    expect(r!.end).toEqual({ x: 1300, y: 1000 });
    expect(r!.justification).toBe('left');
    expect(r!.targetId).toBe('v1');
  });

  it('Στάδιο B (γωνία, 2β≡κορυφή): pivot στην κορυφή + justification center', () => {
    const r = resolveMemberEndReferenceSnap({ x: 120, y: 1010 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: 100, y: 1000 });
    expect(r!.justification).toBe('center');
  });

  it('Στάδιο Γ (κέρσορας πιο κάτω, 1α≡κορυφή): pivot στην κορυφή + justification right', () => {
    const r = resolveMemberEndReferenceSnap({ x: 120, y: 870 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: 100, y: 1000 });
    expect(r!.justification).toBe('right');
  });

  it('Δυτική πλευρά (stub προς −x): pivot στη ΔΥΤΙΚΗ κορυφή-γωνία, justification αντιστρέφεται με την πλευρά', () => {
    // Στάδιο A δυτικά: σώμα ΠΑΝΩ (+y) απαιτεί justification right (αφού side=−1).
    const a = resolveMemberEndReferenceSnap({ x: -120, y: 1140 }, [VERTICAL], OPTS);
    expect(a!.start).toEqual({ x: -100, y: 1000 });
    expect(a!.end).toEqual({ x: -1300, y: 1000 });
    expect(a!.justification).toBe('right');
    // Στάδιο B δυτικά: center.
    const b = resolveMemberEndReferenceSnap({ x: -120, y: 1010 }, [VERTICAL], OPTS);
    expect(b!.justification).toBe('center');
  });

  it('Κάτω κορυφή (alongMin=0): pivot (100,0), 2β center', () => {
    const r = resolveMemberEndReferenceSnap({ x: 120, y: -10 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: 100, y: 0 });
    expect(r!.end).toEqual({ x: 1300, y: 0 });
    expect(r!.justification).toBe('center');
  });

  it('Κάτω κορυφή, κέρσορας πιο κάτω (σώμα κάτω από τη βάση): pivot (100,0), justification right', () => {
    const r = resolveMemberEndReferenceSnap({ x: 120, y: -140 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: 100, y: 0 });
    expect(r!.justification).toBe('right');
  });

  it('Κέρσορας ΣΤΟΝ ΑΞΟΝΑ πέρα από την άκρη → null (αφήνεται στη συγγραμμική επέκταση 🔴)', () => {
    expect(resolveMemberEndReferenceSnap({ x: 10, y: 1100 }, [VERTICAL], OPTS)).toBeNull();
  });

  it('Κέρσορας ΒΑΘΙΑ στο σώμα → null (αφήνεται στο body Τ-framing 🟢)', () => {
    expect(resolveMemberEndReferenceSnap({ x: 120, y: 500 }, [VERTICAL], OPTS)).toBeNull();
  });

  it('Μακριά από κάθε μέλος → null', () => {
    expect(resolveMemberEndReferenceSnap({ x: 5000, y: 5000 }, [VERTICAL], OPTS)).toBeNull();
  });

  it('Μηδενικό πλάτος νέου μέλους → null (καμία βαθμίδα)', () => {
    expect(resolveMemberEndReferenceSnap({ x: 120, y: 1010 }, [VERTICAL], { ...OPTS, memberWidthScene: 0 })).toBeNull();
  });
});

describe('Full chain — justification → alignmentPoint → buildDefaultWallParams βάζει τον body axis στο g', () => {
  // Νέος τοίχος πάχους 300 (ghostHalf 150)· οι 3 βαθμίδες πρέπει να καταλήγουν σε body axis y ∈ {1150,1000,850}.
  const buildBodyAxisY = (cursorY: number): number => {
    const r = resolveMemberEndReferenceSnap({ x: 120, y: cursorY }, [VERTICAL], OPTS)!;
    const alignmentPoint = alignmentPointForWallJustification(r.start, r.end, r.justification);
    const params = buildDefaultWallParams(r.start, r.end, { thickness: 300 }, 'mm', alignmentPoint);
    // Ο body axis πρέπει να είναι οριζόντιος (παράλληλος στο stub)· επιστρέφουμε το κοινό y.
    expect(params.start.y).toBeCloseTo(params.end.y, 6);
    return params.start.y;
  };

  it('Στάδιο A (3γ≡κορυφή, left) → body axis y=1150 (σώμα ΟΛΟ πάνω από την κορυφή)', () => {
    expect(buildBodyAxisY(1140)).toBeCloseTo(1150, 6);
  });

  it('Στάδιο B (2β≡κορυφή, center) → body axis y=1000 (κεντραρισμένο στην κορυφή)', () => {
    expect(buildBodyAxisY(1010)).toBeCloseTo(1000, 6);
  });

  it('Στάδιο Γ (1α≡κορυφή, right) → body axis y=850 (σώμα ΟΛΟ μέσα)', () => {
    expect(buildBodyAxisY(870)).toBeCloseTo(850, 6);
  });
});

describe('resolveMemberEndCornerCapSnap — γωνία Γ ΒΟΡΕΙΑ της κορυφής (sliding, νότια flush)', () => {
  it('Ανατολική παρειά, βόρεια: ΝΔ γωνία → ΒΔ γωνία υφιστάμενου (−100), απλώνεται ΑΝΑΤΟΛΑ, left', () => {
    const r = resolveMemberEndCornerCapSnap({ x: 100, y: 1100 }, [VERTICAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: -100, y: 1000 });
    expect(r!.end).toEqual({ x: 1100, y: 1000 });
    expect(r!.justification).toBe('left');
  });

  it('Πάνω στον άξονα, βόρεια: ΝΔ γωνία → ΜΕΣΟ κορυφής (0), απλώνεται ΑΝΑΤΟΛΑ', () => {
    const r = resolveMemberEndCornerCapSnap({ x: 0, y: 1100 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: 0, y: 1000 });
    expect(r!.end).toEqual({ x: 1200, y: 1000 });
    expect(r!.justification).toBe('left');
  });

  it('Δυτική παρειά, βόρεια: ΝΑ γωνία → ΒΑ γωνία υφιστάμενου (+100), απλώνεται ΔΥΣΗ, right', () => {
    const r = resolveMemberEndCornerCapSnap({ x: -100, y: 1100 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: 100, y: 1000 });
    expect(r!.end).toEqual({ x: -1100, y: 1000 });
    expect(r!.justification).toBe('right');
  });

  it('ΜΟΝΟ 3 διακριτές θέσεις (καμία ενδιάμεση): cPerp=+50 (δεξιά, εκτός κεντρικής ζώνης) → ΒΔ γωνία (−100), ΟΧΙ −50', () => {
    const r = resolveMemberEndCornerCapSnap({ x: 50, y: 1100 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: -100, y: 1000 });
  });

  it('Κεντρική ζώνη snap: cPerp=20 (≤ 0.25·h=25) → μέσο (0)· cPerp=30 (>25) → ΒΔ γωνία (−100)', () => {
    expect(resolveMemberEndCornerCapSnap({ x: 20, y: 1100 }, [VERTICAL], OPTS)!.start).toEqual({ x: 0, y: 1000 });
    expect(resolveMemberEndCornerCapSnap({ x: 30, y: 1100 }, [VERTICAL], OPTS)!.start).toEqual({ x: -100, y: 1000 });
  });

  it('Εκτός πλάτους (|cPerp|>h) → null (αφήνεται στο §end-reference 3-tier του πλαϊνού)', () => {
    expect(resolveMemberEndCornerCapSnap({ x: 150, y: 1100 }, [VERTICAL], OPTS)).toBeNull();
  });

  it('Μέσα στο σώμα (όχι πέρα από κορυφή) → null', () => {
    expect(resolveMemberEndCornerCapSnap({ x: 50, y: 500 }, [VERTICAL], OPTS)).toBeNull();
  });

  it('Πολύ μακριά βόρεια (πέρα από capture) → null', () => {
    expect(resolveMemberEndCornerCapSnap({ x: 0, y: 1700 }, [VERTICAL], OPTS)).toBeNull();
  });

  it('Κάτω κορυφή (νότια του σώματος): διακριτή γωνία flush στη νότια μικρή παρειά, σώμα νότια', () => {
    const r = resolveMemberEndCornerCapSnap({ x: 50, y: -100 }, [VERTICAL], OPTS);
    expect(r!.start).toEqual({ x: -100, y: 0 });
    expect(r!.justification).toBe('right');
  });

  it('Full chain: corner-cap → alignmentPoint → body axis νότια-flush (south face στο 1000, body 1150)', () => {
    const r = resolveMemberEndCornerCapSnap({ x: 100, y: 1100 }, [VERTICAL], OPTS)!;
    const alignmentPoint = alignmentPointForWallJustification(r.start, r.end, r.justification);
    const params = buildDefaultWallParams(r.start, r.end, { thickness: 300 }, 'mm', alignmentPoint);
    expect(params.start.y).toBeCloseTo(params.end.y, 6); // οριζόντιος
    expect(params.start.y).toBeCloseTo(1150, 6); // body axis = κορυφή + ghostHalf (σώμα ΒΟΡΕΙΑ)
  });
});

describe('resolveMemberGhostSnapFromStore — wiring: corner-cap ΠΡΙΝ 3-tier (αντικαθιστά το 🔴)', () => {
  it('Βόρεια & στον άξονα (πρώην 🔴 ομοαξονικό) → 🟢 corner-cap (ΟΧΙ overlap)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 0, y: 1100 }, [], [VERTICAL], 300, 'mm');
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam'); // 🟢 — όχι 'overlap'
    expect(r!.start).toEqual({ x: 0, y: 1000 });
    expect(r!.justification).toBe('left');
  });
});

describe('resolveMemberGhostSnapFromStore — wiring: end-reference ΠΡΙΝ body Τ-framing', () => {
  it('Γωνία (κορυφή) → end-reference (pivot στην κορυφή y=1000 + justification)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 120, y: 1010 }, [], [VERTICAL], 300, 'mm');
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: 100, y: 1000 });
    expect(r!.justification).toBe('center');
  });

  it('Γωνία ψηλά → justification left διαδίδεται μέσω dispatcher', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 120, y: 1140 }, [], [VERTICAL], 300, 'mm');
    expect(r!.justification).toBe('left');
  });

  it('Μέση σώματος → πέφτει στο body Τ-framing (start ακολουθεί cursor ~y=500, ΟΧΙ κβαντισμένο σε κορυφή)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 120, y: 500 }, [], [VERTICAL], 300, 'mm');
    expect(r!.status).toBe('beam');
    expect(r!.start.x).toBe(100);
    expect(Math.abs(r!.start.y - 500)).toBeLessThanOrEqual(5);
  });
});
