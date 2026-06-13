/**
 * Column Top/Base vertical-extent resolver (ADR-401 Phase F) — SSoT.
 *
 * ΕΝΑΣ pure resolver για το **κατακόρυφο εύρος** μιας BIM κολώνας, mirror του
 * `wall-top-profile.ts` / `wall-base-profile.ts`. Επειδή η κολώνα έχει **σημειακό
 * footprint** (μικρό πολύγωνο) και ΟΧΙ άξονα όπως ο τοίχος, το προφίλ δεν είναι
 * 1D κατά μήκος ενός `t` — αποτιμάται **ανά γωνία** του footprint:
 *
 *   - **top** (`topBinding='attached'`): για κάθε γωνία → η κάτω-παρειά κάθε host
 *     που την καλύπτει· κρατάμε το **ΧΑΜΗΛΟΤΕΡΟ** (lower-envelope) μαζί με το
 *     nominal ceiling → η κολώνα σταματά στο χαμηλότερο ταβάνι/δοκάρι (Revit
 *     «Attach Top», δεν διαπερνά).
 *   - **base** (`baseBinding='attached'`): για κάθε γωνία → η **άνω-παρειά** κάθε
 *     host που την καλύπτει· κρατάμε το **ΨΗΛΟΤΕΡΟ** (upper-envelope, bidirectional
 *     Revit «Attach Base»). Ακάλυπτη γωνία → nominal base.
 *
 * Όταν διαφορετικές γωνίες πέφτουν σε διαφορετικά / κεκλιμένα hosts → οι
 * `cornerTopZmm` διαφέρουν μεταξύ τους ⇒ **κεκλιμένη/στρεβλή κορυφή** (το
 * «σύνθετο profile» που ζήτησε ο Giorgio). Flat host → όλες οι γωνίες ίσες
 * (back-compat με ίσια κολώνα).
 *
 * REUSE (SSoT, N.0.2): καταναλώνει αυτούσια τα `HostFootprintInput` (footprint +
 * `undersideZmm`/`undersideZmmAt`/`topsideZmm`/`topsideZmmAt`) που παράγουν τα
 * entity adapters `beamHostInput`/`slabHostInput`/`buildWallHostInputs`
 * (`wall-host-plan-builder.ts`). Καμία διπλή formula κάτω/άνω-παρειάς.
 *
 * Convention μονάδων: footprint γωνίες + host footprints στο **ίδιο** plan space
 * (mm). Τα `z*mm` είναι απόλυτα mm από project origin (ADR-369 §2 datum). Ο
 * καλών παρέχει το `floorElevationMm` (FFL ορόφου).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase F)
 * @see bim/geometry/wall-top-profile.ts / wall-base-profile.ts — οι δίδυμοι του τοίχου
 * @see bim/geometry/wall-host-plan-builder.ts — HostFootprintInput + adapters
 */

import type { ColumnBaseBinding, ColumnTopBinding } from '../types/bim-binding';
import type { HostFootprintInput, Pt2 } from './wall-host-plan-builder';
import {
  HOST_Z_EPS,
  hostUndersideAt,
  hostTopsideAt,
  collectHostFootprints,
  makeHostFootprintResolver,
} from './host-footprint-eval';

/**
 * Όριο για να θεωρηθούν δύο Z τιμές ίσες (mm).
 * Boy-Scout N.0.2: re-export του shared `HOST_Z_EPS` (πρώην private copy) — οι
 * υπάρχοντες consumers (`column-structural-attach-coordinator`, `column-boq-feed`,
 * `BimSceneLayer`) συνεχίζουν να εισάγουν `COLUMN_Z_EPS` αμετάβλητα.
 */
export const COLUMN_Z_EPS = HOST_Z_EPS;

/** Δομικό υποσύνολο των ColumnParams που χρειάζεται ο resolver (ColumnParams assignable). */
export interface ColumnVerticalParams {
  readonly baseBinding: ColumnBaseBinding;
  readonly topBinding: ColumnTopBinding;
  readonly baseOffset: number;
  readonly topOffset: number;
  readonly height: number;
  readonly unconnectedHeight?: number;
  readonly attachTopToIds?: readonly string[];
  readonly attachBaseToIds?: readonly string[];
}

/** Context — όλα προαιρετικά πλην του FFL (mirror WallVerticalContext). */
export interface ColumnVerticalContext {
  /** FFL του ορόφου της κολώνας (απόλυτο mm, ADR-369 datum). */
  readonly floorElevationMm: number;
  /** FFL επόμενου ορόφου (απόλυτο mm) — για `storey-ceiling`. */
  readonly nextFloorElevationMm?: number;
  /** Πάχος πλάκας οροφής (mm) — `storey-ceiling` αφαιρεί την πλάκα. */
  readonly ceilingSlabThicknessMm?: number;
  /** Lookup host footprint-input ανά id (top + base attach). */
  readonly resolveHostInput?: (id: string) => HostFootprintInput | null;
}

