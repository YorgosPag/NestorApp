/**
 * ADR-650 M8β/Γ v2 — ποιες κορυφές μιας υποψήφιας αξίζουν σημάδι.
 *
 * Ο κανόνας είναι ολόκληρος «κρίση», όχι τύπος: αν χαλαρώσει, η εστιασμένη γραμμή ξαναγίνεται
 * ταινία κουκκίδων σε πυκνή οριογραμμή· αν σφίξει, μια πραγματική γωνία δρόμου μένει ασημάδευτη.
 * Κανένα από τα δύο δεν το πιάνει ο compiler, και κανένα δεν φαίνεται σε 9 συνθετικές κορυφές —
 * φαίνεται σε 50+, δηλαδή εκεί που δεν κοιτάει κανείς. Γι' αυτό καρφώνεται εδώ.
 */

import {
  POLYLINE_CORNER_LIMIT,
  POLYLINE_CORNER_THRESHOLD_DEG,
  selectPolylineCornerIndices,
} from '../polyline-corner-vertices';

/** Επίπεδη αλυσίδα (z=0) από ζεύγη — ό,τι πιο κοντινό σε κάτοψη διαδρομής. */
function chain(plan: readonly (readonly [number, number])[]): Float32Array {
  const out = new Float32Array(plan.length * 3);
  plan.forEach(([x, y], i) => {
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = 0;
  });
  return out;
}

describe('selectPolylineCornerIndices', () => {
  it('ευθεία αλυσίδα → ΜΟΝΟ τα δύο άκρα', () => {
    const straight = chain([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
    expect(selectPolylineCornerIndices(straight, false)).toEqual([0, 5]);
  });

  it('κρατά την πραγματική στροφή, αγνοεί τις συνευθειακές αρθρώσεις', () => {
    const dogLeg = chain([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]);
    expect(selectPolylineCornerIndices(dogLeg, false)).toEqual([0, 2, 4]);
  });

  it('η στροφή μετριέται σε 3Δ — μια σπασμένη ΚΛΙΣΗ είναι γωνία, όχι μόνο μια στροφή σε κάτοψη', () => {
    // Ίδια διεύθυνση σε κάτοψη· η κορυφή 1 ανεβαίνει 45° και μετά ξαναπέφτει σε οριζόντιο.
    // Είναι το «elevation point» του Civil 3D: αν το χάσουμε, ο έλεγχος κλίσης μένει τυφλός.
    const gradeBreak = new Float32Array([0, 0, 0, 1, 1, 0, 2, 1, 0]);
    expect(selectPolylineCornerIndices(gradeBreak, false)).toEqual([0, 1, 2]);
  });

  it('ακριβώς ΚΑΤΩ από το κατώφλι → δεν είναι γωνία· ακριβώς ΠΑΝΩ → είναι', () => {
    const at = (deg: number): Float32Array => {
      const rad = (deg * Math.PI) / 180;
      return chain([[-1, 0], [0, 0], [Math.cos(rad), Math.sin(rad)]]);
    };
    expect(selectPolylineCornerIndices(at(POLYLINE_CORNER_THRESHOLD_DEG - 1), false)).toEqual([0, 2]);
    expect(selectPolylineCornerIndices(at(POLYLINE_CORNER_THRESHOLD_DEG + 1), false)).toEqual([0, 1, 2]);
  });

  it('κλειστός βρόχος → κανένα άκρο, αλλά και η κορυφή 0 κρίνεται ως εσωτερική', () => {
    // Τρίγωνο: και οι τρεις κορυφές στρίβουν 120° — καμία δεν είναι «αρχή».
    const triangle = chain([[0, 0], [4, 0], [2, 3]]);
    expect(selectPolylineCornerIndices(triangle, true)).toEqual([0, 1, 2]);
  });

  it('ομαλός κλειστός βρόχος → ΚΑΝΕΝΑ σημάδι (η ίδια η γραμμή κουβαλά την έμφαση)', () => {
    const circle: [number, number][] = [];
    for (let i = 0; i < 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      circle.push([Math.cos(t) * 100, Math.sin(t) * 100]); // 6° ανά κορυφή
    }
    expect(selectPolylineCornerIndices(chain(circle), true)).toEqual([]);
  });

  it('πυκνό ζιγκ-ζαγκ → κόβεται στο πλαφόν, κρατώντας τις ΟΞΥΤΕΡΕΣ, όχι τις πρώτες', () => {
    // 60 κορυφές που στρίβουν όλες· η οξύτητα μεγαλώνει προς το τέλος, άρα ένα «κράτα τις πρώτες Ν»
    // θα κρατούσε ακριβώς τις λιγότερο σημαντικές.
    const zig: [number, number][] = [[0, 0]];
    for (let i = 1; i <= 60; i++) zig.push([i, (i % 2 === 0 ? 1 : -1) * i * 0.5]);
    const kept = selectPolylineCornerIndices(chain(zig), false);
    expect(kept).toHaveLength(POLYLINE_CORNER_LIMIT + 2); // + τα δύο άκρα, που δεν μπαίνουν στο πλαφόν
    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(60);
    expect(kept.filter((i) => i > 30).length).toBeGreaterThan(kept.filter((i) => i > 0 && i < 30).length);
  });

  it('ΠΟΤΕ δεν επιστρέφει κορυφή με NaN — ένα σημάδι στο NaN μηδενίζει όλη τη σκηνή (ADR-537)', () => {
    const broken = new Float32Array([Number.NaN, 0, 0, 1, 0, 0, 2, 0, 0, 2, 5, 0]);
    // Το άκρο 0 είναι NaN → πέφτει· η κορυφή 1 δεν μπορεί να μετρηθεί (γείτονας NaN) → πέφτει.
    expect(selectPolylineCornerIndices(broken, false)).toEqual([2, 3]);
  });

  it('διπλή κορυφή δεν είναι γωνία — μηδενικό βήμα δεν έχει διεύθυνση', () => {
    const duplicated = chain([[0, 0], [1, 0], [1, 0], [2, 0]]);
    expect(selectPolylineCornerIndices(duplicated, false)).toEqual([0, 3]);
  });

  it('εκφυλισμένες περιπτώσεις δεν σκάνε', () => {
    expect(selectPolylineCornerIndices(new Float32Array(0), false)).toEqual([]);
    expect(selectPolylineCornerIndices(chain([[0, 0]]), false)).toEqual([0]);
    expect(selectPolylineCornerIndices(chain([[0, 0], [1, 0]]), false)).toEqual([0, 1]);
  });
});
