'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './DxfCanvasHarness.module.css';
import type { DxfScene } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Point2D } from '@/subapps/dxf-viewer/rendering/types/Types';
import type { DxfCanvas as DxfCanvasType, DxfCanvasRef } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas';
import type { GridSettings, RulerSettings } from '@/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-types';
import type { PreviewCanvas as PreviewCanvasType, PreviewCanvasHandle } from '@/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewCanvas';
import type { ExtendedSceneEntity } from '@/subapps/dxf-viewer/hooks/drawing/drawing-types';
// 🔴 ADR-775 §13 — ΤΟ ΔΟΚΙΜΑΣΤΗΡΙΟ ΟΦΕΙΛΕΙ ΤΑ ΙΔΙΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΜΕ ΤΗΝ ΠΑΡΑΓΩΓΗ.
// Ο `DxfCanvas` καλεί `useCursor()` (μέσω `useCentralizedMouseHandlers`) ήδη από το
// `83729ea4` — δηλαδή **πριν καν γεννηθεί** η σουίτα e2e. Χωρίς `CursorSystem` πάνω του
// πετούσε «useCursor must be used within a CursorSystem», η σελίδα αντικαθιστούσε τον εαυτό
// της με το route error boundary, και **κάθε** golden φωτογράφιζε τη σελίδα σφάλματος: η
// σουίτα ήταν δομικά ανίκανη να προσαρτήσει καμβά από την πρώτη της μέρα.
// ⚠️ Ο πάροχος είναι ο **παραγωγικός** (ίδιος με `DxfViewerApp.tsx`) και όχι διπλότυπο
// δοκιμών: ένα ψεύτικο context θα δοκίμαζε τον εαυτό του.
// ⚠️ ΔΥΟ πάροχοι, με τη σειρά ΤΗΣ ΠΑΡΑΓΩΓΗΣ (`DxfViewerApp`: SnapProvider ⊃ CursorSystem).
// Είναι **ακριβώς** όσοι απαιτεί η διαδρομή του καμβά — `useCursor` (DxfCanvas) και
// `useSnapContext` (useCentralizedMouseHandlers + useSnapManager) — και κανείς παραπάνω:
// ένα δοκιμαστήριο που σέρνει μαζί του Firestore/auth παύει να δοκιμάζει τον ζωγράφο.
import { CursorSystem } from '@/subapps/dxf-viewer/systems/cursor';
import { SnapProvider } from '@/subapps/dxf-viewer/snapping/context/SnapContext';
// ADR-040 Φάση XXII.B — το ζωντανό SSoT του μετασχηματισμού· ο ζωγράφος διαβάζει ΑΠΟ ΕΔΩ.
import {
  updateImmediateTransform,
  getImmediateTransform,
} from '@/subapps/dxf-viewer/systems/cursor/ImmediateTransformStore';
// 🔑 SSoT κόσμος→οθόνη (άγκυρα: κάτω-αριστερή γωνία της περιοχής σχεδίασης + αναστροφή Y).
import { CoordinateTransforms } from '@/subapps/dxf-viewer/rendering/core/CoordinateTransforms';
import { useHasPainted } from '@/subapps/dxf-viewer/systems/paint-census/use-has-painted';
import { getPaintCount } from '@/subapps/dxf-viewer/systems/paint-census/paint-census-store';

const PreviewCanvas = dynamic(
  () => import('@/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewCanvas').then(m => m.PreviewCanvas),
  { ssr: false }
) as typeof PreviewCanvasType;

const SnapIndicatorOverlay = dynamic(
  () => import('@/subapps/dxf-viewer/canvas-v2/overlays/SnapIndicatorOverlay'),
  { ssr: false }
);