/** Πλήρες προφίλ κορυφής κολώνας — per-corner. */
export interface ColumnTopProfile {
  /** Απόλυτο Z βάσης (mm) — scalar (base profile χωριστά). */
  readonly baseZmm: number;
  /** Top (απόλυτο mm) ανά γωνία footprint, ίδια σειρά με το footprint. */
  readonly cornerTopZmm: readonly number[];
  /** Ψηλότερο top (mm) — για bbox / 3D. */
  readonly maxTopZmm: number;
  /** Χαμηλότερο top (mm). */
  readonly minTopZmm: number;
  /** True αν τουλάχιστον μία γωνία πήρε top από host (κάτω από nominal). */
  readonly hasAttach: boolean;
  /** Hosts που ζητήθηκαν αλλά λείπουν (σβήστηκαν) → fallback + warning. */
  readonly missingHostIds: readonly string[];
}

/** Πλήρες προφίλ βάσης κολώνας — per-corner. */
export interface ColumnBaseProfile {
  /** Nominal (μη-attached) base (mm) — fallback όπου δεν υπάρχει host. */
  readonly nominalBaseZmm: number;
  /** Base (απόλυτο mm) ανά γωνία footprint, ίδια σειρά με το footprint. */
  readonly cornerBaseZmm: readonly number[];
  readonly maxBaseZmm: number;
  readonly minBaseZmm: number;
  readonly hasAttach: boolean;
  readonly missingHostIds: readonly string[];
}

// ─── Scalar base + nominal-top resolution (mirror wall) ──────────────────────

/**
 * Απόλυτο Z βάσης κολώνας (mm). `absolute` → `baseOffset` ως απόλυτο· αλλιώς
 * FFL ορόφου + offset (ADR-369 datum).
 */
export function resolveColumnBaseZmm(params: ColumnVerticalParams, ctx: ColumnVerticalContext): number {
  return params.baseBinding === 'absolute'
    ? params.baseOffset
    : ctx.floorElevationMm + params.baseOffset;
}

/**
 * Το «nominal» (μη-attached) top μιας κολώνας σε απόλυτο mm — η baseline κορυφή
 * όπου δεν υπάρχει host. Καλύπτει `storey-ceiling`(−πλάκα) / `absolute` /
 * `unconnected` / fallback. Mirror του `resolveWallNominalTopZmm`.
 */
export function resolveColumnNominalTopZmm(params: ColumnVerticalParams, ctx: ColumnVerticalContext): number {
  const baseZ = resolveColumnBaseZmm(params, ctx);
  if (params.topBinding === 'unconnected') {
    return baseZ + (params.unconnectedHeight ?? params.height);
  }
  if (params.topBinding === 'absolute') {
    return params.topOffset;
  }
  if (ctx.nextFloorElevationMm !== undefined) {
    return ctx.nextFloorElevationMm - (ctx.ceilingSlabThicknessMm ?? 0) + params.topOffset;
  }
  return baseZ + params.height;
}

// ─── Per-corner host face evaluation (shared SSoT, host-footprint-eval.ts) ────
// `hostUndersideAt` / `hostTopsideAt` / `collectHostFootprints` ζουν πλέον στο
// `host-footprint-eval.ts` (Boy-Scout N.0.2 — η σκάλα τα μοιράζεται). Imported άνω.

// ─── Resolvers ───────────────────────────────────────────────────────────────

function flatTop(baseZmm: number, top: number, n: number, missing: string[]): ColumnTopProfile {
  const cornerTopZmm = new Array<number>(n).fill(top);
  return { baseZmm, cornerTopZmm, maxTopZmm: top, minTopZmm: top, hasAttach: false, missingHostIds: missing };
}

/**
 * ADR-441/401 — διαχώρισε τους attached top-hosts:
 *   - **covering** (πλάκα/ταβάνι): ≥1 γωνία κολώνας πέφτει κάτω από την κάτω-παρειά
 *     → per-corner lower-envelope soffit (υπάρχουσα συμπεριφορά).
 *   - **framing** (δοκάρι frame-into): δεν καλύπτει καμία γωνία (κόπηκε στην παρειά)
 *     αλλά είναι attached → η κολώνα ανεβαίνει στην ΠΑΝΩ-παρειά του (flat beam-top).
 * Το binding (`attachTopToIds`) κωδικοποιεί την πρόθεση· εδώ απλώς ταξινομούμε με
 * βάση το αν ο host καλύπτει — μηδέν επιπλέον γεωμετρία (N.0.2).
 */
