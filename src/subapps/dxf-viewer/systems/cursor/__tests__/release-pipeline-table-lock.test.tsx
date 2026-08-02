/**
 * 🔴 ADR-739 §29.11 — **ΤΟ ANCHOR ΤΗΣ ΠΥΛΗΣ: «ΤΙ ΕΚΑΝΕ Ο ΚΑΜΒΑΣ;», ΟΧΙ «ΚΛΗΘΗΚΕ Η ΠΥΛΗ;»**
 *
 * Το `select-gesture-gates.test.ts` δοκιμάζει τις πύλες ως **καθαρές συναρτήσεις** — σωστά, και
 * γι' αυτό ακριβώς εξήχθησαν. Έχει όμως ένα κενό που το §29.9 άφησε δηλωμένο και ανοιχτό: μια
 * πύλη πράσινη σε απομόνωση **δεν αποδεικνύει ότι κάποιος τη ρωτά**. Αν αύριο σβηστεί η κλήση
 * από τον χειριστή, και τα εννιά tests των πυλών μένουν πράσινα και ο χρήστης ξαναβλέπει
 * ακριβώς το στιγμιότυπο του Δ1.
 *
 * *«Ένα anchor χωρίς gate δεν είναι anchor — είναι σχόλιο»* (ADR-587 §6.1). Το αντίστροφο
 * ισχύει το ίδιο: **μια πύλη χωρίς επαληθευμένο καταναλωτή είναι σχόλιο.**
 *
 * ## Γιατί ο χειριστής ΕΙΝΑΙ τελικά δοκιμάσιμος
 * Το §29.9 έγραψε «hot handlers που δεν στήνονται σε test χωρίς δεκάδες props». Μετρήθηκε: στο
 * `CentralizedMouseHandlersProps` **όλα** τα πεδία είναι προαιρετικά εκτός από `scene` και
 * `viewport`, και ο `useMouseUpHandler` δέχεται τον δρομέα ως **παράμετρο**. Άρα ο πραγματικός
 * χειριστής τρέχει με έναν αληθινό `CursorProvider` και τρεις κατασκόπους — καμία προσομοίωση
 * της λογικής, καμία mock-αρισμένη πύλη.
 *
 * Η ερώτηση κάθε test είναι **η οθόνη**: άνοιξε πλαίσιο επιλογής; επιλέχθηκε η οντότητα;
 *
 * @see systems/cursor/select-gesture-gates.ts — η πύλη
 * @see systems/cursor/mouse-handler-up.ts — ο καταναλωτής που κλειδώνεται εδώ
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { CursorProvider, useCursor } from '../CursorSystem';
import { useMouseUpHandler } from '../mouse-handler-up';
import { SelectionStore } from '../SelectionStore';
import {
  __resetTableCanvasLockdownForTests,
  __setCanvasLockedByTableSessionForTests,
} from '../../../ui/table-cell-editor/use-table-canvas-lockdown';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs } from '../mouse-handler-types';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../../rendering/types/Types';

// Ο ΙΔΙΟΣ αποκλεισμός που κάνει ήδη το `CursorSystem-split-context.test.tsx`: το πραγματικό
// singleton ρυθμίσεων του δρομέα σέρνει την αλυσίδα firebase-auth, που δεν υπάρχει σε jsdom.
// Καμία σχέση με ό,τι δοκιμάζεται εδώ — ο χειριστής δεν διαβάζει ρυθμίσεις δρομέα.
jest.mock('@/auth/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../config', () => {
  const settings = { behavior: { coordinate_display: true }, performance: { precision_mode: false } };
  return {
    DEFAULT_CURSOR_SETTINGS: settings,
    cursorConfig: {
      bindToRepository: () => undefined,
      unbindFromRepository: () => undefined,
      resetToDefaults: () => undefined,
    },
    getCursorSettings: () => settings,
    updateCursorSettings: () => undefined,
    subscribeToCursorSettings: () => () => undefined,
  };
});

// Ίδιος λόγος, δεύτερη αλυσίδα: ο κύκλος επικαλύψεων (ADR-659) σέρνει το `ServiceRegistry` →
// firestore. **Δεν συμμετέχει** σε κανένα από τα σενάρια εδώ (ο κλάδος του απαιτεί
// `onEntitiesSelected`, που δεν περνιέται), άρα ο αποκλεισμός δεν κρύβει τίποτα υπό δοκιμή.
jest.mock('../../selection/resolve-repeated-click-cycle', () => ({
  resolveRepeatedClickCycle: () => false,
}));

const VIEWPORT = { width: 800, height: 600 } as const;
/** Το σημείο του πατήματος — αδιάφορο ποιο, αρκεί να είναι μέσα στον καμβά. */
const PRESS_AT: Point2D = { x: 400, y: 300 };

interface Spies {
  readonly onEntitySelect: jest.Mock;
  readonly onCanvasClick: jest.Mock;
  readonly hitTestCallback: jest.Mock;
}

/** Ο καμβάς — με **πραγματικό** πλαίσιο, αλλιώς το `getPointerSnapshotFromElement` παραιτείται. */
function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, ...VIEWPORT }) as DOMRect;
  return canvas;
}

