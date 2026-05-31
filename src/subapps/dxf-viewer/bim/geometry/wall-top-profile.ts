/**
 * Wall Top/Base vertical-extent resolver (ADR-401 Phase A) — SSoT.
 *
 * ΕΝΑΣ pure resolver για το **κατακόρυφο εύρος** ενός τοίχου BIM. Αντικαθιστά
 * το σκόρπιο `baseY + params.height` σε ΟΛΑ τα downstream paths (3D extrude,
 * 2D section, BOQ, grips, dimensions). Επειδή ο τοίχος μπορεί να «κολλήσει»
 * (attach) σε δομικά στοιχεία (δοκάρι/πλάκα/στέγη/τοίχος — ADR-401 §2.5), η
 * κορυφή ΔΕΝ είναι πάντα ένας scalar: γίνεται **προφίλ** κατά μήκος του άξονα
 * που υποστηρίζει **σκαλωτή** (πολλαπλά δοκάρια/μερική κάλυψη) και **κεκλιμένη**
 * (κεκλιμένο δοκάρι/στέγη) κορυφή — lower-envelope (§2.2).
 *
 * Convention μονάδων: όλα τα Z σε **απόλυτα mm** από project origin (ίδια
 * σύμβαση με `beam.topElevation` / `slab.levelElevation`, ADR-369 §2). Ο
 * καλών παρέχει το `floorElevationMm` (FFL του ορόφου, ADR-369 datum).
 *
 * Σύμβαση `t`: παράμετρος κατά μήκος του άξονα του τοίχου, 0 = start, 1 = end
 * (arc-length-normalized από τον καλούντα). Τα segments καλύπτουν [0,1] χωρίς
 * κενά, ταξινομημένα.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.2, §2.3
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2 (datum)
 */

import type { WallBaseBinding, WallTopBinding } from '../types/bim-binding';

/** Αριθμητικό όριο για να θεωρηθεί ένα t-διάστημα μη-εκφυλισμένο. */
export const T_EPS = 1e-9;
/** Όριο για να θεωρηθούν δύο Z τιμές ίσες (mm) — collinear merge. */
export const Z_EPS = 1e-6;

/**
 * Κάθετο εύρος ενός host προβαλλόμενο στον άξονα του τοίχου. Το `resolveHost`
 * / `candidateHosts` του context παράγουν αυτή τη δομή από beam/slab/roof/wall
 * (κάτω-παρειά formula §2.3 + plan-overlap span). `z(t)` είναι γραμμικό μεταξύ
 * `z0mm` (στο `t0`) και `z1mm` (στο `t1`) → υποστηρίζει κεκλιμένο host.
 */
export interface HostUndersidePlan {
  readonly hostId: string;
  readonly hostType: 'beam' | 'slab' | 'roof' | 'wall';
  /** span κάλυψης (0..1) πάνω στον άξονα του τοίχου. */
  readonly t0: number;
  readonly t1: number;
  /** underside (απόλυτο mm) στα t0, t1 αντίστοιχα. */
  readonly z0mm: number;
  readonly z1mm: number;
}

/**
 * ADR-401 (γ) — mirror του `HostUndersidePlan` για base-attach: η **άνω-παρειά**
 * (topside) ενός host προβαλλόμενη στον άξονα του τοίχου. Distinct type (ΟΧΙ
 * alias) ώστε ένα underside↔topside swap να αποτυγχάνει στο compile.
 * Καταναλώνεται από `resolveWallBaseProfile` (`wall-base-profile.ts`).
 */
export interface HostTopsidePlan {
  readonly hostId: string;
  readonly hostType: 'beam' | 'slab' | 'roof' | 'wall';
  readonly t0: number;
  readonly t1: number;
  /** topside (απόλυτο mm) στα t0, t1 αντίστοιχα. */
  readonly z0mm: number;
  readonly z1mm: number;
}

