/**
 * Wall Base vertical-extent resolver (ADR-401 γ — attach-to-structural) — SSoT.
 *
 * Mirror του `wall-top-profile.ts` για τη **βάση** του τοίχου όταν
 * `baseBinding==='attached'`. Η βάση «κολλάει» στην **άνω-παρειά** (topside) ενός
 * ή περισσότερων structural hosts (θεμέλια/δοκάρια/πλάκες).
 *
 * **Συμπεριφορά = Revit «Attach Base» (bidirectional / target-driven):** η βάση
 * ΜΕΓΑΛΩΝΕΙ ή ΜΙΚΡΑΙΝΕΙ ώστε να εφαρμόσει στην παρειά του host — πάνω Ή κάτω από
 * το nominal. Σε κάθε θέση t που καλύπτεται από host → η βάση πάει στην
 * **ΨΗΛΟΤΕΡΗ** άνω-παρειά (upper-envelope: ο τοίχος πατάει στο ψηλότερο στήριγμα,
 * δεν διαπερνά κανένα). Όπου ΔΕΝ καλύπτεται host → fallback στο nominal base.
 *
 * Αντιστροφή έναντι top (lower-envelope): top → `lowestAt` (MIN κάτω-παρειάς,
 * σταματά στο χαμηλότερο ταβάνι). base → `highestAt` (MAX άνω-παρειάς). Όλα τα
 * geometry helpers (TopLine/evalLine/coversLine/collectBreakpoints/clamp01)
 * επαναχρησιμοποιούνται αυτούσια (SSoT, N.0.2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 * @see bim/geometry/wall-top-profile.ts — ο top (lower-envelope) δίδυμος
 * @see Autodesk «Attach Walls to Other Elements» — increases/decreases to conform
 */

import {
  T_EPS,
  Z_EPS,
  clamp01,
  evalLine,
  coversLine,
  collectBreakpoints,
  resolveWallBaseZmm,
  type TopLine,
  type HostTopsidePlan,
  type WallVerticalContext,
  type WallVerticalParams,
} from './wall-top-profile';

/** Από πού προέρχεται το base ενός segment. */
export type WallBaseSource = 'attached' | 'storey-floor' | 'absolute' | 'fallback';

/** Ένα τμήμα βάσης: από t0 έως t1, base πηγαίνει γραμμικά z0→z1 (απόλυτα mm). */
export interface WallBaseSegment {
  readonly t0: number;
  readonly t1: number;
  readonly z0mm: number;
  readonly z1mm: number;
  readonly source: WallBaseSource;
  readonly hostId?: string;
}

/** Πλήρες προφίλ βάσης τοίχου. */
export interface WallBaseProfile {
  /** Nominal (μη-attached) base (mm) — fallback όπου δεν υπάρχει host. */
  readonly nominalBaseZmm: number;
  /** Ordered segments που καλύπτουν [0,1] χωρίς κενά. */
  readonly segments: readonly WallBaseSegment[];
  /** Ψηλότερη βάση (mm). */
  readonly maxBaseZmm: number;
  /** Χαμηλότερη βάση (mm) — για bbox / 3D. */
  readonly minBaseZmm: number;
  /** True αν τουλάχιστον ένας host συνεισφέρει στο προφίλ. */
  readonly hasAttach: boolean;
  /** Hosts που ζητήθηκαν αλλά λείπουν (σβήστηκαν) → fallback + warning. */
  readonly missingHostIds: readonly string[];
}

// ─── Upper-envelope core ─────────────────────────────────────────────────────

/** Build a TopLine από host topside plan (ίδια math με lineFromHost). */
function lineFromTopsideHost(h: HostTopsidePlan): TopLine {
  const t0 = clamp01(Math.min(h.t0, h.t1));
  const t1 = clamp01(Math.max(h.t0, h.t1));
  const span = h.t1 - h.t0;
  const b = Math.abs(span) < T_EPS ? 0 : (h.z1mm - h.z0mm) / span;
  const a = h.z0mm - b * h.t0;
  return { a, b, t0, t1, source: 'attached', hostId: h.hostId };
}

/**
 * Η γραμμή με το ΨΗΛΟΤΕΡΟ z στο t (upper-envelope winner), ή null αν καμία δεν
 * καλύπτει το t. ⚠️ Η ΜΟΝΗ σημασιολογική αντιστροφή έναντι του `lowestAt`:
 * `z > bestZ + Z_EPS` (έναντι `z < bestZ − Z_EPS`).
 */
function highestAt(lines: readonly TopLine[], t: number): TopLine | null {
  let best: TopLine | null = null;
  let bestZ = -Infinity;
  for (const l of lines) {
    if (!coversLine(l, t)) continue;
    const z = evalLine(l, t);
    if (z > bestZ + Z_EPS) {
      best = l;
      bestZ = z;
    }
  }
  return best;
}

