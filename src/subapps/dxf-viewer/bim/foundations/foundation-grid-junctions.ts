/**
 * ADR-441 Slice 8 — Revit-grade auto-junction-join (γωνίες/κόμβοι εσχάρας).
 *
 * Οι λωρίδες είναι intersection-to-intersection με άκρα ΑΚΡΙΒΩΣ στους άξονες. Η γωνία
 * κλείνει σήμερα ΜΟΝΟ χάρη στην παραδοχή «περιμετρική=inward» (Slice 5a-grid): τα δύο
 * inward footprints μοιράζονται το γωνιακό τετράγωνο. Μόλις ο μηχανικός γυρίσει μια
 * περιμετρική **outward** (χειροκίνητη έδραση), το footprint της βγαίνει εκτός και η
 * κάθετη φτάνει μόνο μέχρι τον άξονα → **ακάλυπτο γωνιακό τετράγωνο** (κενό).
 *
 * Revit/Tekla way = **auto-join στους κόμβους**: κάθε άκρο λωρίδας **προεκτείνεται**
 * κατά μήκος του άξονά της μέχρι την **ΑΠΕΝΑΝΤΙ (μακρινή) παρειά** των κάθετων λωρίδων
 * στον κόμβο (miter / extend-to-join), clamp ≥0. Inward → far face = ο άξονας → extend=0
 * (μηδέν regression). Outward → far face = έξω → η κάθετη επεκτείνεται όσο χρειάζεται →
 * γωνία κλείνει, μηδέν νέο overhang πέρα από εκεί που ήδη έφτασε η flipped.
 *
 * Justification-agnostic: διαβάζει την **πραγματική** παρειά κάθε κάθετης από το
 * `geometry.bbox` → δουλεύει για ΟΠΟΙΑΔΗΠΟΤΕ έδραση (incl. χειροκίνητη). Το miter
 * ζει ως `GuideBinding.extend` (mm, signed) → follow-move-safe (το honor-άρει το
 * `deriveFoundationParamsFromGuides`) + persist-free (bindings round-trip) + αυτόματα
 * σωστό σε render 2D/3D + BOQ (όλα διαβάζουν το `geometry.footprint`).
 *
 * Idempotent: 2η κλήση με ίδιο σύνολο → μηδέν αλλαγή (επιστρέφει []). Pure.
 *
 * @see ./foundation-grid-rehost.ts — RehostedStrip (apply update path, ίδιο command)
 * @see ../hosting/derive-params-from-guides.ts — honor extend στο follow-move
 * @see ../geometry/foundation-geometry.ts — geometry re-derive (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { mmScaleFor } from '../../utils/scene-units';
import { hasGuideBindings, type GuideBinding, type GuideBindingSlot } from '../hosting/guide-binding-types';
import type { FoundationEntity, StripFootingParams, TieBeamParams } from '../types/foundation-types';
import type { RehostedStrip } from './foundation-grid-rehost';

type LineParams = StripFootingParams | TieBeamParams;

/** Κλάσμα του πλάτους εντός του οποίου ένα coordinate θεωρείται «πάνω» σε κόμβο. */
const NODE_TOL_FRACTION = 0.05;
/** Κάτω από αυτό (mm) το extend θεωρείται αμετάβλητο (float-noise / no-op). */
const EXTEND_EPS_MM = 1e-3;

/** Άκρο μήκους μιας λωρίδας: slot + bare coord (άξονας, χωρίς το extend του). */
interface EndPoint {
  readonly slot: GuideBindingSlot;
  readonly bare: number;
}

