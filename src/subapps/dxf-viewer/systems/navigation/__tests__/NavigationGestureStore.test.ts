/**
 * ADR-728 Φ1 — NavigationGestureStore: «είμαστε σε χειρονομία πλοήγησης;»
 *
 * Ό,τι ελέγχεται εδώ είναι οι ΤΡΕΙΣ ιδιότητες που κάνουν το σχήμα σωστό, όχι απλώς πράσινο:
 *   1. Η κατάσταση ΣΥΝΑΓΕΤΑΙ από την παρατηρούμενη αλλαγή transform (⇒ κάθε διαδρομή
 *      πλοήγησης καλύπτεται δωρεάν, ακόμη και όσες δεν υπάρχουν ακόμη).
 *   2. Το ρητό κανάλι μπορεί ΜΟΝΟ να τερματίζει — άρα δεν μπορεί να κολλήσει «ενεργή»
 *      (CesiumGS/cesium#11889).
 *   3. Η εγγραφή στο transform store είναι LAZY — σκέτη εισαγωγή δεν αφήνει listener.
 *
 * Ο χρόνος ελέγχεται με spy στο `performance.now`, ώστε το idle παράθυρο να είναι
 * ντετερμινιστικό (πρότυπο: `bim-3d/lighting/__tests__/shadow-modulator.test.ts`).
 * Το `ImmediateTransformStore` μένει **ΠΡΑΓΜΑΤΙΚΟ** — αν το mock-άραμε, θα ελέγχαμε το
 * δίδυμό του και όχι τη ζωντανή σύνδεση που είναι όλο το νόημα του σχήματος.
 */

jest.mock('../../../rendering/core/UnifiedFrameScheduler', () => ({
  markSystemsDirty: jest.fn(),
}));

import {
  isNavigationGesture,
  endNavigationGesture,
  __resetNavigationGestureForTest,
} from '../NavigationGestureStore';
import { updateImmediateTransform } from '../../cursor/ImmediateTransformStore';
import { DXF_TIMING } from '../../../config/dxf-timing';

const IDLE = DXF_TIMING.gesture.WHEEL_IDLE;

let clock = 0;
let nowSpy: jest.SpyInstance;

/** Μοναδική πηγή χρόνου για το store — μηδέν εξάρτηση από πραγματικό ρολόι. */
const advance = (ms: number): void => { clock += ms; };

/** Μια πραγματική αλλαγή view transform (ό,τι κάνει pan/zoom/touch/keyboard). */
let seq = 0;
const changeTransform = (): void => {
  seq += 1;
  updateImmediateTransform({ scale: 1 + seq, offsetX: seq, offsetY: seq });
};

beforeEach(() => {
  clock = 1_000_000; // μακριά από το 0, ώστε το -Infinity sentinel να μην περνά τυχαία
  nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clock);
  __resetNavigationGestureForTest();
});

afterEach(() => {
  nowSpy.mockRestore();
  __resetNavigationGestureForTest();
});

describe('NavigationGestureStore — συναγόμενη κατάσταση', () => {
  it('ξεκινά ανενεργό: χωρίς καμία αλλαγή transform δεν είμαστε σε πλοήγηση', () => {
    expect(isNavigationGesture()).toBe(false);
  });

  it('μια αλλαγή transform ενεργοποιεί την πλοήγηση (καμία ρητή «έναρξη» δεν χρειάζεται)', () => {
    isNavigationGesture();   // οπλίζει τη lazy εγγραφή
    changeTransform();
    expect(isNavigationGesture()).toBe(true);
  });

  it('λήγει μόνη της μόλις περάσει το idle παράθυρο', () => {
    isNavigationGesture();
    changeTransform();
    advance(IDLE - 1);
    expect(isNavigationGesture()).toBe(true);   // ακόμη μέσα
    advance(2);
    expect(isNavigationGesture()).toBe(false);  // πέρασε
  });

  it('κάθε νέα αλλαγή transform ανανεώνει το παράθυρο — μια συνεχής χειρονομία δεν «σπάει»', () => {
    isNavigationGesture();
    for (let frame = 0; frame < 10; frame++) {
      changeTransform();
      advance(IDLE - 20);                       // ρυθμός αργού καρέ, εντός παραθύρου
      expect(isNavigationGesture()).toBe(true);
    }
  });

  it('ΔΕΝ ενεργοποιείται από εγγραφή ίδιας τιμής — το transform store δεν ειδοποιεί χωρίς αλλαγή', () => {
    isNavigationGesture();
    updateImmediateTransform({ scale: 7, offsetX: 3, offsetY: 4 });
    advance(IDLE + 1);
    expect(isNavigationGesture()).toBe(false);
    updateImmediateTransform({ scale: 7, offsetX: 3, offsetY: 4 }); // ίδια τιμή
    expect(isNavigationGesture()).toBe(false);
  });
});

describe('NavigationGestureStore — το ρητό κανάλι ΜΟΝΟ τερματίζει', () => {
  it('το end κόβει την πλοήγηση ΑΜΕΣΩΣ, χωρίς να περιμένει το idle παράθυρο', () => {
    isNavigationGesture();
    changeTransform();
    expect(isNavigationGesture()).toBe(true);
    endNavigationGesture();
    expect(isNavigationGesture()).toBe(false);   // μηδέν χρόνος πέρασε
  });

  it('🔴 το end ΔΕΝ μπορεί να παρατείνει: κλήση του σε ήρεμη κατάσταση αφήνει ανενεργό', () => {
    // Αν το `end` έγραφε `performance.now()` αντί για το sentinel, αυτό θα γινόταν true
    // και μια χαμένη «λήξη» θα μπορούσε να κολλήσει την κατάσταση ενεργή για πάντα.
    isNavigationGesture();
    endNavigationGesture();
    expect(isNavigationGesture()).toBe(false);
    advance(1);
    expect(isNavigationGesture()).toBe(false);
  });

  it('🔴 χαμένο end ΔΕΝ κολλάει την αναστολή — λήγει από μόνη της (Cesium #11889)', () => {
    isNavigationGesture();
    changeTransform();
    // ...κανένα endNavigationGesture() δεν έρχεται ποτέ (mouseup εκτός παραθύρου, exception)
    advance(IDLE + 1);
    expect(isNavigationGesture()).toBe(false);
  });

  it('μετά το end, νέα αλλαγή transform ξαναρχίζει κανονικά την πλοήγηση', () => {
    isNavigationGesture();
    changeTransform();
    endNavigationGesture();
    expect(isNavigationGesture()).toBe(false);
    changeTransform();
    expect(isNavigationGesture()).toBe(true);
  });
});

describe('NavigationGestureStore — lazy εγγραφή', () => {
  it('🔴 δεν εγγράφεται πριν την πρώτη ερώτηση: αλλαγή transform πριν το πρώτο query αγνοείται', () => {
    // Καρφώνει την υγιεινή: σκέτη εισαγωγή του module δεν αφήνει listener στο transform SSoT.
    // Αν το `ensureSubscribed` γινόταν eager (top-level), αυτό θα γύριζε true.
    changeTransform();
    expect(isNavigationGesture()).toBe(false);
  });

  it('εγγράφεται ΜΙΑ φορά: πολλαπλά queries δεν πολλαπλασιάζουν listeners', () => {
    isNavigationGesture();
    isNavigationGesture();
    isNavigationGesture();
    changeTransform();
    expect(isNavigationGesture()).toBe(true);
    endNavigationGesture();
    // Ένας μόνο listener ⇒ ένα timestamp write ⇒ το end το μηδενίζει ολοκληρωτικά.
    expect(isNavigationGesture()).toBe(false);
  });
});
