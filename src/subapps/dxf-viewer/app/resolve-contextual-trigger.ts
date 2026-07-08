/**
 * Selection-side contextual-tab resolver (ADR-587 Φ3a — entity-keyed trigger SSoT).
 *
 * Όταν επιλέγεται **ΜΙΑ** οντότητα, ποιο contextual ribbon tab ανοίγει; Η σχέση είναι
 * **entity-keyed** (μία επιλεγμένη οντότητα → ΕΝΑ tab, ADR-587 §5.1) — σε αντίθεση με το
 * tool/ribbon placement layer που είναι ToolType-keyed. Άρα είναι νόμιμο μέλος του
 * entity-descriptor domain.
 *
 * Πριν το Φ3a η αντιστοίχιση ήταν **23 πανομοιότυπα** `if (entity.type === 'x') return X`
 * μέσα στον `ribbon-contextual-config.ts` (shotgun surgery, ADR-587 §1). Εδώ γίνεται **ΕΝΑ
 * δηλωτικό map** `ENTITY_CONTEXTUAL_TRIGGER`, δεμένο στον descriptor domain
 * (`RENDERABLE_ENTITY_TYPES`) μέσω `__tests__/resolve-contextual-trigger-coverage.test.ts`
 * (mirror του `entity-descriptor-coverage.test.ts`): αν προστεθεί νέος renderable type και
 * ξεχαστεί εδώ, σπάει το build.
 *
 * ⚠️ Ο resolver ζει στο app/ribbon layer, ΟΧΙ ως πεδίο μέσα στο render-layer
 * `EntityTypeDescriptor` (`rendering/contract/`): τα trigger tokens είναι UI/ribbon
 * artifacts — φύτεμά τους στον render descriptor θα αντέστρεφε το layering (rendering→UI).
 * Η δέσμευση με τον descriptor domain γίνεται μέσω coverage, ακριβώς όπως το `category`
 * δένεται με τα `BIM_RENDERABLE_TYPES` χωρίς ο descriptor να «κατέχει» τη λίστα (ADR-587 §5.2).
 *
 * @see ADR-587 §5.1 (entity-keyed vs ToolType-keyed) · §5.2 (layering: registry ≠ render field)
 * @see resolve-contextual-trigger-coverage.test.ts — δένει το map με τα ζωντανά SSoT
 */