/** Συνθετικό συμβάν React — μόνο όσα πεδία διαβάζει πραγματικά ο χειριστής. */
function releaseEvent(canvas: HTMLCanvasElement): React.MouseEvent<HTMLCanvasElement> {
  return {
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    clientX: PRESS_AT.x,
    clientY: PRESS_AT.y,
    currentTarget: canvas,
    target: canvas,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as React.MouseEvent<HTMLCanvasElement>;
}

/** Στήνει τον **πραγματικό** χειριστή και τον εκτελεί μία φορά. */
function runRelease(spies: Spies): void {
  const canvas = makeCanvas();
  const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>;
  let fire: (() => void) | null = null;

  function Harness(): null {
    const cursor = useCursor();
    const refs: MouseHandlerRefs = {
      panStateRef: React.useRef({ isPanning: false, lastMousePos: null, pendingTransform: null, animationId: null }),
      cursorThrottleRef: React.useRef({ lastUpdateTime: 0 }),
      hoverThrottleRef: React.useRef(0),
      lassoDownRef: React.useRef<{ pos: Point2D | null; buttonHeld: boolean }>({ pos: null, buttonHeld: false }),
    };
    const props: CentralizedMouseHandlersProps = {
      scene: { entities: [] } as unknown as DxfScene,
      viewport: VIEWPORT,
      activeTool: 'select',
      canvasRef,
      onEntitySelect: spies.onEntitySelect,
      onCanvasClick: spies.onCanvasClick,
      hitTestCallback: spies.hitTestCallback,
    };
    const handleMouseUp = useMouseUpHandler({
      props, cursor, refs, snap: { snapEnabled: false, findSnapPoint: undefined },
    });
    fire = (): void => {
      // Ο χειριστής διαβάζει τη θέση από τον δρομέα, όχι από το συμβάν (ADR-040).
      cursor.updatePosition(PRESS_AT);
      handleMouseUp(releaseEvent(canvas));
    };
    return null;
  }

  const view = render(<CursorProvider><Harness /></CursorProvider>);
  act(() => { fire?.(); });
  view.unmount();
}

function makeSpies(hit: string | null): Spies {
  return {
    onEntitySelect: jest.fn(),
    onCanvasClick: jest.fn(),
    hitTestCallback: jest.fn(() => hit),
  };
}

describe('🔴 ADR-739 §29.11 — ο ΠΡΑΓΜΑΤΙΚΟΣ χειριστής απελευθέρωσης υπό κλείδωμα', () => {
  beforeEach(() => {
    __resetTableCanvasLockdownForTests();
    SelectionStore.cancelSelection();
  });

  afterEach(() => {
    __resetTableCanvasLockdownForTests();
    SelectionStore.cancelSelection();
  });

  describe('Δ1 — το πλαίσιο δύο κλικ που ξεκινούσε από τις ζώνες δείκτη', () => {
    it('βάση: χωρίς κλείδωμα, κλικ σε κενό ΞΕΚΙΝΑΕΙ πλαίσιο επιλογής', () => {
      // Χωρίς αυτό, ένα «μη ζωγραφίζεις ποτέ» θα ήταν πράσινο στο επόμενο.
      runRelease(makeSpies(null));
      expect(SelectionStore.getIsSelecting()).toBe(true);
    });

    it('🔴 ΚΛΕΙΔΩΜΕΝΟΣ ΚΑΜΒΑΣ ⇒ κανένα πλαίσιο — αυτό ακριβώς έδειχνε το στιγμιότυπο', () => {
      __setCanvasLockedByTableSessionForTests(true);
      runRelease(makeSpies(null));
      expect(SelectionStore.getIsSelecting()).toBe(false);
    });
  });

  describe('Δ2 — η οντότητα ΚΑΤΩ από το κελί', () => {
    it('βάση: χωρίς κλείδωμα, το κλικ επιλέγει την οντότητα κάτω από τον δείκτη', () => {
      const spies = makeSpies('text-ΤΕΣΤ');
      runRelease(spies);
      expect(spies.onEntitySelect).toHaveBeenCalledWith('text-ΤΕΣΤ', false);
    });

    it('🔴 ΚΛΕΙΔΩΜΕΝΟΣ ΚΑΜΒΑΣ ⇒ καμία επιλογή, άρα καμία αλλαγή κορδέλας', () => {
      __setCanvasLockedByTableSessionForTests(true);
      const spies = makeSpies('text-ΤΕΣΤ');
      runRelease(spies);
      expect(spies.onEntitySelect).not.toHaveBeenCalled();
      // Ούτε καν hit-test: η δουλειά σταματά **πριν** ξοδευτεί, όχι στο αποτέλεσμά της.
      expect(spies.hitTestCallback).not.toHaveBeenCalled();
    });
  });

  it('🔴 και ο ΤΡΙΤΟΣ καταναλωτής του ίδιου συμβάντος σωπαίνει — το κλικ εργαλείου', () => {
    // Μία πύλη για ολόκληρο το μπλοκ: ένας φύλακας ανά καταναλωτή θα ξεχνούσε αυτόν εδώ.
    __setCanvasLockedByTableSessionForTests(true);
    const spies = makeSpies(null);
    runRelease(spies);
    expect(spies.onCanvasClick).not.toHaveBeenCalled();
  });
});