declare global {
  interface Window {
    __dxfTest: {
      fitToView: () => void;
      zoomIn: () => void;
      zoomOut: () => void;
      getRef: () => DxfCanvasRef | null;
      isReady: () => boolean;
      selectEntities: (ids: string[]) => void;
      clearSelection: () => void;
      getSelectedEntityIds: () => string[];
      worldToScreen: (wx: number, wy: number) => { x: number; y: number };
      drawPreview: (entity: Record<string, unknown>) => void;
      clearPreview: () => void;
      setActiveTool: (tool: string) => void;
      updateSceneEntity: (id: string, patch: Record<string, unknown>) => void;
      addSceneEntity: (entity: Record<string, unknown>) => void;
      removeSceneEntity: (id: string) => void;
      showSnap: (type: string, wx: number, wy: number) => void;
      hideSnap: () => void;
      /**
       * ADR-775 §13 — πόσα καρέ **ολοκλήρωσε** ο ζωγράφος του DXF καμβά.
       *
       * Εκτεθειμένο ώστε ένα test να μπορεί να διαγνώσει τη διαφορά ανάμεσα σε «δεν φόρτωσε»
       * και «φόρτωσε αλλά δεν ζωγράφισε» — οι δύο καταστάσεις παρήγαγαν **ταυτόσημη** άδεια
       * φωτογραφία επί τρεις μήνες.
       */
      paintCount: () => number;
    };
  }
}

const HARNESS_VIEWPORT = { width: 1280, height: 800 };

const DxfCanvas = dynamic(
  () => import('@/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas').then(m => m.DxfCanvas),
  { ssr: false }
) as typeof DxfCanvasType;

const INITIAL_TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const GRID_SETTINGS: GridSettings = {
  enabled: true,
  visible: true,
  color: '#333333',
  size: 10,
  style: 'lines',
  lineWidth: 1,
  majorGridColor: '#444444',
  minorGridColor: '#2a2a2a',
  majorInterval: 5,
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: false,
  minVisibleSize: 5,
  minorGridWeight: 1,
  smoothFade: false,
  smoothFadeDurationMs: 0,
  minGridSpacing: 10,
  showOrigin: false,
  showAxes: false,
  axesColor: '#555555',
  axesWeight: 1,
  opacity: 0.3,
};

const RULER_SETTINGS: RulerSettings = {
  enabled: true,
  visible: true,
  unit: 'mm',
};

