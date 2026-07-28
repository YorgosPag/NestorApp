/**
 * ADR-650 §M10g — Η ΡΑΦΗ ΑΠΟ ΑΚΡΗ ΣΕ ΑΚΡΗ: ψήσιμο → σφραγίδα → reconciler, με ΤΟΥΣ ΑΛΗΘΙΝΟΥΣ stores.
 *
 * ── Γιατί υπάρχει αυτό το αρχείο, ενώ το §M10g είναι ήδη «καλυμμένο» ──────────────────────
 * Το `topo-frame-reconcile.test.ts` δοκιμάζει την **καθαρή** `reconcileBakedFramesInScene`:
 * της δίνει `bakedFrames` ως όρισμα. Το `topo-bake-commit.test.ts` δοκιμάζει ότι το ψήσιμο
 * **γράφει** σφραγίδα. Και τα δύο είναι πράσινα. Και όμως ο χρήστης βλέπει «άγνωστο πλαίσιο»
 * για ετικέτες που μόλις έψησε με ενεργή γεωαναφορά.
 *
 * Ο λόγος είναι η κλασική τυφλή ζώνη: **κανένα τεστ δεν ένωνε τα δύο άκρα μέσα από τον
 * ΠΡΑΓΜΑΤΙΚΟ store.** Ο γράφων (`commitBakedTopoEntities`) και ο αναγνώστης
 * (`reconcileTopoFrame`) συναντιούνται μόνο εκεί — και η ραφή είναι ακριβώς ό,τι δεν
 * δοκιμάζεται όταν το ένα άκρο περνιέται ως όρισμα στο άλλο.
 *
 * Τα σενάρια εδώ είναι ΑΚΡΙΒΩΣ οι τρεις υποψίες του handoff (§2.2), ώστε το αποτέλεσμα να
 * είναι διάγνωση, όχι εντύπωση.
 *
 * ⚠️ Μη-ταυτοτική γεωαναφορά σε μεγέθη ΕΓΣΑ (υποχρεωτικό: όλο το θέμα ΕΙΝΑΙ το πλαίσιο).
 */

import { commitBakedTopoEntities } from '../topo-bake-commit';
import {
  getBakedFrame, getBakedFrames, resetBakedFramesForTest,
} from '../topo-baked-frame-store';
import { reconcileTopoFrame } from '../persistence/topo-frame-reconcile';
import { applyTopoState, collectTopoState } from '../persistence/topo-state-io';
import type { TopoPersistedState } from '../persistence/topo-persistence-types';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import { clearTopo } from '../TopoPointStore';
import { getTopoFrameStatus, resetTopoFrameStatusForTest } from '../topo-frame-status-store';
import { ensurePointLabelLayers } from '../ensure-point-label-layers';
import { bakedGroupOfLayerName } from '../topo-baked-groups';
import { clearAllBakedFrames } from '../topo-baked-frame-store';
import { TOPO_CROP_OFF } from '../topo-types';
import { DEFAULT_CONTOUR_CONFIG, DEFAULT_CONTOUR_DISPLAY_STYLE } from '../contour-config';
import type { Entity } from '../../../types/entities';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';

// Η ραφή δοκιμάζεται ως προς τη ΔΙΚΗ της ευθύνη· η εγγραφή σκηνής (ADR-057) είναι ήδη
// καλυμμένη αλλού. Ο ψεύτικος καλών κάνει ΑΚΡΙΒΩΣ ό,τι ο αληθινός: προσθέτει στη σκηνή.
jest.mock('../../../hooks/drawing/completeEntity', () => ({
  completeEntities: jest.fn(
    (entities: Entity[], opts: {
      levelId: string;
      getScene: (id: string) => SceneModel | null;
      setScene: (id: string, scene: SceneModel) => void;
    }) => {
      const scene = opts.getScene(opts.levelId);
      if (!scene) return [];
      opts.setScene(opts.levelId, {
        ...scene,
        entities: [...scene.entities, ...(entities as unknown as AnySceneEntity[])],
      });
      return entities;
    },
  ),
}));

/** Το κληρονομημένο πλαίσιο του εργοταξίου (§2.1 του handoff), σε canonical mm. */
const EGSA_ACTIVE = { originWorld: { x: 407_587_410, y: 4_502_061_890 }, rotationDeg: 0 };
const LEVEL = 'lvl_dabeb3bb-e4ba-4918-affc-95fadcbc31d2';

