/**
 * ADR-587 Φ2b — Coverage test: tool → entity back-link (`createsEntityType`).
 *
 * Δένει το δηλωτικό tool→entity SSoT (`TOOL_CREATES_ENTITY`) με τον ζωντανό domain
 * (`RENDERABLE_ENTITY_TYPES`) + τη derivation στο `ToolInfo.createsEntityType`:
 *   1. **Validity** — κάθε τιμή του χάρτη είναι έγκυρος `RenderableEntityType`.
 *   2. **Key validity** — κάθε key είναι υπαρκτό `ToolType` (εμφανίζεται στο `TOOL_DEFINITIONS`).
 *   3. **Derivation (no-drift)** — `TOOL_DEFINITIONS[t].createsEntityType` ≡ `TOOL_CREATES_ENTITY[t]`
 *      για κάθε mapped tool, και **undefined** για κάθε non-mapped tool (η DERIVED σχέση
 *      δεν μπορεί να αποκλίνει — mirror του Φ2 `dxfExportType`).
 *   4. **§5.1 fan-out golden pins** — «μία οντότητα ⇐ πολλά tools» (wall/column/foundation/
 *      mep-fixture/mep-segment families) + tool-id ≠ entity-type cases (north-arrow,
 *      drainage-collector, comms-rack).
 *   5. **Deliberate absences** — editing/measurement/guide/dim/finish-paint tools ΔΕΝ έχουν
 *      back-link (τεκμηριωμένο, όχι κενό).
 *   6. **Entity-side gaps** — `thermal-space` / `space-separator` (non-`ToolType` creation
 *      paths) καρφώνονται ως γνωστά κενά.
 *
 * Σπάει αν κάποιος γράψει λάθος entity type, ξεχάσει να καταχωρήσει tool ως entity type,
 * ή αν η derivation χαλάσει.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

import { TOOL_DEFINITIONS, TOOL_CREATES_ENTITY } from '../tool-definitions';
import type { ToolType } from '../../../ui/toolbar/types';
import {
  RENDERABLE_ENTITY_TYPES,
  type RenderableEntityType,
} from '../../../rendering/contract/renderable-entity-type';

const RENDERABLE_SET = new Set<string>(RENDERABLE_ENTITY_TYPES);
const MAPPED_TOOLS = Object.keys(TOOL_CREATES_ENTITY) as ToolType[];

describe('TOOL_CREATES_ENTITY — validity', () => {
  it('every mapped entity type is a valid RenderableEntityType', () => {
    const invalid = Object.entries(TOOL_CREATES_ENTITY)
      .filter(([, entityType]) => !RENDERABLE_SET.has(entityType as string));
    // Report the offending tool→type pairs on failure, not a bare `false`.
    expect(invalid).toEqual([]);
  });

  it('every mapped tool id is a real ToolType present in TOOL_DEFINITIONS', () => {
    for (const tool of MAPPED_TOOLS) {
      expect(TOOL_DEFINITIONS[tool]).toBeDefined();
      expect(TOOL_DEFINITIONS[tool].id).toBe(tool);
    }
  });
});

describe('TOOL_CREATES_ENTITY — derivation onto ToolInfo (no-drift)', () => {
  it('ToolInfo.createsEntityType is derived verbatim for every mapped tool', () => {
    for (const tool of MAPPED_TOOLS) {
      expect(TOOL_DEFINITIONS[tool].createsEntityType).toBe(TOOL_CREATES_ENTITY[tool]);
    }
  });

  it('non-mapped tools carry no back-link (createsEntityType undefined)', () => {
    const mapped = new Set<string>(MAPPED_TOOLS);
    for (const tool of Object.keys(TOOL_DEFINITIONS) as ToolType[]) {
      if (mapped.has(tool)) continue;
      expect(TOOL_DEFINITIONS[tool].createsEntityType).toBeUndefined();
    }
  });
});

describe('TOOL_CREATES_ENTITY — §5.1 fan-out (one entity ⇐ many tools)', () => {
  const expectAll = (tools: readonly string[], entityType: RenderableEntityType): void => {
    for (const t of tools) {
      expect(TOOL_CREATES_ENTITY[t as ToolType]).toBe(entityType);
    }
  };

  it('all 6 wall tools → wall', () => {
    expectAll(
      ['wall', 'wall-on-entity', 'wall-region-lines', 'wall-region-inside',
        'wall-region-box', 'wall-from-perimeter'],
      'wall',
    );
  });

  it('all 8 column tools → column', () => {
    expectAll(
      ['column', 'column-from-perimeter', 'column-discrete-from-perimeter',
        'column-discrete-from-perimeter-walls', 'column-region-lines',
        'column-region-inside', 'column-region-box', 'column-from-polygon'],
      'column',
    );
  });

  it('all 4 foundation tools → foundation', () => {
    expectAll(
      ['foundation-pad', 'foundation-strip', 'foundation-tie-beam', 'foundation-strip-from-wall'],
      'foundation',
    );
  });

  it('all 16 mep fixture tools → mep-fixture', () => {
    expectAll(
      ['mep-fixture', 'mep-socket', 'mep-data-outlet', 'mep-air-terminal', 'mep-ahu',
        'mep-sprinkler', 'mep-fire-riser', 'mep-gas-meter', 'mep-gas-cooker', 'mep-floor-drain',
        'mep-wc', 'mep-washbasin', 'mep-shower', 'mep-bathtub', 'mep-bidet', 'mep-washing-machine'],
      'mep-fixture',
    );
  });

  it('all 4 linear mep segment tools → mep-segment', () => {
    expectAll(['mep-duct', 'mep-pipe', 'mep-drain-pipe', 'mep-drain-riser'], 'mep-segment');
  });

  it('tool-id ≠ entity-type cases resolve to the verified target', () => {
    expect(TOOL_CREATES_ENTITY['north-arrow']).toBe('annotation-symbol');
    expect(TOOL_CREATES_ENTITY['mep-drainage-collector']).toBe('mep-manifold');
    expect(TOOL_CREATES_ENTITY['mep-comms-rack']).toBe('electrical-panel');
    expect(TOOL_CREATES_ENTITY['mtext']).toBe('mtext');
  });
});

describe('TOOL_CREATES_ENTITY — deliberate absences (documented, not gaps)', () => {
  it('editing / selection / measurement / guide / dim / finish-paint tools have no back-link', () => {
    for (const t of ['move', 'rotate', 'copy', 'select', 'measure-distance', 'measure-area',
      'guide-x', 'guide-grid', 'dim-linear', 'auto-dim-cutline', 'finish-paint', 'ellipse'] as ToolType[]) {
      expect(TOOL_CREATES_ENTITY[t]).toBeUndefined();
      expect(TOOL_DEFINITIONS[t].createsEntityType).toBeUndefined();
    }
  });
});

describe('TOOL_CREATES_ENTITY — entity-side gaps (pinned known holes)', () => {
  it('thermal-space & space-separator have NO ToolType back-link (created via non-ToolType hooks)', () => {
    const produced = new Set<string>(Object.values(TOOL_CREATES_ENTITY));
    // Both are RenderableEntityTypes…
    expect(RENDERABLE_SET.has('thermal-space')).toBe(true);
    expect(RENDERABLE_SET.has('space-separator')).toBe(true);
    // …yet no tool in the ToolType-keyed registry authors them (documented in the map's JSDoc).
    expect(produced.has('thermal-space')).toBe(false);
    expect(produced.has('space-separator')).toBe(false);
  });

  it('floorplan-symbol is a surfaced asymmetry: tool exists but its type is absent from RENDERABLE (ADR-550 follow-up)', () => {
    // The `floorplan-symbol` tool IS a real ToolType that authors `type:'floorplan-symbol'`…
    expect(TOOL_DEFINITIONS['floorplan-symbol']).toBeDefined();
    // …but that entity type is NOT in the ADR-550 renderable SSoT (rendered via the entity-model
    // path, not EntityRendererComposite). So it is deliberately excluded from the back-link map
    // until ADR-550 registers it. Fixing it here would ripple into the render-coverage contract.
    expect(RENDERABLE_SET.has('floorplan-symbol')).toBe(false);
    expect(TOOL_CREATES_ENTITY['floorplan-symbol']).toBeUndefined();
    expect(TOOL_DEFINITIONS['floorplan-symbol'].createsEntityType).toBeUndefined();
  });
});
