/**
 * @fileoverview 📍 Η κάρτα «Θέση στον χάρτη» (ADR-920 §14.12 φάση Α): τι ρωτά, τι αφήνει να πατηθεί, και τι στέλνει.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | το ΕΓΣΑ '87 πατιέται ενώ η ανάγνωση δεν συμφωνεί | Κ2 |
 * | το κουτάκι θέσης ενεργό χωρίς δηλωμένο ΕΓΣΑ '87 | Κ3 |
 * | η κάρτα εμφανίζεται χωρίς ανάγλυφο | Κ5 |
 * | η πρόταση εφαρμόζεται μόνη της | Κ1 |
 * | το κουτάκι ανενεργό χωρίς γραμμένο λόγο · ο λόγος εμφανίζεται και όσο τρέχει πράξη | Κ3 · Κ6 |
 * | το κουτάκι ξαναμπαίνει στην ομάδα των ραδιοφώνων · φεύγει το διαχωριστικό | Κ8 |
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { TerrainGeoreferenceApi } from '@/hooks/listings/useTerrainGeoreference';
import type { TerrainGeoreferenceStatus } from '@/lib/terrain/publication/terrain-georeference-declaration';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values && Object.keys(values).length > 0 ? `${key} ${JSON.stringify(values)}` : key),
    i18n: { language: 'el' },
  }),
}));

import { TerrainGeoreferenceCard } from '../TerrainGeoreferenceCard';

const NS = 'terrain-survey:georeference';
const NEEDS_GREEK_GRID = `${NS}.showLocationInListing.needsGreekGrid`;
const AGREES = { kind: 'agrees', distanceM: 120, toleranceM: 279 } as const;

function statusOf(overrides: Partial<TerrainGeoreferenceStatus> = {}): TerrainGeoreferenceStatus {
  return { coordinateSystem: null, showLocationInListing: false, suggestion: 'EPSG:2100', greekGrid: AGREES, ...overrides };
}

function apiOf(status: TerrainGeoreferenceStatus | null, action: TerrainGeoreferenceApi['action'] = { kind: 'idle' }) {
  const amend = jest.fn(async () => undefined);
  const api: TerrainGeoreferenceApi = { view: { kind: 'ready', georeference: status }, action, amend };
  return { api, amend };
}

const greekGrid = () => screen.getByRole('radio', { name: `${NS}.system.greekGrid` });
const local = () => screen.getByRole('radio', { name: `${NS}.system.local` });
const consent = () => screen.getByRole('checkbox');

describe('TerrainGeoreferenceCard', () => {
  it('Κ1 — αδήλωτο: η πρόταση ΦΑΙΝΕΤΑΙ αλλά τίποτα δεν είναι επιλεγμένο και τίποτα δεν στέλνεται μόνο του', () => {
    const { api, amend } = apiOf(statusOf());
    render(<TerrainGeoreferenceCard api={api} />);

    expect(screen.getByText(`${NS}.system.suggestion.greekGrid`)).toBeInTheDocument();
    expect(screen.getByText(`${NS}.reading.agrees {"distance":"120","tolerance":"279"}`)).toBeInTheDocument();
    expect(greekGrid()).not.toBeChecked();
    expect(local()).not.toBeChecked();
    expect(amend).not.toHaveBeenCalled();

    fireEvent.click(greekGrid());
    expect(amend).toHaveBeenCalledWith({ kind: 'coordinate-system', system: 'EPSG:2100' });
  });

  it.each([
    ['far-from-listing', { kind: 'far-from-listing', distanceM: 3200, toleranceM: 279 }],
    ['outside-area-of-use', { kind: 'outside-area-of-use' }],
    ['listing-position-unknown', { kind: 'listing-position-unknown' }],
  ] as const)('Κ2 — ανάγνωση «%s»: το ΕΓΣΑ \'87 ΔΕΝ πατιέται, ο λόγος είναι γραμμένος, οι «τοπικές» μένουν διαθέσιμες', (kind, reading) => {
    const { api, amend } = apiOf(statusOf({ greekGrid: reading, suggestion: null }));
    const { container } = render(<TerrainGeoreferenceCard api={api} />);

    expect(container.querySelector(`[data-greek-grid-reading="${kind}"]`)).not.toBeNull();
    expect(greekGrid()).toBeDisabled();
    expect(local()).not.toBeDisabled();
    fireEvent.click(local());
    expect(amend).toHaveBeenCalledWith({ kind: 'coordinate-system', system: 'local' });
  });

  it('Κ3 — το κουτάκι θέσης είναι ανενεργό μέχρι να δηλωθεί ΕΓΣΑ \'87 — και με «τοπικές» επίσης — και ΛΕΕΙ γιατί', () => {
    const undeclared = render(<TerrainGeoreferenceCard api={apiOf(statusOf()).api} />);
    expect(consent()).toBeDisabled();
    expect(consent()).toHaveAccessibleDescription(expect.stringContaining(NEEDS_GREEK_GRID));
    undeclared.unmount();

    render(<TerrainGeoreferenceCard api={apiOf(statusOf({ coordinateSystem: 'local' })).api} />);
    expect(consent()).toBeDisabled();
    expect(local()).toBeChecked();
    expect(screen.getByText(NEEDS_GREEK_GRID)).toBeInTheDocument();
  });

  it('Κ8 — δύο ΟΝΟΜΑΣΜΕΝΕΣ ομάδες με διαχωριστικό: το κουτάκι δεν είναι τρίτη επιλογή συστήματος', () => {
    const { container } = render(<TerrainGeoreferenceCard api={apiOf(statusOf()).api} />);
    const system = screen.getByRole('group', { name: `${NS}.system.question` });
    const audience = screen.getByRole('group', { name: `${NS}.audience.heading` });

    expect(system).not.toBe(audience);
    expect(system).not.toContainElement(consent());
    expect(audience).toContainElement(consent());
    expect(audience).not.toContainElement(greekGrid());
    // Το διαχωριστικό στέκεται ΑΝΑΜΕΣΑ στις δύο ομάδες, στη σειρά του DOM.
    const separator = container.querySelector('[data-orientation="horizontal"]');
    expect(separator).not.toBeNull();
    expect(system.compareDocumentPosition(separator as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((separator as Element).compareDocumentPosition(audience) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Κ4 — δηλωμένο ΕΓΣΑ \'87: το κουτάκι στέλνει τη συγκατάθεση, και την άρση της', () => {
    const { api, amend } = apiOf(statusOf({ coordinateSystem: 'EPSG:2100' }));
    const first = render(<TerrainGeoreferenceCard api={api} />);
    expect(greekGrid()).toBeChecked();
    expect(consent()).not.toBeChecked();
    expect(consent()).not.toBeDisabled();
    expect(screen.queryByText(NEEDS_GREEK_GRID)).toBeNull();
    fireEvent.click(consent());
    expect(amend).toHaveBeenCalledWith({ kind: 'location-visibility', showInListing: true });
    first.unmount();

    const ticked = apiOf(statusOf({ coordinateSystem: 'EPSG:2100', showLocationInListing: true }));
    render(<TerrainGeoreferenceCard api={ticked.api} />);
    fireEvent.click(consent());
    expect(ticked.amend).toHaveBeenCalledWith({ kind: 'location-visibility', showInListing: false });
  });

  it('Κ5 — χωρίς ανάγλυφο η κάρτα δεν υπάρχει καθόλου', () => {
    const { container } = render(<TerrainGeoreferenceCard api={apiOf(null).api} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Κ6 — όσο τρέχει μια πράξη τίποτα δεν πατιέται· η άρνηση της πόρτας λέγεται με το όνομά της', () => {
    const acting = render(<TerrainGeoreferenceCard api={apiOf(statusOf({ coordinateSystem: 'EPSG:2100' }), { kind: 'acting' }).api} />);
    expect(greekGrid()).toBeDisabled();
    expect(local()).toBeDisabled();
    expect(consent()).toBeDisabled();
    // Ανενεργό επειδή τρέχει πράξη — όχι επειδή λείπει το σύστημα: ο λόγος «δήλωσε ΕΓΣΑ '87» εδώ θα ήταν ψέμα.
    expect(screen.queryByText(NEEDS_GREEK_GRID)).toBeNull();
    acting.unmount();

    const refused = apiOf(statusOf(), { kind: 'refused', refusal: 'TERRAIN_GEOREFERENCE_FAR_FROM_LISTING' });
    render(<TerrainGeoreferenceCard api={refused.api} />);
    expect(screen.getByRole('status')).toHaveTextContent('terrain-survey:publish.refusals.TERRAIN_GEOREFERENCE_FAR_FROM_LISTING');
  });

  it('Κ7 — φόρτωση και αποτυχία ανάγνωσης λέγονται· κανένα στοιχείο επιλογής δεν εμφανίζεται', () => {
    const loading: TerrainGeoreferenceApi = { view: { kind: 'loading' }, action: { kind: 'idle' }, amend: jest.fn() };
    const first = render(<TerrainGeoreferenceCard api={loading} />);
    expect(screen.getByText(`${NS}.loading`)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    first.unmount();

    const failed: TerrainGeoreferenceApi = { view: { kind: 'failed', refusal: 'network' }, action: { kind: 'idle' }, amend: jest.fn() };
    render(<TerrainGeoreferenceCard api={failed} />);
    expect(screen.getByRole('alert')).toHaveTextContent('terrain-survey:publish.refusals.network');
  });
});
