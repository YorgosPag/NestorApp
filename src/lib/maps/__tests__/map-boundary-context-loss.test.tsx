/**
 * @jest-environment jsdom
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — ο χάρτης του συνόρου επιζεί από απώλεια WebGL context** (ADR-891 §11).
 * @related lib/maps/maplibre.ts · docs/gates/3.75.md
 *
 * 🔴 **Παραγωγή, 2026-10-13 16:36:49 UTC, `/offers`**:
 * `TypeError: Cannot read properties of null (reading '_loaded')` στο
 * `_updateStyleComponents ← setProps ← layout effect`, πιασμένο από ErrorBoundary.
 *
 * 🔑 **Η αλυσίδα, δύο κρίκοι σε δύο ξένες βιβλιοθήκες**:
 * 1. Η MapLibre 5.x, στον χειριστή `webglcontextlost`, **καταστρέφει το στυλ και γράφει
 *    `this.style = null`** ώσπου να επανέλθει το context. Είναι το **μόνο** σημείο όπου το στυλ
 *    γίνεται `null` (το `remove()` το κάνει `undefined`) — άρα το μήνυμα ονομάζει την αιτία.
 * 2. Το περιτύλιγμα React (`@vis.gl/react-maplibre` 8.1.0) διάβαζε `map.style._loaded` **χωρίς
 *    φρουρό** σε **κάθε** απόδοση. Μία απόδοση μέσα στο παράθυρο απώλειας ⇒ πέφτει η επιφάνεια.
 *    Διορθώθηκε upstream στην **8.1.1** (`map.style?._loaded`).
 *
 * ⚠️ **Γιατί ΔΕΝ γίνεται mock το `react-map-gl/maplibre`** (όπως στη γειτονική άγκυρα της
 * απόδοσης): το ελάττωμα ζει **μέσα** στο περιτύλιγμα. Εδώ εκτελείται το **πραγματικό**
 * περιτύλιγμα πάνω σε ψεύτικη **μηχανή** (`mapLib`), γιατί το jsdom δεν έχει WebGL.
 *
 * ⚠️ **Και η ψεύτικη μηχανή δεν πιστεύεται στον λόγο της**: η ομάδα «προκείμενη» διαβάζει την
 * **εγκατεστημένη** MapLibre και απαιτεί να κάνει ακόμη αυτό που η ψεύτικη μιμείται.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | περιτύλιγμα 8.1.0 (χωρίς φρουρό) | η απόδοση μετά την απώλεια πέφτει ⇒ 🔴 (**μετρημένο**) |
 * | η MapLibre πάψει να μηδενίζει το στυλ στην απώλεια | η προκείμενη ⇒ 🔴 (η άγκυρα θέλει ξανασκέψιμο) |
 */

import { readFileSync } from 'node:fs';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { Map, type MapProps } from '../maplibre';

class FakeLngLat {
  constructor(readonly lng: number, readonly lat: number) {}
}

interface FakeStyle { readonly _loaded: boolean }

/** Ό,τι αγγίζει το περιτύλιγμα σε κατασκευή και `setProps` — και τίποτα παραπάνω. */
class FakeEngine {
  static readonly instances: FakeEngine[] = [];

  style: FakeStyle | null | undefined = { _loaded: true };
  readonly transform = {
    center: new FakeLngLat(0, 0), zoom: 0, pitch: 0, bearing: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }, width: 0, height: 0,
  };
  transformCameraUpdate: unknown = null;
  private readonly canvas = document.createElement('canvas');

  constructor() {
    FakeEngine.instances.push(this);
  }

  on(): this { return this; }
  off(): this { return this; }
  once(): this { return this; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  isMoving(): boolean { return false; }
  jumpTo(): void {}
  resize(): void {}
  remove(): void { this.style = undefined; }

  /** Ό,τι κάνει ο χειριστής `webglcontextlost` της MapLibre 5.x στο στυλ (βλ. «προκείμενη»). */
  loseContext(): void { this.style = null; }
}

const fakeMapLib = { Map: FakeEngine } as unknown as MapProps['mapLib'];

class Catch extends React.Component<{ readonly children: React.ReactNode }, { readonly error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    return this.state.error === null
      ? this.props.children
      : <p role="alert">{this.state.error.message}</p>;
  }
}

function Surface({ cursor }: { readonly cursor: string }): React.ReactElement {
  return (
    <Catch>
      <Map mapLib={fakeMapLib} mapStyle="https://example.test/style.json" cursor={cursor}>
        <span data-testid="overlay" />
      </Map>
    </Catch>
  );
}

async function mountMap(): Promise<{ readonly engine: FakeEngine; readonly rerender: (ui: React.ReactElement) => void }> {
  const { rerender } = render(<Surface cursor="default" />);
  // Τα παιδιά αποδίδονται μόνο αφού το περιτύλιγμα αποκτήσει μηχανή.
  await waitFor(() => expect(screen.getByTestId('overlay')).toBeInTheDocument());
  return { engine: FakeEngine.instances[FakeEngine.instances.length - 1], rerender };
}

beforeEach(() => {
  FakeEngine.instances.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('σύνορο χάρτη — απώλεια WebGL context', () => {
  it('απόδοση ΜΕΣΑ στο παράθυρο απώλειας (στυλ = null) δεν ρίχνει την επιφάνεια', async () => {
    const { engine, rerender } = await mountMap();
    engine.loseContext();

    rerender(<Surface cursor="crosshair" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('overlay')).toBeInTheDocument();
    // Η απόδοση ΕΦΤΑΣΕ στο περιτύλιγμα — αλλιώς το «δεν έπεσε» θα σήμαινε «δεν έτρεξε».
    expect(engine.getCanvas().style.cursor).toBe('crosshair');
  });

  it('μετά την επαναφορά του context ο χάρτης δέχεται props όπως πριν', async () => {
    const { engine, rerender } = await mountMap();
    engine.loseContext();
    rerender(<Surface cursor="crosshair" />);
    engine.style = { _loaded: true };

    rerender(<Surface cursor="grab" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(engine.getCanvas().style.cursor).toBe('grab');
  });
});

describe('προκείμενη — η εγκατεστημένη MapLibre κάνει ό,τι μιμείται η ψεύτικη μηχανή', () => {
  const source = readFileSync(require.resolve('maplibre-gl/dist/maplibre-gl-dev.js'), 'utf8');
  const handler = /this\._contextLost = \(event\) => \{([\s\S]*?)\n {8}\};/.exec(source)?.[1] ?? null;

  it('ο χειριστής `webglcontextlost` υπάρχει και μηδενίζει το στυλ', () => {
    expect(handler).not.toBeNull();
    expect(handler).toContain('this.style = null;');
  });
});