/** Ένας ελάχιστος, γραπτός «δίσκος» σκηνών ανά επίπεδο — ό,τι δίνει το `useLevels`. */
function makeSceneIo(): {
  getScene: (levelId: string) => SceneModel | null;
  setScene: (levelId: string, scene: SceneModel) => void;
} {
  const byLevel = new Map<string, SceneModel>();
  byLevel.set(LEVEL, {
    entities: [],
    layersById: {} as SceneModel['layersById'],
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as SceneModel);
  return {
    getScene: (levelId) => byLevel.get(levelId) ?? null,
    setScene: (levelId, scene) => { byLevel.set(levelId, scene); },
  };
}

/**
 * Ψήσε ετικέτες σημείων όπως ο `useTopoPointLabels`: layers, μετά η ΜΙΑ ραφή.
 *
 * ⚠️ Τα ids είναι **φρέσκα σε κάθε κλήση** — αυτό ΔΕΝ είναι λεπτομέρεια του fixture, είναι η
 * πραγματική συμπεριφορά των τριών παραγωγών (`generateEntityId()` ανά οντότητα) και ακριβώς
 * ο λόγος που το δεύτερο ψήσιμο στοίβαζε αντί να αντικαθιστά.
 */
let bakeSerial = 0;
function bakePointLabels(
  io: ReturnType<typeof makeSceneIo>,
  levelId: string = LEVEL,
): void {
  const layers = ensurePointLabelLayers(io.getScene, io.setScene, levelId);
  if (!layers) throw new Error('TEST_SETUP: δεν δημιουργήθηκαν τα layers των ετικετών');
  const run = ++bakeSerial;
  const entities: Entity[] = [
    {
      id: `lbl_elev_1_run${run}`, type: 'text', layerId: layers.elevation,
      position: { x: 1250, y: 3400 }, text: '•103.72', fontSize: 200,
    } as unknown as Entity,
    {
      id: `lbl_elev_2_run${run}`, type: 'text', layerId: layers.elevation,
      position: { x: 4100, y: 900 }, text: '•104.15', fontSize: 200,
    } as unknown as Entity,
  ];
  commitBakedTopoEntities({
    entities, group: 'pointLabels', tool: 'topo-point-labels',
    levelId, getScene: io.getScene, setScene: io.setScene,
  });
}

/** Τα ids των οντοτήτων που κάθονται στα layers των ετικετών σημείων. */
function pointLabelEntityIds(io: ReturnType<typeof makeSceneIo>): string[] {
  const scene = io.getScene(LEVEL);
  if (!scene) return [];
  const labelLayerIds = new Set(
    Object.values(scene.layersById)
      .filter((layer) => bakedGroupOfLayerName(layer.name) === 'pointLabels')
      .map((layer) => layer.id),
  );
  return scene.entities
    .filter((e) => e.layerId !== undefined && labelLayerIds.has(e.layerId))
    .map((e) => e.id);
}

const countPointLabelEntities = (io: ReturnType<typeof makeSceneIo>): number =>
  pointLabelEntityIds(io).length;

/** Ένα legacy έγγραφο: όλα τα υπόλοιπα πεδία παρόντα, σφραγίδες ΚΑΜΙΑ. */
const LEGACY_DOC_STATE: TopoPersistedState = {
  surfaces: {
    existing: { points: [], breaklines: [] },
    proposed: { points: [], breaklines: [] },
  },
  boundary: null,
  crop: TOPO_CROP_OFF,
  contourConfig: DEFAULT_CONTOUR_CONFIG,
  contourDisplayStyle: DEFAULT_CONTOUR_DISPLAY_STYLE,
  terrain3d: { visible: false, style: 'shaded' },
  cutFill: { mode: 'datum', datumZMm: 0 },
  bakedFrames: {},
};

describe('ADR-650 §M10g — ραφή ψησίματος → reconciler μέσα από τον ΑΛΗΘΙΝΟ store', () => {
  beforeEach(() => {
    resetBakedFramesForTest();
    resetTopoFrameStatusForTest();
    clearTopo();
    setGeoReference(EGSA_ACTIVE);
  });
  afterEach(() => {
    resetBakedFramesForTest();
    resetTopoFrameStatusForTest();
    clearTopo();
    setGeoReference(null);
  });

  it('§2.2#1+#2 — ψήσιμο ΜΕ ενεργή γεωαναφορά ⇒ ο reconciler ΔΕΝ λέει «άγνωστο πλαίσιο»', () => {
    const io = makeSceneIo();
    bakePointLabels(io);

    // Ο ίδιος ο store, από τη μεριά του γράφοντα: η σφραγίδα υπάρχει και είναι το ενεργό πλαίσιο.
    expect(getBakedFrame(LEVEL, 'pointLabels')).toEqual({
      originWorldXMm: EGSA_ACTIVE.originWorld.x,
      originWorldYMm: EGSA_ACTIVE.originWorld.y,
      rotationDeg: 0,
    });

    const outcome = reconcileTopoFrame({
      getScene: io.getScene,
      commitScene: (scene) => io.setScene(LEVEL, scene),
      levelId: LEVEL,
    });

    expect(outcome.unstampedGroups).toEqual([]);
    expect(outcome.unsupportedGroups).toEqual([]);
    // …και η σφραγίδα ΕΠΙΒΙΩΝΕΙ του περάσματος (δεν αποσύρεται σιωπηλά).
    expect(getBakedFrame(LEVEL, 'pointLabels')).not.toBeNull();
  });

  it('§2.2#3 — round-trip περσιστάρισμα (collect→apply) ΔΕΝ σβήνει τη φρέσκια σφραγίδα', () => {
    const io = makeSceneIo();
    bakePointLabels(io);

    // Ό,τι ακριβώς κάνει το `useTopoPersistence` όταν το ίδιο του το έγγραφο επιστρέφει.
    applyTopoState(collectTopoState());

    expect(getBakedFrame(LEVEL, 'pointLabels')).not.toBeNull();
    const outcome = reconcileTopoFrame({
      getScene: io.getScene,
      commitScene: (scene) => io.setScene(LEVEL, scene),
      levelId: LEVEL,
    });
    expect(outcome.unstampedGroups).toEqual([]);
  });

  it('§2.2#3 — legacy έγγραφο (bakedFrames: {}) ΔΕΝ επιτρέπεται να σβήσει σφραγίδα που μόλις γράφτηκε', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    expect(getBakedFrame(LEVEL, 'pointLabels')).not.toBeNull();

    // Ένα legacy/άσχετο έγγραφο φτάνει από το Firestore ΜΕΤΑ το ψήσιμο.
    applyTopoState(LEGACY_DOC_STATE);

    const outcome = reconcileTopoFrame({
      getScene: io.getScene,
      commitScene: (scene) => io.setScene(LEVEL, scene),
      levelId: LEVEL,
    });
    expect(outcome.unstampedGroups).toEqual([]);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ψημένες ετικέτες ΧΩΡΙΣ ψήσιμο (legacy σκηνή) ΟΝΤΩΣ σημαδεύονται', () => {
    // Η ίδια ακριβώς σκηνή, αλλά η σφραγίδα δεν γράφτηκε ποτέ — αλλιώς οι έλεγχοι από πάνω
    // θα ήταν πράσινοι και για έναν reconciler που δεν σημαδεύει ποτέ τίποτα.
    const io = makeSceneIo();
    bakePointLabels(io);
    resetBakedFramesForTest();

    const outcome = reconcileTopoFrame({
      getScene: io.getScene,
      commitScene: (scene) => io.setScene(LEVEL, scene),
      levelId: LEVEL,
    });
    expect(outcome.unstampedGroups).toEqual(['pointLabels']);
  });

  it('ΤΟ ΚΛΕΙΔΙ: γράφων και αναγνώστης πρέπει να μιλούν για ΤΟ ΙΔΙΟ επίπεδο', () => {
    const io = makeSceneIo();
    bakePointLabels(io);

    // Το ίδιο ψήσιμο, διαβασμένο με ΑΛΛΟ levelId (η υπόθεση «currentLevelId κενό ⇒ '0'»).
    expect(getBakedFrames()[LEVEL]).toBeDefined();
    expect(getBakedFrames()['0']).toBeUndefined();
  });
});