import type { EntityType } from '../types/base-entity';
import { TEXT_EDITOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-text-editor-tab';
import {
  ARRAY_RECT_CONTEXTUAL_TRIGGER,
  ARRAY_POLAR_CONTEXTUAL_TRIGGER,
  ARRAY_PATH_CONTEXTUAL_TRIGGER,
} from '../ui/ribbon/data/contextual-array-tab';
import { STAIR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-stair-tab';
import { WALL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-wall-tab';
import { OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-opening-tab';
import { SLAB_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-tab';
import { ROOF_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-roof-tab';
import { COLUMN_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-column-tab';
import { BEAM_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-beam-tab';
import { FOUNDATION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-foundation-tab';
import { SLAB_OPENING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-slab-opening-tab';
import { DIMENSION_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-dimension-tab';
import { LINE_TOOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-line-tool-tab';
import { MEP_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-fixture-tab';
import { MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-floor-drain-tab';
import { MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-sanitary-fixture-tab';
import { MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-appliance-fixture-tab';
import { MEP_SOCKET_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-socket-tab';
import { MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-data-outlet-tab';
import { MEP_MANIFOLD_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-manifold-tab';
import { DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-drainage-collector-tab';
import { MEP_RADIATOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-radiator-tab';
import { MEP_BOILER_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-boiler-tab';
import { MEP_WATER_HEATER_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-water-heater-tab';
import { MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-underfloor-tab';
import { FLOOR_FINISH_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-floor-finish-tab';
import { WALL_COVERING_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-wall-covering-tab';
import { HATCH_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-hatch-tab';
import { THERMAL_SPACE_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-thermal-space-tab';
import { MEP_SEGMENT_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-mep-segment-tab';
import { ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-electrical-panel-tab';
import { ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER } from '../ui/ribbon/data/contextual-annotation-symbol-tab';
import { isSanitaryKind } from '../bim/sanitary/sanitary-symbol-spec';
import { isApplianceKind } from '../bim/appliances/appliance-symbol-spec';
import { isSocketKind } from '../bim/mep-fixtures/socket-symbol-spec';
import { isDataOutletKind } from '../bim/mep-fixtures/data-outlet-symbol-spec';
import { isStyleEditablePrimitiveType } from '../types/style-editable-primitives';

export type EntityLike = { readonly type: string; readonly params?: unknown };

/**
 * Read a `kind` discriminator (string) from an entity's `params`, or `undefined`.
 * SSoT for every kind-driven contextual branch below — fixtures (floor-drain/appliance/
 * sanitary/…) and manifolds (drainage-collector/floor-manifold) and arrays (rect/polar/path)
 * all share this one reader instead of per-family twins (ADR-583 / N.18).
 */
function readParamsKind(params: unknown): string | undefined {
  if (params && typeof params === 'object' && 'kind' in params) {
    const k = (params as { kind?: unknown }).kind;
    return typeof k === 'string' ? k : undefined;
  }
  return undefined;
}

/**
 * Entity-keyed selection → contextual-tab trigger (ADR-587 Φ3a SSoT). ΜΟΝΟ οι τύποι που
 * αντιστοιχούν 1:1 σε **ΕΝΑ** trigger ανεξαρτήτως `params`. Οι τύποι με sub-discriminator
 * (`mep-fixture`/`mep-manifold`/`array` → params.kind) λύνονται ρητά στον resolver ΠΡΙΝ το
 * lookup· τα generic style-editable primitives (line/circle/…) μέσω του SSoT
 * `isStyleEditablePrimitiveType` fallback (κοινό με τον `useRibbonLineToolBridge`).
 *
 * Νέος renderable type με δικό του tab → **+1 γραμμή εδώ** (αντί edit στον resolver).
 * Το coverage test εγγυάται completeness.
 */
export const ENTITY_CONTEXTUAL_TRIGGER: Partial<Record<EntityType, string>> = {
  dimension: DIMENSION_CONTEXTUAL_TRIGGER,
  stair: STAIR_CONTEXTUAL_TRIGGER,
  wall: WALL_CONTEXTUAL_TRIGGER,
  opening: OPENING_CONTEXTUAL_TRIGGER,
  slab: SLAB_CONTEXTUAL_TRIGGER,
  // ADR-417 — κεκλιμένη στέγη (parametric roof) → contextual properties tab.
  roof: ROOF_CONTEXTUAL_TRIGGER,
  column: COLUMN_CONTEXTUAL_TRIGGER,
  beam: BEAM_CONTEXTUAL_TRIGGER,
  // ADR-436 — structural foundation (pad/strip/tie-beam) → contextual properties tab.
  foundation: FOUNDATION_CONTEXTUAL_TRIGGER,
  'slab-opening': SLAB_OPENING_CONTEXTUAL_TRIGGER,
  // ADR-408 Φ3/Φ6 — electrical panel → «Ιδιότητες Ηλεκτρικού Πίνακα» (own identity tab).
  'electrical-panel': ELECTRICAL_PANEL_CONTEXTUAL_TRIGGER,
  // ADR-408 Εύρος Β — καλοριφέρ (heating radiator, terminal) → «Ιδιότητες Καλοριφέρ».
  'mep-radiator': MEP_RADIATOR_CONTEXTUAL_TRIGGER,
  // ADR-408 Εύρος Β #2 — λέβητας (hydronic boiler, source) → «Ιδιότητες Λέβητα».
  'mep-boiler': MEP_BOILER_CONTEXTUAL_TRIGGER,
  // ADR-408 DHW — θερμοσίφωνας (domestic hot water heater) → «Ιδιότητες Θερμοσίφωνα».
  'mep-water-heater': MEP_WATER_HEATER_CONTEXTUAL_TRIGGER,
  // ADR-408 Εύρος Β #3 — ενδοδαπέδια (hydronic area terminal) → «Ιδιότητες Ενδοδαπέδιας».
  'mep-underfloor': MEP_UNDERFLOOR_CONTEXTUAL_TRIGGER,
  // ADR-419 — floor-finish (IfcCovering FLOORING) → «Ιδιότητες Επικάλυψης Δαπέδου».
  'floor-finish': FLOOR_FINISH_CONTEXTUAL_TRIGGER,
  // ADR-511 — wall-covering (IfcCovering CLADDING/INTERIOR) → «Ιδιότητες Φινιρίσματος Τοίχου».
  'wall-covering': WALL_COVERING_CONTEXTUAL_TRIGGER,
  // ADR-507 S2 — γραμμοσκίαση (hatch) → «Γραμμοσκίαση» tab.
  hatch: HATCH_CONTEXTUAL_TRIGGER,
  // ADR-422 — thermal-space (IfcSpace) → «Ιδιότητες Θερμικού Χώρου».
  'thermal-space': THERMAL_SPACE_CONTEXTUAL_TRIGGER,
  // ADR-408 Φ8 — σωλήνας / αεραγωγός (MEP segment, one tab for both domains).
  'mep-segment': MEP_SEGMENT_CONTEXTUAL_TRIGGER,
  // text/mtext → κοινός text editor tab.
  text: TEXT_EDITOR_CONTEXTUAL_TRIGGER,
  mtext: TEXT_EDITOR_CONTEXTUAL_TRIGGER,
  // ADR-583 — a selected North arrow surfaces the «Σύμβολο Βορρά» tab (dual mode: edit/place).
  'annotation-symbol': ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER,
};

/**
 * Ποιο contextual tab ανοίγει όταν επιλέγεται η δοσμένη οντότητα, ή `null` αν καμία (π.χ.
 * point/xline/railing/furniture — no per-selection editor tab).
 *
 * Σειρά: (1) οι kind-refined τύποι λύνονται ρητά ΠΡΩΤΑ (ένας τύπος → πολλά tabs μέσω
 * `params.kind`, δεν χωρά σε plain lookup) → (2) `ENTITY_CONTEXTUAL_TRIGGER` 1:1 map →
 * (3) generic style-editable primitives fallback. Τα type-equality branches είναι αμοιβαία
 * αποκλειόμενα, οπότε η σειρά είναι behavior-preserving.
 */
export function resolveContextualTrigger(entity: EntityLike): string | null {
  // ADR-406 / ADR-408 Φ14 — point-based MEP fixture. A floor-drain (σιφώνι) surfaces
  // «Ιδιότητες Σιφωνιού»· a light-fixture the «Ιδιότητες Φωτιστικού» tab. Both are
  // `mep-fixture` entities sharing one (kind-agnostic) bridge.
  if (entity.type === 'mep-fixture') {
    const fixtureKind = readParamsKind(entity.params);
    if (fixtureKind === 'floor-drain') return MEP_FLOOR_DRAIN_CONTEXTUAL_TRIGGER;
    // ADR-408 Δρόμος B — an appliance (washing machine, …) surfaces «Ιδιότητες Συσκευής»
    // (checked BEFORE sanitary: distinct family, same kind-agnostic bridge).
    if (fixtureKind && isApplianceKind(fixtureKind)) return MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER;
    // ADR-408 Φ14 — a sanitary terminal (WC/basin/…) surfaces «Ιδιότητες Είδους Υγιεινής».
    if (fixtureKind && isSanitaryKind(fixtureKind)) return MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER;
    // ADR-430/431 — a power socket / data outlet surfaces its «Ιδιότητες Πρίζας(/Δικτύου)» tab,
    // checked BEFORE the light-fixture default so an electrical device never mislabels.
    if (fixtureKind && isSocketKind(fixtureKind)) return MEP_SOCKET_CONTEXTUAL_TRIGGER;
    if (fixtureKind && isDataOutletKind(fixtureKind)) return MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER;
    return MEP_FIXTURE_CONTEXTUAL_TRIGGER;
  }
  // ADR-408 Φ12 / Φ14 — point-based manifold. A drainage-collector (φρεάτιο) surfaces
  // «Ιδιότητες Φρεατίου»· a floor-manifold the water «Ιδιότητες Συλλέκτη».
  if (entity.type === 'mep-manifold') {
    return readParamsKind(entity.params) === 'drainage-collector'
      ? DRAINAGE_COLLECTOR_CONTEXTUAL_TRIGGER
      : MEP_MANIFOLD_CONTEXTUAL_TRIGGER;
  }
  if (entity.type === 'array') {
    const kind = readParamsKind(entity.params);
    if (kind === 'polar') return ARRAY_POLAR_CONTEXTUAL_TRIGGER;
    if (kind === 'path') return ARRAY_PATH_CONTEXTUAL_TRIGGER;
    return ARRAY_RECT_CONTEXTUAL_TRIGGER;
  }
  // 1:1 entity-type → contextual trigger (SSoT map — αντικαθιστά 23 πανομοιότυπα branches).
  const direct = ENTITY_CONTEXTUAL_TRIGGER[entity.type as EntityType];
  if (direct) return direct;
  // ADR-510 Φ2E — μια επιλεγμένη «καθαρή» γεωμετρική οντότητα (γραμμή/πολυγραμμή/κύκλος/
  // τόξο/έλλειψη/spline/ορθογώνιο) εμφανίζει το ΙΔΙΟ Line-Tool style tab με τη σχεδίαση
  // (mirror hatch: ΕΝΑ trigger, δύο modes). Ο `useRibbonLineToolBridge` διακρίνει
  // selected-edit vs draw-defaults μέσω του ίδιου SSoT predicate.
  if (isStyleEditablePrimitiveType(entity.type)) return LINE_TOOL_CONTEXTUAL_TRIGGER;
  return null;
}