/** Context που χρειάζεται ο resolver — όλα προαιρετικά πλην του FFL. */
export interface WallVerticalContext {
  /** FFL του ορόφου του τοίχου (απόλυτο mm, ADR-369 datum). */
  readonly floorElevationMm: number;
  /** FFL επόμενου ορόφου (απόλυτο mm) — για `storey-ceiling`. */
  readonly nextFloorElevationMm?: number;
  /** Πάχος πλάκας οροφής (mm) — `storey-ceiling` αφαιρεί την πλάκα. */
  readonly ceilingSlabThicknessMm?: number;
  /** Lookup host plan ανά id (για `topBinding='attached'`). */
  readonly resolveHost?: (id: string) => HostUndersidePlan | null;
  /** ADR-401 (γ) — lookup host topside ανά id (για `baseBinding='attached'`). */
  readonly resolveHostTopside?: (id: string) => HostTopsidePlan | null;
}

/** Από πού προέρχεται το top ενός segment. */
export type WallTopSource =
  | 'attached'
  | 'storey-ceiling'
  | 'absolute'
  | 'unconnected'
  | 'fallback';

/** Ένα τμήμα κορυφής: από t0 έως t1, top πηγαίνει γραμμικά z0→z1 (απόλυτα mm). */
export interface WallTopSegment {
  readonly t0: number;
  readonly t1: number;
  readonly z0mm: number;
  readonly z1mm: number;
  readonly source: WallTopSource;
  readonly hostId?: string;
}

/** Πλήρες προφίλ κορυφής τοίχου. */
export interface WallTopProfile {
  /** Απόλυτο Z βάσης (mm). */
  readonly baseZmm: number;
  /** Ordered segments που καλύπτουν [0,1] χωρίς κενά. */
  readonly segments: readonly WallTopSegment[];
  /** Ψηλότερο top (mm) — για bbox / 3D. */
  readonly maxTopZmm: number;
  /** Χαμηλότερο top (mm). */
  readonly minTopZmm: number;
  /** True αν τουλάχιστον ένας host συνεισφέρει στο προφίλ. */
  readonly hasAttach: boolean;
  /** Hosts που ζητήθηκαν αλλά λείπουν (σβήστηκαν) → fallback + warning. */
  readonly missingHostIds: readonly string[];
}

/** Δομικό υποσύνολο των WallParams που χρειάζεται ο resolver (WallParams assignable). */
export interface WallVerticalParams {
  readonly baseBinding: WallBaseBinding;
  readonly topBinding: WallTopBinding;
  readonly baseOffset: number;
  readonly topOffset: number;
  readonly height: number;
  readonly unconnectedHeight?: number;
  readonly attachTopToIds?: readonly string[];
  /** ADR-401 (γ) — base-attach host ids (bidirectional). Βλ. `wall-base-profile.ts`. */
  readonly attachBaseToIds?: readonly string[];
}

// ─── Base + nominal-top scalar resolution (shared με section-intersect) ───────

/**
 * Απόλυτο Z βάσης τοίχου (mm). `absolute` → `baseOffset` ως απόλυτο· αλλιώς
 * FFL ορόφου + offset (ADR-369 datum).
 */
export function resolveWallBaseZmm(params: WallVerticalParams, ctx: WallVerticalContext): number {
  return params.baseBinding === 'absolute'
    ? params.baseOffset
    : ctx.floorElevationMm + params.baseOffset;
}

/**
 * Το «nominal» (μη-attached) top ενός τοίχου σε απόλυτο mm — η baseline κορυφή
 * που ισχύει όπου δεν υπάρχει host. Καλύπτει `storey-ceiling`(−πλάκα οροφής)
 * / `absolute` / `unconnected` / fallback. ΕΝΑΣ SSoT για 2D section + baseline.
 */