/** Προ-υπολογισμένη γεωμετρία λωρίδας για το junction matching (scene units). */
interface StripInfo {
  readonly entity: FoundationEntity;
  readonly params: LineParams;
  readonly vertical: boolean;
  readonly scale: number;
  /** Σταθερός άξονας: x (κατακόρυφη) ή y (οριζόντια). */
  readonly parallel: number;
  /** Παρειές footprint κατά τον άξονα ΠΛΑΤΟΥΣ (X για V, Y για H). */
  readonly bandLo: number;
  readonly bandHi: number;
  /** Bare εύρος σώματος κατά τον άξονα ΜΗΚΟΥΣ. */
  readonly bodyLo: number;
  readonly bodyHi: number;
  readonly startEnd: EndPoint;
  readonly endEnd: EndPoint;
  readonly nodeTol: number;
}

/** Τιμή extend (mm) του binding ενός slot, ή 0. */
function slotExtendMm(bindings: readonly GuideBinding[], slot: GuideBindingSlot): number {
  return bindings.find((b) => b.slot === slot)?.extend ?? 0;
}

/** Προ-υπολογισμός `StripInfo` (null για pad / μη grid-managed). */
function buildStripInfo(entity: FoundationEntity): StripInfo | null {
  if (!hasGuideBindings(entity)) return null;
  const p = entity.params;
  if (p.kind !== 'strip' && p.kind !== 'tie-beam') return null;
  const b = entity.guideBindings;
  const scale = mmScaleFor(p);
  const bb = entity.geometry.bbox;
  const vertical = Math.abs(p.start.x - p.end.x) <= Math.abs(p.start.y - p.end.y);
  const nodeTol = NODE_TOL_FRACTION * p.width * scale;
  const lengthEnds = (sSlot: GuideBindingSlot, eSlot: GuideBindingSlot, s: number, e: number): readonly [EndPoint, EndPoint] => [
    { slot: sSlot, bare: s - slotExtendMm(b, sSlot) * scale },
    { slot: eSlot, bare: e - slotExtendMm(b, eSlot) * scale },
  ];
  const [startEnd, endEnd] = vertical
    ? lengthEnds('start-y', 'end-y', p.start.y, p.end.y)
    : lengthEnds('start-x', 'end-x', p.start.x, p.end.x);
  return {
    entity, params: p, vertical, scale, nodeTol,
    parallel: vertical ? p.start.x : p.start.y,
    bandLo: vertical ? bb.min.x : bb.min.y,
    bandHi: vertical ? bb.max.x : bb.max.y,
    bodyLo: Math.min(startEnd.bare, endEnd.bare),
    bodyHi: Math.max(startEnd.bare, endEnd.bare),
    startEnd, endEnd,
  };
}

/** Κάθετες λωρίδες στον κόμβο (parallel axis ≈ ep.bare ΚΑΙ body καλύπτει το s.parallel). */
function perpsAtNode(s: StripInfo, epBare: number, perps: readonly StripInfo[]): StripInfo[] {
  return perps.filter(
    (h) =>
      Math.abs(h.parallel - epBare) <= s.nodeTol &&
      s.parallel >= h.bodyLo - h.nodeTol &&
      s.parallel <= h.bodyHi + h.nodeTol,
  );
}

/**
 * Συνεχίζει η ίδια grid-γραμμή πέρα από αυτό το άκρο; (collinear segment στον ίδιο
 * άξονα, στην κατεύθυνση επέκτασης). Αν ναι → ΕΣΩΤΕΡΙΚΟΣ κόμβος → ΚΑΝΕΝΑ miter (το
 * node καλύπτεται ήδη από τη συνέχεια + τις κάθετες). Miter μόνο σε **termini**
 * (περιμετρικά άκρα / άκρα γραμμής) — εκεί ανοίγουν τα κενά σε outward έδραση.
 */
function continuesBeyond(s: StripInfo, ep: EndPoint, high: boolean, sames: readonly StripInfo[]): boolean {
  const probe = ep.bare + (high ? 1 : -1) * s.nodeTol * 2;
  return sames.some(
    (o) =>
      o.entity.id !== s.entity.id &&
      Math.abs(o.parallel - s.parallel) <= s.nodeTol &&
      o.bodyLo - s.nodeTol <= probe &&
      probe <= o.bodyHi + s.nodeTol,
  );
}