export default function DxfCanvasHarness() {
  const canvasRef = useRef<DxfCanvasRef>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);
  const [scene, setScene] = useState<DxfScene | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(INITIAL_TRANSFORM);
  const [error, setError] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState({ rulers: false, grid: false, fixture: 'regression-scene' });
  const [activeTool, setActiveTool] = useState<string>('select');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [snapResult, setSnapResult] = useState<{ point: { x: number; y: number }; type: string } | null>(null);
  const selectedEntityIdsRef = useRef<string[]>([]);
  selectedEntityIdsRef.current = selectedEntityIds;
  // 🔴 ADR-775 §13 — το σήμα ετοιμότητας το παράγει ο ΖΩΓΡΑΦΟΣ. Μάνταλο: ένα re-render
  // συνολικά, όχι ένα ανά καρέ (βλ. paint-census-store, «γιατί μόνο στο πρώτο καρέ»).
  const painterReady = useHasPainted('dxf-canvas');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams({
      rulers: params.get('rulers') === '1',
      grid: params.get('grid') === '1',
      fixture: params.get('fixture') ?? 'regression-scene',
    });
  }, []);

  useEffect(() => {
    fetch(`/test-fixtures/dxf/${urlParams.fixture}.json`)
      .then(r => r.json())
      .then((data: DxfScene) => setScene(data))
      .catch(e => setError(String(e)));
  }, [urlParams.fixture]);

  /**
   * 🔴 ADR-775 §13 — Ο ΖΩΓΡΑΦΟΣ ΔΙΑΒΑΖΕΙ ΤΟ SSoT, ΟΧΙ ΤΟ REACT STATE.
   *
   * Από το ADR-040 Φάση XXII.B το `transform` **έπαψε** να είναι prop του `DxfCanvas`: ο
   * βρόχος καλεί `getImmediateTransform()`. Το δοκιμαστήριο όμως κρατούσε τον μετασχηματισμό
   * **μόνο** σε React state, οπότε `fitToView` / `zoomIn` / `zoomOut` ενημέρωναν κάτι που
   * **κανείς δεν διάβαζε** — μετρημένο 2026-08-08: μετά από `fitToView` το `paintCount`
   * έμεινε `3` και τα pixels **ταυτόσημα**. Κάθε test ζουμ/κάδρου ήταν δομικά νεκρό, ακόμη
   * κι όταν ο καμβάς προσαρτήθηκε.
   *
   * Γράφουμε **και στα δύο**: στο SSoT για τον ζωγράφο (ίδια κίνηση με το παραγωγικό
   * `useViewportManager.setTransform`), και σε React state επειδή `PreviewCanvas` και
   * `SnapIndicatorOverlay` δέχονται ακόμη `transform` ως prop.
   */
  const applyTransform = useCallback((t: ViewTransform) => {
    updateImmediateTransform(t);
    setTransform(t);
  }, []);

  const handleTransformChange = useCallback((t: ViewTransform) => {
    applyTransform(t);
  }, [applyTransform]);

  const handleEntitySelect = useCallback((entityId: string | null) => {
    setSelectedEntityIds(entityId ? [entityId] : []);
  }, []);

  const handleEntitiesSelected = useCallback((ids: string[]) => {
    setSelectedEntityIds(ids);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete') {
      const ids = selectedEntityIdsRef.current;
      if (ids.length === 0) return;
      setScene(s => s ? { ...s, entities: s.entities.filter(ent => !ids.includes(ent.id)) } : null);
      setSelectedEntityIds([]);
    } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setScene(s => {
        if (!s) return s;
        setSelectedEntityIds(s.entities.map(ent => ent.id));
        return s;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderOptions = useMemo(() => ({
    showGrid: false,
    showLayerNames: false,
    wireframeMode: false,
    selectedEntityIds,
  }), [selectedEntityIds]);

  const handleWheelZoom = useCallback((wheelDelta: number, center: Point2D) => {
    // Το «προηγούμενο» διαβάζεται από το SSoT και όχι από το React state: μετά τη διόρθωση
    // του ADR-775 §13 το state είναι **καθρέφτης**, και ένα ζουμ που συνθέτει πάνω σε
    // καθρέφτη θα ξαναγεννούσε την ίδια απόκλιση από την πρώτη χειρονομία.
    const prev = getImmediateTransform();
    const factor = wheelDelta < 0 ? 1.5 : 0.667;
    const newScale = Math.max(0.001, Math.min(500, prev.scale * factor));
    const ratio = newScale / prev.scale;
    applyTransform({
      scale: newScale,
      offsetX: center.x - (center.x - prev.offsetX) * ratio,
      offsetY: center.y - (center.y - prev.offsetY) * ratio,
    });
  }, [applyTransform]);

  useEffect(() => {
    window.__dxfTest = {
      fitToView: () => canvasRef.current?.fitToView(),
      zoomIn: () => canvasRef.current?.zoomAtScreenPoint(2, { x: 640, y: 400 }),
      zoomOut: () => canvasRef.current?.zoomAtScreenPoint(0.5, { x: 640, y: 400 }),
      getRef: () => canvasRef.current,
      // ADR-775 §13 — «έτοιμο» σημαίνει **ζωγράφισε**. Το παλιό `canvasRef && scene` ήταν
      // αληθές και σε σελίδα που δεν είχε προσαρτήσει ποτέ καμβά.
      isReady: () => !!(canvasRef.current && scene) && getPaintCount('dxf-canvas') > 0,
      paintCount: () => getPaintCount('dxf-canvas'),
      selectEntities: (ids: string[]) => setSelectedEntityIds(ids),
      clearSelection: () => setSelectedEntityIds([]),
      getSelectedEntityIds: () => selectedEntityIdsRef.current,
      /**
       * 🔴 ADR-775 §13 — ΤΟ SSoT, ΟΧΙ ΧΕΙΡΟΓΡΑΦΟΣ ΤΥΠΟΣ.
       *
       * Ήταν `{ x: wx*scale + offsetX, y: offsetY − wy*scale }` — ένας τύπος που **δεν
       * υπάρχει πουθενά αλλού στην εφαρμογή**. Ο ζωγράφος αγκυρώνει στην κάτω-αριστερή γωνία
       * της **περιοχής σχεδίασης** (`DRAWING_AREA_CHROME`), δηλαδή `area.bottom − offsetY −
       * wy·scale`. Μετρημένο 2026-08-08 στον αρχικό μετασχηματισμό (`offsetY=770`,
       * viewport 800): ο χειρόγραφος τύπος έλεγε `y=670`, ο ζωγράφος ζωγράφιζε στο `y=−70`
       * — **740px σφάλμα**. Κάθε test hover / click / επιλογής της σουίτας στόχευε επί
       * τρεις μήνες σε λάθος pixel, και «δεν βρέθηκε οντότητα» ήταν το **αναμενόμενο**
       * αποτέλεσμα ενός υγιούς renderer.
       *
       * Δεύτερος τύπος για την ίδια ερώτηση = δεύτερη αλήθεια που αποκλίνει σιωπηλά.
       */
      worldToScreen: (wx: number, wy: number) =>
        CoordinateTransforms.worldToScreen({ x: wx, y: wy }, getImmediateTransform(), HARNESS_VIEWPORT),
      drawPreview: (entity: Record<string, unknown>) =>
        previewCanvasRef.current?.drawPreview(entity as unknown as ExtendedSceneEntity),
      clearPreview: () => previewCanvasRef.current?.clear(),
      setActiveTool: (tool: string) => setActiveTool(tool),
      updateSceneEntity: (id: string, patch: Record<string, unknown>) =>
        setScene(s => s ? { ...s, entities: s.entities.map(e => e.id === id ? { ...e, ...patch } as typeof e : e) } : null),
      addSceneEntity: (entity: Record<string, unknown>) =>
        setScene(s => s ? { ...s, entities: [...s.entities, entity as unknown as DxfScene['entities'][number]] } : null),
      removeSceneEntity: (id: string) =>
        setScene(s => s ? { ...s, entities: s.entities.filter(e => e.id !== id) } : null),
      showSnap: (type: string, wx: number, wy: number) => setSnapResult({ point: { x: wx, y: wy }, type }),
      hideSnap: () => setSnapResult(null),
    };
  });

  if (error) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-background">
        <p data-testid="error" className="text-destructive font-mono text-sm">{error}</p>
      </main>
    );
  }

  return (
    <SnapProvider>
    <CursorSystem>
    <main className="fixed inset-0 overflow-hidden bg-background">
      {scene ? (
        // 🔴 ADR-775 §13 — ΔΥΟ ΞΕΧΩΡΙΣΤΑ testid, ΠΟΤΕ ΕΝΑ ΜΕ «Ή».
        // `dxf-canvas-painting` = «τα δεδομένα έφτασαν, ο ζωγράφος δεν έχει βγάλει καρέ» ·
        // `dxf-canvas-ready`    = «ολοκληρώθηκε καρέ». Ένα μόνο testid που σήμαινε και τα δύο
        // είναι ακριβώς η βλάβη: το test περίμενε το σήμα, το έβρισκε, και φωτογράφιζε το
        // τίποτα. Το `dxf-canvas-painting` **δεν είναι διακοσμητικό** — είναι το πράγμα που
        // ένα timeout μπορεί να δείξει με το δάχτυλο αντί να σιωπήσει.
        <section
          data-testid={painterReady ? 'dxf-canvas-ready' : 'dxf-canvas-painting'}
          className={styles.surface}
        >
          {/* ⚠️ ΚΑΝΕΝΑ `transform` prop: από το ADR-040 XXII.B ο `DxfCanvas` ΔΕΝ το δέχεται
              (διαβάζει το ImmediateTransformStore). Περνώντας το, έπεφτε στο `{...props}`
              και κατέληγε ως attribute πάνω στο ίδιο το `<canvas>` — θόρυβος που έμοιαζε
              με ενσύρματη σύνδεση και δεν ήταν. Το `PreviewCanvas`/`SnapIndicatorOverlay`
              το δέχονται κανονικά και το κρατούν. */}
          <DxfCanvas
            ref={canvasRef}
            scene={scene}
            onTransformChange={handleTransformChange}
            onWheelZoom={handleWheelZoom}
            onEntitySelect={handleEntitySelect}
            onEntitiesSelected={handleEntitiesSelected}
            renderOptions={renderOptions}
            rulerSettings={urlParams.rulers ? RULER_SETTINGS : undefined}
            gridSettings={urlParams.grid ? GRID_SETTINGS : undefined}
            activeTool={activeTool}
          />
          <PreviewCanvas
            ref={previewCanvasRef}
            transform={transform}
            viewport={HARNESS_VIEWPORT}
          />
          <SnapIndicatorOverlay
            snapResult={snapResult}
            viewport={HARNESS_VIEWPORT}
            canvasRect={null}
            transform={transform}
            className="absolute inset-0"
          />
        </section>
      ) : (
        <div data-testid="loading" className="fixed inset-0" />
      )}
    </main>
    </CursorSystem>
    </SnapProvider>
  );
}