/** Η πηγή του nominal base (non-attached binding ή fallback σε attached mode). */
function nominalBaseSource(params: WallVerticalParams): WallBaseSource {
  if (params.baseBinding === 'absolute') return 'absolute';
  if (params.baseBinding === 'storey-floor') return 'storey-floor';
  return 'fallback';
}

/** Συγχώνευση συνεχόμενων collinear segments ίδιας πηγής/host. */
function mergeBaseSegments(segs: readonly WallBaseSegment[]): WallBaseSegment[] {
  const out: WallBaseSegment[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    const collinear =
      prev && prev.source === s.source && prev.hostId === s.hostId && Math.abs(prev.z1mm - s.z0mm) < Z_EPS;
    if (collinear) out[out.length - 1] = { ...prev, t1: s.t1, z1mm: s.z1mm };
    else out.push(s);
  }
  return out;
}

// ─── Resolver ────────────────────────────────────────────────────────────────

function flatProfile(nominalBaseZmm: number, source: WallBaseSource, missing: string[]): WallBaseProfile {
  return {
    nominalBaseZmm,
    segments: [{ t0: 0, t1: 1, z0mm: nominalBaseZmm, z1mm: nominalBaseZmm, source }],
    maxBaseZmm: nominalBaseZmm,
    minBaseZmm: nominalBaseZmm,
    hasAttach: false,
    missingHostIds: missing,
  };
}

/**
 * Resolver SSoT — επιστρέφει το πλήρες προφίλ βάσης τοίχου.
 *
 * - Μη-`attached` baseBinding → ένα segment [0,1] στο nominal base.
 * - `attached` → bidirectional upper-envelope των host topsides. Ακάλυπτο μέρος →
 *   nominal base. Host που λείπει → `missingHostIds` + fallback.
 */
// eslint-disable-next-line max-lines-per-function -- cohesive envelope builder, mirror of resolveWallTopProfile
export function resolveWallBaseProfile(
  params: WallVerticalParams,
  ctx: WallVerticalContext,
): WallBaseProfile {
  const nominalBaseZmm = resolveWallBaseZmm(params, ctx);
  const attachIds = params.attachBaseToIds ?? [];
  if (params.baseBinding !== 'attached' || attachIds.length === 0) {
    return flatProfile(nominalBaseZmm, nominalBaseSource(params), []);
  }

  // attached: μάζεψε host topside lines (κρατώντας τα missing). Bidirectional →
  // ΔΕΝ μπαίνει baseline στο envelope· τα ακάλυπτα spans παίρνουν nominal ρητά.
  const missingHostIds: string[] = [];
  const lines: TopLine[] = [];
  for (const id of attachIds) {
    const h = ctx.resolveHostTopside?.(id) ?? null;
    if (h) lines.push(lineFromTopsideHost(h));
    else missingHostIds.push(id);
  }
  if (lines.length === 0) return flatProfile(nominalBaseZmm, 'fallback', missingHostIds);

  const bps = collectBreakpoints(lines);
  const raw: WallBaseSegment[] = [];
  for (let i = 0; i < bps.length - 1; i++) {
    const ta = bps[i];
    const tb = bps[i + 1];
    if (tb - ta < T_EPS) continue;
    const win = highestAt(lines, (ta + tb) / 2);
    if (win) raw.push({ t0: ta, t1: tb, z0mm: evalLine(win, ta), z1mm: evalLine(win, tb), source: 'attached', hostId: win.hostId });
    else raw.push({ t0: ta, t1: tb, z0mm: nominalBaseZmm, z1mm: nominalBaseZmm, source: 'fallback' });
  }

  const segments = mergeBaseSegments(raw);
  let maxBaseZmm = -Infinity;
  let minBaseZmm = Infinity;
  for (const s of segments) {
    maxBaseZmm = Math.max(maxBaseZmm, s.z0mm, s.z1mm);
    minBaseZmm = Math.min(minBaseZmm, s.z0mm, s.z1mm);
  }
  const hasAttach = segments.some((s) => s.source === 'attached');
  return { nominalBaseZmm, segments, maxBaseZmm, minBaseZmm, hasAttach, missingHostIds };
}

/**
 * Αποτίμηση του base (absolute mm) ενός προφίλ στο `t` (0..1) — γραμμική
 * παρεμβολή z0→z1 εντός του segment που καλύπτει το `t`. SSoT helper πάνω στο
 * `WallBaseProfile` (μηδέν re-derive από params/hosts).
 */
export function evaluateWallBaseAt(profile: WallBaseProfile, t: number): number {
  const tc = clamp01(t);
  for (const s of profile.segments) {
    if (tc >= s.t0 - T_EPS && tc <= s.t1 + T_EPS) {
      const span = s.t1 - s.t0;
      if (span < T_EPS) return s.z0mm;
      return s.z0mm + ((s.z1mm - s.z0mm) * (tc - s.t0)) / span;
    }
  }
  return profile.nominalBaseZmm;
}