function classifyTopHosts(
  hosts: readonly HostFootprintInput[],
  footprint: readonly Pt2[],
): { framingTops: number[]; coveringHosts: HostFootprintInput[] } {
  const framingTops: number[] = [];
  const coveringHosts: HostFootprintInput[] = [];
  for (const h of hosts) {
    const covers = footprint.some((pt) => hostUndersideAt(h, pt) !== null);
    if (covers) coveringHosts.push(h);
    else if (h.topsideZmm !== undefined) framingTops.push(h.topsideZmm);
  }
  return { framingTops, coveringHosts };
}

/**
 * Resolver SSoT — top profile της κολώνας (lower-envelope ανά γωνία).
 * Μη-`attached` → επίπεδη κορυφή στο nominal top. `attached` → ανά γωνία το
 * χαμηλότερο μεταξύ {nominal, καλύπτουσες κάτω-παρειές}.
 */
export function resolveColumnTopProfile(
  params: ColumnVerticalParams,
  footprint: readonly Pt2[],
  ctx: ColumnVerticalContext,
): ColumnTopProfile {
  const baseZmm = resolveColumnBaseZmm(params, ctx);
  const nominalTop = resolveColumnNominalTopZmm(params, ctx);
  const ids = params.attachTopToIds ?? [];
  if (params.topBinding !== 'attached' || ids.length === 0) {
    return flatTop(baseZmm, nominalTop, footprint.length, []);
  }
  const { hosts, missingHostIds } = collectHostFootprints(ids, ctx.resolveHostInput);
  // ADR-441/401 — framing δοκάρια ανεβάζουν την κορυφή στο beam-top (flat,
  // associative)· covering πλάκες κλιπάρουν per-corner από κάτω. Χωρίς framing →
  // baseline = nominal (byte-for-byte η προηγούμενη συμπεριφορά).
  const { framingTops, coveringHosts } = classifyTopHosts(hosts, footprint);
  const baselineTop = framingTops.length > 0 ? Math.max(...framingTops) : nominalTop;

  let hasAttach = framingTops.length > 0;
  const cornerTopZmm = footprint.map((pt) => {
    let top = baselineTop;
    for (const h of coveringHosts) {
      const z = hostUndersideAt(h, pt);
      if (z !== null && z < top - COLUMN_Z_EPS) {
        top = z;
        hasAttach = true;
      }
    }
    return top;
  });

  return {
    baseZmm,
    cornerTopZmm,
    maxTopZmm: Math.max(...cornerTopZmm),
    minTopZmm: Math.min(...cornerTopZmm),
    hasAttach,
    missingHostIds,
  };
}

function flatBase(nominalBaseZmm: number, n: number, missing: string[]): ColumnBaseProfile {
  const cornerBaseZmm = new Array<number>(n).fill(nominalBaseZmm);
  return {
    nominalBaseZmm,
    cornerBaseZmm,
    maxBaseZmm: nominalBaseZmm,
    minBaseZmm: nominalBaseZmm,
    hasAttach: false,
    missingHostIds: missing,
  };
}

/**
 * Resolver SSoT — base profile της κολώνας (upper-envelope ανά γωνία,
 * bidirectional). Μη-`attached` → επίπεδη βάση στο nominal. `attached` → ανά
 * γωνία η ψηλότερη καλύπτουσα άνω-παρειά· ακάλυπτη γωνία → nominal base.
 */
export function resolveColumnBaseProfile(
  params: ColumnVerticalParams,
  footprint: readonly Pt2[],
  ctx: ColumnVerticalContext,
): ColumnBaseProfile {
  const nominalBaseZmm = resolveColumnBaseZmm(params, ctx);
  const ids = params.attachBaseToIds ?? [];
  if (params.baseBinding !== 'attached' || ids.length === 0) {
    return flatBase(nominalBaseZmm, footprint.length, []);
  }
  const { hosts, missingHostIds } = collectHostFootprints(ids, ctx.resolveHostInput);

  let hasAttach = false;
  const cornerBaseZmm = footprint.map((pt) => {
    let best: number | null = null;
    for (const h of hosts) {
      const z = hostTopsideAt(h, pt);
      if (z !== null && (best === null || z > best + COLUMN_Z_EPS)) best = z;
    }
    if (best === null) return nominalBaseZmm;
    hasAttach = true;
    return best;
  });

  return {
    nominalBaseZmm,
    cornerBaseZmm,
    maxBaseZmm: Math.max(...cornerBaseZmm),
    minBaseZmm: Math.min(...cornerBaseZmm),
    hasAttach,
    missingHostIds,
  };
}

/**
 * Convenience: lookup builder από host inputs (mirror `makeResolveHost`).
 * Boy-Scout N.0.2: thin alias του shared `makeHostFootprintResolver` — οι
 * υπάρχοντες consumers (`column-structural-attach-coordinator` κ.λπ.) εισάγουν
 * `makeColumnHostResolver` αμετάβλητα.
 */
export const makeColumnHostResolver = makeHostFootprintResolver;
