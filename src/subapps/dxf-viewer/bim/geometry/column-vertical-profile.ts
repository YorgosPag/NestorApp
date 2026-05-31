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

import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { ColumnBaseBinding, ColumnTopBinding } from '../types/bim-binding';
import type { HostFootprintInput, Pt2 } from './wall-host-plan-builder';

/** Όριο για να θεωρηθούν δύο Z τιμές ίσες (mm). */
export const COLUMN_Z_EPS = 1e-6;

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

// ─── Per-corner host face evaluation ─────────────────────────────────────────

/** Κάτω-παρειά host στο plan-point `pt` (απόλυτο mm), ή null αν δεν το καλύπτει. */
function hostUndersideAt(h: HostFootprintInput, pt: Pt2): number | null {
  if (h.footprint.length < 3) return null;
  if (!isPointInPolygon(pt, [...h.footprint])) return null;
  return h.undersideZmmAt ? h.undersideZmmAt(pt) : h.undersideZmm;
}

/** Άνω-παρειά host στο plan-point `pt` (απόλυτο mm), ή null αν δεν το καλύπτει / λείπει. */
function hostTopsideAt(h: HostFootprintInput, pt: Pt2): number | null {
  if (h.footprint.length < 3) return null;
  if (!isPointInPolygon(pt, [...h.footprint])) return null;
  if (h.topsideZmmAt) return h.topsideZmmAt(pt);
  return h.topsideZmm ?? null;
}

/** Resolve attach-host inputs ανά id, μαζεύοντας τα missing. */
function collectHosts(
  ids: readonly string[],
  resolve: ColumnVerticalContext['resolveHostInput'],
): { hosts: HostFootprintInput[]; missingHostIds: string[] } {
  const hosts: HostFootprintInput[] = [];
  const missingHostIds: string[] = [];
  for (const id of ids) {
    const h = resolve?.(id) ?? null;
    if (h) hosts.push(h);
    else missingHostIds.push(id);
  }
  return { hosts, missingHostIds };
}

// ─── Resolvers ───────────────────────────────────────────────────────────────

function flatTop(baseZmm: number, top: number, n: number, missing: string[]): ColumnTopProfile {
  const cornerTopZmm = new Array<number>(n).fill(top);
  return { baseZmm, cornerTopZmm, maxTopZmm: top, minTopZmm: top, hasAttach: false, missingHostIds: missing };
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
  const { hosts, missingHostIds } = collectHosts(ids, ctx.resolveHostInput);

  let hasAttach = false;
  const cornerTopZmm = footprint.map((pt) => {
    let top = nominalTop;
    for (const h of hosts) {
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
  const { hosts, missingHostIds } = collectHosts(ids, ctx.resolveHostInput);

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
 * ΕΝΑΣ τόπος για το `Map<id, HostFootprintInput>` που τρώει ο resolver.
 */
export function makeColumnHostResolver(
  hosts: readonly HostFootprintInput[],
): (id: string) => HostFootprintInput | null {
  const byId = new Map<string, HostFootprintInput>();
  for (const h of hosts) byId.set(h.hostId, h);
  return (id: string) => byId.get(id) ?? null;
}
