/**
 * Entity Type Descriptor Registry (ADR-587 Φ1 — declarative foundation).
 *
 * ΕΝΑ descriptor ανά renderable entity type — το «home» απ' όπου κάθε υποσύστημα
 * θα διαβάζει «τι είναι αυτή η οντότητα», αντί για ~40 διάσπαρτα `switch (entity.type)`
 * (shotgun surgery, ADR-583 §5). **Επέκταση** του `ENTITY_RENDER_CONTRACTS` (ADR-550),
 * ΟΧΙ παράλληλο registry.
 *
 * Big-player-faithful (Maxon C4D / Revit / Figma, βλ. ADR-587 §2): δηλωτικό registry
 * που δείχνει ΠΟΙΟΣ dispatcher κατέχει κάθε επιφάνεια· τα βαριά engine passes μένουν
 * κεντρικά. Φ1 = μόνο τα ασφαλή δηλωτικά (`category` + το υπάρχον render contract),
 * **μηδέν αλλαγή συμπεριφοράς**. Οι executable capabilities (`toDxf`/`bounds`/`rotate`/
 * `grips`/…) προστίθενται ως optional fields σε επόμενες φάσεις (ADR-587 §5), δεμένες με
 * coverage tests όπως το `entity-render-coverage.test.ts`.
 *
 * Εύρος Φ1 = `RenderableEntityType` (το domain του contract). Οι editor-only τύποι
 * (`block`/`leader`/`array`/`group`/`center-mark`/`centerline`) εντάσσονται σε επόμενη
 * φάση καθώς διευρύνεται το registry προς όλο το `EntityType`.
 *
 * @see ADR-587 — design + phased roadmap
 * @see entity-render-contract.ts — το render contract που ενσωματώνεται (SSoT surfaces)
 * @see __tests__/entity-descriptor-coverage.test.ts — δένει το δηλωτικό με τα ζωντανά SSoT
 */

import {
  ENTITY_RENDER_CONTRACTS,
  type EntityRenderContract,
} from './entity-render-contract';
import {
  BIM_RENDERABLE_TYPES,
  RENDERABLE_ENTITY_TYPES,
  type RenderableEntityType,
} from './renderable-entity-type';
import {
  ENTITY_TYPE_MAPPING,
  type EzdxfEntityType,
} from '../../types/dxf-export.types';
import { DXF_WRAPPED_SUBENTITY_FIELD } from '../../canvas-v2/dxf-canvas/dxf-types';

/** Wider-key view του wrapped-field map ώστε να δεικτοδοτείται με οποιονδήποτε type string. */
const WRAPPED_FIELD_BY_TYPE = DXF_WRAPPED_SUBENTITY_FIELD as Partial<Record<string, string>>;

/**
 * Σημασιολογική κατηγορία οντότητας:
 *  - `dxf-primitive` : CAD primitive (line/circle/arc/…) — 2D underlay.
 *  - `bim`           : παραμετρικό μοντέλο (wall/column/slab/…) — 2D κάτοψη ± 3D solid.
 *  - `annotation`    : σχεδιαστική σημείωση (Βορράς/κλίμακα/σήμα τομής, ADR-583) —
 *                      lightweight non-BIM paper decoration.
 */
export type EntityCategory = 'dxf-primitive' | 'bim' | 'annotation';

/**
 * Annotation renderable types (ADR-583) — non-BIM paper decorations. Ζουν στη λίστα
 * `DXF_RENDERABLE_TYPES` (ρέουν στο generic scene array σαν DXF primitives), αλλά είναι
 * σημασιολογικά ξεχωριστά (καμία δομική σημασία). Νέο annotation kind → +1 γραμμή εδώ.
 */
export const ANNOTATION_RENDERABLE_TYPES: readonly RenderableEntityType[] = [
  'annotation-symbol',
];

const BIM_TYPE_SET: ReadonlySet<string> = new Set(BIM_RENDERABLE_TYPES);
const ANNOTATION_TYPE_SET: ReadonlySet<string> = new Set(ANNOTATION_RENDERABLE_TYPES);