describe('ADR-650 §M10g — Η ΑΚΡΙΒΗΣ ΑΚΟΛΟΥΘΙΑ ΤΟΥ ΧΡΗΣΤΗ (handoff §2.1)', () => {
  beforeEach(() => {
    resetBakedFramesForTest();
    resetTopoFrameStatusForTest();
    clearTopo();
    setGeoReference(EGSA_ACTIVE);
  });
  afterEach(() => {
    resetBakedFramesForTest();
    resetTopoFrameStatusForTest();
    clearTopo();
    setGeoReference(null);
  });

  it('legacy ετικέτες στη σκηνή ⇒ ο διάλογος λέει σωστά «άγνωστο πλαίσιο»', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    resetBakedFramesForTest(); // legacy έγγραφο: η γεωμετρία υπάρχει, η σφραγίδα όχι

    reconcileTopoFrame({
      getScene: io.getScene,
      commitScene: (scene) => io.setScene(LEVEL, scene),
      levelId: LEVEL,
    });
    expect(getTopoFrameStatus().unstampedGroups).toEqual(['pointLabels']);
  });

  it('🎯 ADR-722: το δεύτερο ψήσιμο ΔΕΝ στοιβάζει — ίδιο πλήθος οντοτήτων, όχι διπλάσιο', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    const afterFirst = countPointLabelEntities(io);
    expect(afterFirst).toBe(2);

    bakePointLabels(io);
    // Πριν το ADR-722 εδώ έβγαιναν 4 (66 → 132 στο εργοτάξιο του Giorgio), με τις μισές σε
    // παλιό πλαίσιο ⇒ ~408 km μακριά ⇒ αόρατες (ADR-635 culling).
    expect(countPointLabelEntities(io)).toBe(afterFirst);
  });

  it('🎯 ADR-722: το ξανα-ψήσιμο ΚΑΘΑΡΙΖΕΙ τις legacy ⇒ η σφραγίδα γίνεται ΑΛΗΘΗΣ', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    const legacyIds = pointLabelEntityIds(io);
    resetBakedFramesForTest(); // legacy: η γεωμετρία υπάρχει, η σφραγίδα χάθηκε

    bakePointLabels(io);

    // Καμία legacy δεν επιβίωσε — άρα η φρέσκια σφραγίδα περιγράφει ΟΛΗ την ομάδα, αληθινά.
    const surviving = pointLabelEntityIds(io);
    expect(surviving.some((id) => legacyIds.includes(id))).toBe(false);
    expect(getBakedFrame(LEVEL, 'pointLabels')).not.toBeNull();
  });

  it('🔴 ΤΟ ΣΦΑΛΜΑ: ο χρήστης ξαναψήνει με ενεργή γεωαναφορά — η προειδοποίηση ΜΕΝΕΙ', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    resetBakedFramesForTest();
    reconcileTopoFrame({
      getScene: io.getScene,
      commitScene: (scene) => io.setScene(LEVEL, scene),
      levelId: LEVEL,
    });
    expect(getTopoFrameStatus().unstampedGroups).toEqual(['pointLabels']); // η αφετηρία

    // Ο χρήστης πατά ξανά «Ετικέτες σημείων» — με τη γεωαναφορά ΗΔΗ ενεργή.
    bakePointLabels(io);

    // Η σφραγίδα γράφτηκε σωστά…
    expect(getBakedFrame(LEVEL, 'pointLabels')).not.toBeNull();
    // …αλλά κανείς δεν ξαναρώτησε: το κόκκινο μήνυμα λέει ακόμη «άγνωστο πλαίσιο».
    expect(getTopoFrameStatus().unstampedGroups).toEqual([]);
  });
});

