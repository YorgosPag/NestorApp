/**
 * Άγκυρες του **φύλακα εκτέλεσης** των αιτημάτων χάρτη (ADR-891 Φ1).
 */

const warn = jest.fn();
// Ο logger φτιάχνεται στη φόρτωση του module, ΠΡΙΝ αρχικοποιηθεί το `warn` (hoisting του jest.mock):
// το κλείσιμο το διαβάζει μόνο όταν κληθεί.
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    warn: (...args: unknown[]) => warn(...args),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  classifyMapRequest,
  observeMapRequest,
  resetMapRequestSentinel,
  withMapRequestSentinel,
} from '../basemap-request-sentinel';

const ORIGIN = 'https://nestorconstruct.gr';

describe('Α — η κρίση ενός αιτήματος', () => {
  it.each([
    ['data:image/png;base64,AAAA', 'local'],
    ['blob:https://nestorconstruct.gr/1234', 'local'],
    ['/data/admin-area-index.json', 'same-origin'],
    ['https://nestorconstruct.gr/api/x', 'same-origin'],
    ['https://tile.openstreetmap.org/5/17/12.png', 'declared'],
    ['https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json', 'declared'],
    ['https://tiles.stadiamaps.com/tiles/stamen_toner/1/1/1.png', 'undeclared'],
    ['https://api.mapbox.com/styles/v1/mapbox/streets-v12', 'undeclared'],
  ])('%s → %s', (url, verdict) => {
    expect(classifyMapRequest(url, ORIGIN).verdict).toBe(verdict);
  });

  it('εκτός περιηγητή (χωρίς προέλευση) ένα σχετικό URL δεν λύνεται ⇒ αδήλωτο, όχι σιωπή', () => {
    expect(classifyMapRequest('/data/x.json', null).verdict).toBe('undeclared');
  });
});

describe('Β — αναφέρει, ΜΙΑ φορά ανά διακομιστή, και δεν μπλοκάρει', () => {
  beforeEach(() => {
    warn.mockClear();
    resetMapRequestSentinel();
  });

  it('200 πλακίδια από τον ίδιο αδήλωτο διακομιστή ⇒ ΜΙΑ γραμμή', () => {
    for (let i = 0; i < 200; i += 1) observeMapRequest(`https://tiles.stadiamaps.com/${i}.png`, 'Tile');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toEqual({ host: 'tiles.stadiamaps.com', resourceType: 'Tile' });
  });

  it('δηλωμένος διακομιστής ⇒ καμία αναφορά', () => {
    observeMapRequest('https://tile.openstreetmap.org/1/1/1.png', 'Tile');
    expect(warn).not.toHaveBeenCalled();
  });

  it('χωρίς δικό του transformRequest ⇒ επιστρέφει undefined (η MapLibre κρατά το αίτημα ως έχει)', () => {
    expect(withMapRequestSentinel()('https://tiles.stadiamaps.com/1.png', 'Tile')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('με δικό του transformRequest ⇒ ο φύλακας κοιτάζει ΚΑΙ ο καταναλωτής αποφασίζει', () => {
    const own = jest.fn().mockReturnValue({ url: 'https://tile.openstreetmap.org/rewritten.png' });
    const result = withMapRequestSentinel(own)('https://tiles.stadiamaps.com/1.png', 'Tile');
    expect(own).toHaveBeenCalledWith('https://tiles.stadiamaps.com/1.png', 'Tile');
    expect(result).toEqual({ url: 'https://tile.openstreetmap.org/rewritten.png' });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
