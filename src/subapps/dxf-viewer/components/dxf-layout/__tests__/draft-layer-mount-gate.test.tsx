/**
 * @jest-environment jsdom
 *
 * ADR-732 §3 — unmount-when-empty του LayerCanvas (outer gate / inner canvas).
 *
 * Συμπεριφορικοί έλεγχοι του `DraftLayerSubscriber`: το predicate είναι δικά του tests
 * (`canvas-v2/layer-canvas/__tests__/layer-canvas-content.test.ts`)· ΕΔΩ ελέγχεται ότι
 * η απόφαση καταλήγει σε ΠΡΑΓΜΑΤΙΚΟ mount/unmount του canvas element, και ειδικά ότι
 * η marquee σε ΑΔΕΙΟ σχέδιο mount-άρει ΜΕΣΑ στη χειρονομία (το σενάριο που θα έκοβε
 * ορατά pixels αν η πύλη κοιτούσε μόνο `colorLayers.length`).
 */

import React from 'react';
import { render, act } from '@testing-library/react';

// Ο πραγματικός LayerCanvas στήνει LayerRenderer + 2D context (ανύπαρκτο στο jsdom).
// Το αντικείμενο του test είναι η ΠΥΛΗ, όχι ο renderer → stub canvas με το ίδιο
// data-attribute που χρησιμοποιούν τα debug probes.
jest.mock('../../../canvas-v2', () => ({
  LayerCanvas: require('react').forwardRef(
    (_props: Record<string, unknown>, ref: React.Ref<HTMLCanvasElement>) =>
      require('react').createElement('canvas', { ref, 'data-canvas-type': 'layer' }),
  ),
}));

// `useCursorWorldPosition` → CursorSystem → cursor/config → user-settings → firebase/auth
// (`fetch is not defined` στο jsdom). Κόβεται ΜΟΝΟ ο cursor κρίκος· το `useDraftPolygonLayer`
// τρέχει ΑΛΗΘΙΝΑ (μηδέν κέρσορας = ίδια συμπεριφορά με «ο κέρσορας δεν έχει μπει ακόμη»).
jest.mock('../../../systems/cursor/useCursor', () => ({
  useCursorWorldPosition: () => null,
}));
// Ίδια αλυσίδα: μόνο για τα fixture settings που ταξιδεύουν αυτούσια στον (mocked) καμβά.
jest.mock('../../../systems/cursor/config', () => ({
  DEFAULT_CURSOR_SETTINGS: {
    selection: {
      window: { fillColor: '#0000ff', fillOpacity: 0.2, borderColor: '#0000ff', borderOpacity: 1, borderStyle: 'solid', borderWidth: 1 },
      crossing: { fillColor: '#00ff00', fillOpacity: 0.2, borderColor: '#00ff00', borderOpacity: 1, borderStyle: 'dashed', borderWidth: 1 },
    },
  },
}));

import { DraftLayerSubscriber } from '../canvas-layer-stack-draft-layer-leaf';
import type { LayerCanvasPassthroughProps } from '../canvas-layer-stack-draft-layer-leaf';
import { SelectionStore } from '../../../systems/cursor/SelectionStore';
import { DEFAULT_CROSSHAIR_SETTINGS } from '../../../rendering/ui/crosshair/CrosshairTypes';
import { DEFAULT_CURSOR_SETTINGS } from '../../../systems/cursor/config';
import { DEFAULT_GRID_SETTINGS } from '../../../rendering/ui/grid/GridTypes';
import type { ColorLayer } from '../../../canvas-v2/layer-canvas/layer-types';

// ── Passthrough props: αντίγραφο της ΠΑΡΑΓΩΓΙΚΗΣ ρύθμισης του CanvasLayerStack ────
// (grid + rulers disabled, showSelectionBox:false — ο render hook τα παρακάμπτει από
// το SelectionStore· βλ. layer-canvas-hooks.renderLayers)
const PASSTHROUGH: LayerCanvasPassthroughProps = {
  viewport: { width: 800, height: 600 },
  activeTool: 'select',
  layersVisible: true,
  enableUnifiedCanvas: true,
  crosshairSettings: DEFAULT_CROSSHAIR_SETTINGS,
  cursorSettings: DEFAULT_CURSOR_SETTINGS,
  snapSettings: { enabled: false, types: [], tolerance: 10 },
  gridSettings: { ...DEFAULT_GRID_SETTINGS, enabled: false },
  rulerSettings: { enabled: false },
  selectionSettings: DEFAULT_CURSOR_SETTINGS.selection,
  renderOptions: {
    showSnapIndicators: true,
    showGrid: false,
    showRulers: false,
    showSelectionBox: false,
    selectionBox: null,
  },
};