export function resolveWallNominalTopZmm(params: WallVerticalParams, ctx: WallVerticalContext): number {
  const baseZ = resolveWallBaseZmm(params, ctx);
  if (params.topBinding === 'unconnected') {
    return baseZ + (params.unconnectedHeight ?? params.height);
  }
  if (params.topBinding === 'absolute') {
    return params.topOffset;
  }
  // 'storey-ceiling' | 'attached' baseline: επόμενο FFL − πάχος πλάκας οροφής.
  if (ctx.nextFloorElevationMm !== undefined) {
    return ctx.nextFloorElevationMm - (ctx.ceilingSlabThicknessMm ?? 0) + params.topOffset;
  }
  // Χωρίς storey context → nominal height fallback (Revit «Unconnected Height»).
  return baseZ + params.height;
}

/** Η πηγή της baseline κορυφής (ποιο binding έδωσε το nominal top). */
function nominalSource(params: WallVerticalParams, ctx: WallVerticalContext): WallTopSource {
  if (params.topBinding === 'unconnected') return 'unconnected';
  if (params.topBinding === 'absolute') return 'absolute';
  return ctx.nextFloorElevationMm !== undefined ? 'storey-ceiling' : 'fallback';
}

// ─── Lower-envelope core (attached profile) ──────────────────────────────────

/**
 * Γραμμική συνάρτηση z(t)=a+b·t έγκυρη σε [t0,t1] + provenance. Envelope-agnostic
 * (επαναχρησιμοποιείται από `wall-base-profile.ts` για το upper-envelope).
 */
export interface TopLine {
  readonly a: number;
  readonly b: number;
  readonly t0: number;
  readonly t1: number;
  readonly source: WallTopSource;
  readonly hostId?: string;
}

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

function lineFromHost(h: HostUndersidePlan): TopLine {
  const t0 = clamp01(Math.min(h.t0, h.t1));
  const t1 = clamp01(Math.max(h.t0, h.t1));
  const span = h.t1 - h.t0;
  const b = Math.abs(span) < T_EPS ? 0 : (h.z1mm - h.z0mm) / span;
  const a = h.z0mm - b * h.t0;
  return { a, b, t0, t1, source: 'attached', hostId: h.hostId };
}

export const evalLine = (l: TopLine, t: number): number => l.a + l.b * t;
export const coversLine = (l: TopLine, t: number): boolean => t >= l.t0 - T_EPS && t <= l.t1 + T_EPS;

/** Όλα τα t-breakpoints: άκρα hosts + ζεύγη τομών + {0,1}. */
export function collectBreakpoints(lines: readonly TopLine[]): number[] {
  const bps = new Set<number>([0, 1]);
  for (const l of lines) {
    bps.add(clamp01(l.t0));
    bps.add(clamp01(l.t1));
  }
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (Math.abs(a.b - b.b) < T_EPS) continue; // parallel
      const t = (b.a - a.a) / (a.b - b.b);
      const lo = Math.max(a.t0, b.t0);
      const hi = Math.min(a.t1, b.t1);
      if (t > lo + T_EPS && t < hi - T_EPS && t > T_EPS && t < 1 - T_EPS) bps.add(t);
    }
  }
  return [...bps].sort((x, y) => x - y);
}

/** Η γραμμή με το ΧΑΜΗΛΟΤΕΡΟ z στο t (lower-envelope winner). */
function lowestAt(lines: readonly TopLine[], t: number): TopLine {
  let best = lines[0];
  let bestZ = evalLine(best, t);
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!coversLine(l, t)) continue;
    const z = evalLine(l, t);
    if (z < bestZ - Z_EPS) {
      best = l;
      bestZ = z;
    }
  }
  return best;
}

/** Συγχώνευση συνεχόμενων collinear segments ίδιας πηγής/host. */
function mergeSegments(segs: readonly WallTopSegment[]): WallTopSegment[] {
  const out: WallTopSegment[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    const collinear =
      prev &&
      prev.source === s.source &&
      prev.hostId === s.hostId &&
      Math.abs(prev.z1mm - s.z0mm) < Z_EPS;
    if (collinear) {
      out[out.length - 1] = { ...prev, t1: s.t1, z1mm: s.z1mm };
    } else {
      out.push(s);
    }
  }
  return out;
}