/** Νέο coord + signed extend (mm) ενός άκρου, με miter στη μακρινή παρειά. */
function endpointResult(
  s: StripInfo, ep: EndPoint, high: boolean, perps: readonly StripInfo[], sames: readonly StripInfo[],
): { readonly coord: number; readonly extMm: number } {
  const atNode = perpsAtNode(s, ep.bare, perps);
  if (atNode.length === 0 || continuesBeyond(s, ep, high, sames)) {
    return { coord: ep.bare, extMm: 0 };
  }
  const extScene = high
    ? Math.max(0, Math.max(...atNode.map((h) => h.bandHi)) - ep.bare)
    : Math.max(0, ep.bare - Math.min(...atNode.map((h) => h.bandLo)));
  return {
    coord: high ? ep.bare + extScene : ep.bare - extScene,
    extMm: (high ? extScene : -extScene) / s.scale,
  };
}

/** Binding με νέα τιμή extend (αφαιρεί το πεδίο όταν ~0 → Firestore-clean). */
function withExtend(b: GuideBinding, extMm: number): GuideBinding {
  if (Math.abs(extMm) < EXTEND_EPS_MM) {
    const { extend: _drop, ...rest } = b;
    return rest;
  }
  return { ...b, extend: extMm };
}

/** Νέα params με τα length coords των δύο άκρων ενημερωμένα. */
function setLengthCoords(s: StripInfo, startCoord: number, endCoord: number): LineParams {
  const p = s.params;
  return s.vertical
    ? { ...p, start: { ...p.start, y: startCoord }, end: { ...p.end, y: endCoord } }
    : { ...p, start: { ...p.start, x: startCoord }, end: { ...p.end, x: endCoord } };
}

/** RehostedStrip αν άλλαξε κάποιο extend, αλλιώς null (idempotent). */
function junctionForStrip(s: StripInfo, perps: readonly StripInfo[], sames: readonly StripInfo[]): RehostedStrip | null {
  const startHigh = s.startEnd.bare >= s.endEnd.bare;
  const startRes = endpointResult(s, s.startEnd, startHigh, perps, sames);
  const endRes = endpointResult(s, s.endEnd, !startHigh, perps, sames);
  const b = s.entity.guideBindings ?? [];
  if (
    Math.abs(startRes.extMm - slotExtendMm(b, s.startEnd.slot)) < EXTEND_EPS_MM &&
    Math.abs(endRes.extMm - slotExtendMm(b, s.endEnd.slot)) < EXTEND_EPS_MM
  ) {
    return null;
  }
  const bindings = b.map((bind) =>
    bind.slot === s.startEnd.slot ? withExtend(bind, startRes.extMm)
    : bind.slot === s.endEnd.slot ? withExtend(bind, endRes.extMm)
    : bind,
  );
  const params = setLengthCoords(s, startRes.coord, endRes.coord);
  return {
    original: s.entity,
    rehosted: { ...s.entity, params, guideBindings: bindings, geometry: computeFoundationGeometry(params) },
  };
}

/**
 * Υπολογίζει τα junction-miter extends ΟΛΩΝ των grid line-λωρίδων ώστε κάθε γωνία/
 * διασταύρωση να κλείνει για όποια έδραση. Επιστρέφει `{original, rehosted}` ΜΟΝΟ για
 * όσες άλλαξε το extend (idempotent· inward → []). Pure — καμία scene mutation.
 */
export function computeGridJunctionExtends(strips: readonly FoundationEntity[]): RehostedStrip[] {
  const infos = strips.map(buildStripInfo).filter((x): x is StripInfo => x !== null);
  const vs = infos.filter((i) => i.vertical);
  const hs = infos.filter((i) => !i.vertical);
  const out: RehostedStrip[] = [];
  for (const s of infos) {
    const r = junctionForStrip(s, s.vertical ? hs : vs, s.vertical ? vs : hs);
    if (r) out.push(r);
  }
  return out;
}