const colorLayer = (over: Partial<ColorLayer> = {}): ColorLayer => ({
  id: 'region-1',
  name: 'Region 1',
  color: '#ff0000',
  opacity: 1,
  visible: true,
  zIndex: 0,
  polygons: [
    {
      id: 'poly-1',
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      fillColor: '#ff0000',
      strokeColor: '#000000',
      strokeWidth: 1,
      selected: false,
    },
  ],
  ...over,
});

function renderGate(props: {
  colorLayers?: ColorLayer[];
  draftPolygon?: Array<[number, number]>;
  passthrough?: LayerCanvasPassthroughProps;
}) {
  const ref = React.createRef<HTMLCanvasElement>();
  return render(
    <DraftLayerSubscriber
      canvasRef={ref}
      colorLayers={props.colorLayers ?? []}
      draftPolygon={props.draftPolygon ?? []}
      currentStatus="active"
      overlayMode="draw"
      layerCanvasPassthroughProps={props.passthrough ?? PASSTHROUGH}
    />,
  );
}

const layerCanvas = () => document.querySelector('canvas[data-canvas-type="layer"]');

afterEach(() => {
  act(() => SelectionStore.endSelection());
});

describe('DraftLayerSubscriber — mount-on-demand (ADR-732 §3)', () => {
  it('άδειο σχέδιο ⇒ ΚΑΝΕΝΑ canvas element στο DOM', () => {
    renderGate({});
    expect(layerCanvas()).toBeNull();
  });

  it('ορατό color layer ⇒ mounted', () => {
    renderGate({ colorLayers: [colorLayer()] });
    expect(layerCanvas()).not.toBeNull();
  });

  it('ΜΟΝΟ layer με visible:false ⇒ ΚΑΝΕΝΑ canvas', () => {
    renderGate({ colorLayers: [colorLayer({ visible: false })] });
    expect(layerCanvas()).toBeNull();
  });

  it('draft polygon (1ο σημείο) ⇒ mount στο πρώτο σημείο', () => {
    renderGate({ draftPolygon: [[0, 0]] });
    expect(layerCanvas()).not.toBeNull();
  });

  it('layersVisible:false με ΜΟΝΟ αποθηκευμένα layers ⇒ ΚΑΝΕΝΑ canvas', () => {
    renderGate({
      colorLayers: [colorLayer()],
      passthrough: { ...PASSTHROUGH, layersVisible: false },
    });
    expect(layerCanvas()).toBeNull();
  });

  it('MARQUEE σε ΑΔΕΙΟ σχέδιο: mount μέσα στη χειρονομία, unmount στο τέλος της', () => {
    renderGate({});
    expect(layerCanvas()).toBeNull();

    // startSelection = το ΙΔΙΟ σήμα που διαβάζει ο render hook για να ζωγραφίσει το box
    act(() => SelectionStore.startSelection({ x: 5, y: 5 }));
    expect(layerCanvas()).not.toBeNull();

    // Η κίνηση της χειρονομίας δεν ξε-mount-άρει τίποτα (το snapshot μένει `true`).
    act(() => SelectionStore.updateSelection({ x: 40, y: 40 }));
    expect(layerCanvas()).not.toBeNull();

    act(() => SelectionStore.endSelection());
    expect(layerCanvas()).toBeNull();
  });

  it('marquee ΔΕΝ ξε-mount-άρει καμβά που έχει ήδη περιεχόμενο', () => {
    renderGate({ colorLayers: [colorLayer()] });
    act(() => SelectionStore.startSelection({ x: 1, y: 1 }));
    expect(layerCanvas()).not.toBeNull();
    act(() => SelectionStore.endSelection());
    expect(layerCanvas()).not.toBeNull();
  });

  it('στατικό selectionBox από props ⇒ mounted (props μονοπάτι, fail-mounted)', () => {
    renderGate({
      passthrough: {
        ...PASSTHROUGH,
        renderOptions: {
          showSnapIndicators: true,
          showGrid: false,
          showRulers: false,
          showSelectionBox: true,
          selectionBox: { startPoint: { x: 0, y: 0 }, endPoint: { x: 3, y: 3 }, type: 'window' },
        },
      },
    });
    expect(layerCanvas()).not.toBeNull();
  });

  it('showSnapIndicators:true ΜΟΝΟ του ⇒ ΚΑΝΕΝΑ canvas (νεκρή είσοδος, ADR-137)', () => {
    // Το PASSTHROUGH έχει showSnapIndicators:true και τίποτα άλλο ενεργό. Αν κάποιος
    // «επαναφέρει» το showSnapIndicators ως πηγή περιεχομένου, αυτό κοκκινίζει.
    expect(PASSTHROUGH.renderOptions?.showSnapIndicators).toBe(true);
    renderGate({ passthrough: { ...PASSTHROUGH } });
    expect(layerCanvas()).toBeNull();
  });
});