/**
 * Resolver SSoT — επιστρέφει το πλήρες προφίλ κορυφής τοίχου.
 *
 * - Μη-`attached` topBinding → ένα segment [0,1] στο nominal top (back-compat
 *   με ίσιο τοίχο· single host οριζόντιος δίνει z0=z1).
 * - `attached` → lower-envelope όλων των hosts + της baseline (storey-ceiling).
 *   Ακάλυπτο μέρος → baseline. Host που λείπει → `missingHostIds` + fallback.
 */
export function resolveWallTopProfile(
  params: WallVerticalParams,
  ctx: WallVerticalContext,
): WallTopProfile {
  const baseZmm = resolveWallBaseZmm(params, ctx);
  const baselineZ = resolveWallNominalTopZmm(params, ctx);
  const baselineSrc = nominalSource(params, ctx);

  if (params.topBinding !== 'attached') {
    const seg: WallTopSegment = { t0: 0, t1: 1, z0mm: baselineZ, z1mm: baselineZ, source: baselineSrc };
    return { baseZmm, segments: [seg], maxTopZmm: baselineZ, minTopZmm: baselineZ, hasAttach: false, missingHostIds: [] };
  }

  // attached: μάζεψε host plans (κρατώντας τα missing).
  const ids = params.attachTopToIds ?? [];
  const missingHostIds: string[] = [];
  const lines: TopLine[] = [
    { a: baselineZ, b: 0, t0: 0, t1: 1, source: baselineSrc },
  ];
  for (const id of ids) {
    const h = ctx.resolveHost?.(id) ?? null;
    if (h) lines.push(lineFromHost(h));
    else missingHostIds.push(id);
  }

  const bps = collectBreakpoints(lines);
  const raw: WallTopSegment[] = [];
  for (let i = 0; i < bps.length - 1; i++) {
    const ta = bps[i];
    const tb = bps[i + 1];
    if (tb - ta < T_EPS) continue;
    const win = lowestAt(lines, (ta + tb) / 2);
    raw.push({ t0: ta, t1: tb, z0mm: evalLine(win, ta), z1mm: evalLine(win, tb), source: win.source, hostId: win.hostId });
  }

  const segments = mergeSegments(raw);
  let maxTopZmm = -Infinity;
  let minTopZmm = Infinity;
  for (const s of segments) {
    maxTopZmm = Math.max(maxTopZmm, s.z0mm, s.z1mm);
    minTopZmm = Math.min(minTopZmm, s.z0mm, s.z1mm);
  }
  const hasAttach = segments.some((s) => s.source === 'attached');
  return { baseZmm, segments, maxTopZmm, minTopZmm, hasAttach, missingHostIds };
}

/**
 * Αποτίμηση του top (absolute mm) ενός προφίλ στο `t` (0..1) κατά μήκος του
 * άξονα — γραμμική παρεμβολή z0→z1 εντός του segment που καλύπτει το `t`.
 * Χρήση: εγκάρσια τομή/grip/dimension που χρειάζεται single-point top.
 * SSoT helper πάνω στο `WallTopProfile` (μηδέν re-derive από params/hosts).
 */
export function evaluateWallTopAt(profile: WallTopProfile, t: number): number {
  const tc = clamp01(t);
  const segs = profile.segments;
  for (const s of segs) {
    if (tc >= s.t0 - T_EPS && tc <= s.t1 + T_EPS) {
      const span = s.t1 - s.t0;
      if (span < T_EPS) return s.z0mm;
      return s.z0mm + ((s.z1mm - s.z0mm) * (tc - s.t0)) / span;
    }
  }
  // Εκτός κάλυψης (δεν θα συμβεί — τα segments καλύπτουν [0,1]) → maxTop fallback.
  return profile.maxTopZmm;
}