describe('ADR-722 — το έγγραφο που «δεν ξέρει» δεν σβήνει· ο μηδενισμός είναι ΡΗΤΟΣ', () => {
  beforeEach(() => {
    resetBakedFramesForTest();
    resetTopoFrameStatusForTest();
    clearTopo();
    setGeoReference(EGSA_ACTIVE);
  });
  afterEach(() => {
    resetBakedFramesForTest();
    resetTopoFrameStatusForTest();
    clearTopo();
    setGeoReference(null);
  });

  it('legacy έγγραφο (δεν αναφέρει το επίπεδο) ⇒ η φρέσκια σφραγίδα ΕΠΙΒΙΩΝΕΙ', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    applyTopoState(LEGACY_DOC_STATE);
    expect(getBakedFrame(LEVEL, 'pointLabels')).not.toBeNull();
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: έγγραφο που ΑΝΑΦΕΡΕΙ το επίπεδο το αντικαθιστά ολόκληρο', () => {
    // «Ο χρήστης έσβησε τις ετικέτες σε άλλη συσκευή»: το έγγραφο ξέρει αυτό το επίπεδο και
    // λέει ότι έχει μόνο κάναβο. Χωρίς αυτόν τον έλεγχο, η συγχώνευση θα ήταν «δεν σβήνει ποτέ».
    const io = makeSceneIo();
    bakePointLabels(io);
    applyTopoState({
      ...LEGACY_DOC_STATE,
      bakedFrames: {
        [LEVEL]: { grid: { originWorldXMm: 1, originWorldYMm: 2, rotationDeg: 0 } },
      },
    });
    expect(getBakedFrame(LEVEL, 'pointLabels')).toBeNull();
    expect(getBakedFrame(LEVEL, 'grid')).not.toBeNull();
  });

  it('η αλλαγή έργου μηδενίζει ΡΗΤΑ (δεν κρύβεται σε ένα άδειο state)', () => {
    const io = makeSceneIo();
    bakePointLabels(io);
    clearAllBakedFrames();
    expect(getBakedFrames()).toEqual({});
  });
});