/**
 * Η σημασιολογική κατηγορία ενός renderable type — DERIVED από τα υπάρχοντα render-type
 * SSoT lists (`BIM_RENDERABLE_TYPES` + `ANNOTATION_RENDERABLE_TYPES`). Μηδέν νέο
 * hand-maintained mapping. Το coverage test εγγυάται συνέπεια.
 */
export function entityCategoryOf(type: RenderableEntityType): EntityCategory {
  if (BIM_TYPE_SET.has(type)) return 'bim';
  if (ANNOTATION_TYPE_SET.has(type)) return 'annotation';
  return 'dxf-primitive';
}

/**
 * Το descriptor μιας οντότητας. Δηλωτικό (data-only) — απορροφά **entity-keyed** SSoT
 * facts. Οι executable capabilities (toDxf/bounds/grips/…) προστίθενται ως optional fields
 * σε επόμενες φάσεις (ADR-587 §4-5).
 *
 * ⚠️ Σκόπιμα ΔΕΝ περιέχει tool/ribbon πεδία: το placement/ribbon layer είναι **ToolType-keyed**
 * (μία οντότητα → ΠΟΛΛΑ tools· π.χ. `wall` → 6 tools, `mep-fixture` → ~15). Αυτό ζει σωστά στο
 * `TOOL_DEFINITIONS` (SSoT tool lifecycle)· ο σύνδεσμος tool→οντότητα ανήκει εκεί ως
 * `createsEntityType` back-reference (ADR-587 §5, δική του φάση), ΟΧΙ ως πεδίο εδώ.
 */
export interface EntityTypeDescriptor {
  /** Canonical key. */
  readonly type: RenderableEntityType;
  /** Σημασιολογική κατηγορία (αντικαθιστά εννοιολογικά το OR-chain `isBimEntityType`). */
  readonly category: EntityCategory;
  /** Το ΥΠΑΡΧΟΝ render contract (d2/d3/d3Builder/placementGhost3D) — ενσωματωμένο, μία πηγή. */
  readonly render: EntityRenderContract;
  /**
   * DXF native export type (ADR-587 Φ2 — απορρόφηση του `ENTITY_TYPE_MAPPING`). `null` =
   * δεν εξάγεται ως native DXF entity (BIM/annotation → composite export· internal → skip).
   * DERIVED από το `ENTITY_TYPE_MAPPING`, μηδέν αντίγραφο.
   */
  readonly dxfExportType: EzdxfEntityType | null;
  /**
   * Nested sub-entity field name στο `DxfEntityUnion` (ADR-587 Φ2c — απορρόφηση του
   * `DXF_WRAPPED_SUBENTITY_FIELD`). Παρόν μόνο για τα 5 wrapped variants (slab/slab-opening/
   * opening/stair/dimension)· `undefined` για τα ~30 direct. DERIVED, μηδέν αντίγραφο.
   */
  readonly dxfWrappedField?: string;
}

/**
 * Το μητρώο. **DERIVED** από το `ENTITY_RENDER_CONTRACTS` + `entityCategoryOf` — καμία
 * χειροκίνητη διπλοεγγραφή. `Record<RenderableEntityType, …>` → completeness σε compile-time.
 */
export const ENTITY_DESCRIPTORS: Readonly<
  Record<RenderableEntityType, EntityTypeDescriptor>
> = Object.fromEntries(
  RENDERABLE_ENTITY_TYPES.map((type) => [
    type,
    {
      type,
      category: entityCategoryOf(type),
      render: ENTITY_RENDER_CONTRACTS[type],
      dxfExportType: ENTITY_TYPE_MAPPING[type],
      dxfWrappedField: WRAPPED_FIELD_BY_TYPE[type],
    } satisfies EntityTypeDescriptor,
  ]),
) as Record<RenderableEntityType, EntityTypeDescriptor>;

/** Το descriptor ενός renderable type (SSoT lookup· αντικαθιστά σκόρπια `switch (type)`). */
export function descriptorOf(type: RenderableEntityType): EntityTypeDescriptor {
  return ENTITY_DESCRIPTORS[type];
}
