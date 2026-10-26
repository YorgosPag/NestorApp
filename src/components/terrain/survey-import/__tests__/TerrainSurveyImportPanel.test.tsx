/**
 * ADR-920 Β4.9 — ΑΓΚΥΡΕΣ του πάνελ «Τοπογραφικό» πάνω στον ΠΡΑΓΜΑΤΙΚΟ hook, πυρήνα εισαγωγής και client
 * (ψεύτικα ΜΟΝΟ: το δίκτυο, οι λέξεις, η ζώνη μεταφοράς αρχείων — δικό της component με δικά του tests).
 *
 *   Φ1  οι χώροι ονομάτων δεν φόρτωσαν ⇒ μόνο το «φορτώνει», κανένα ωμό κλειδί
 *   Φ2  τίποτα δημοσιευμένο ⇒ το λέει, και ζητά αρχείο
 *   Ρ1  CSV ⇒ πίνακας στηλών · προτεινόμενη μονάδα ΜΕ αιτιολόγηση · πλήθος σημείων · χάρτης · ΙΔΙΟΙ αριθμοί με το στιγμιότυπο
 *   Ρ2  αρχείο που δεν διαβάζεται ⇒ η ΠΡΑΞΗ με λέξεις (`alert`), κανένας πίνακας
 *   Ρ3  γραμμές που δεν έγιναν σημεία ⇒ με τον ΑΡΙΘΜΟ τους
 *   Ρ4  χωρίς Χ/Ψ ⇒ το λέει, κανένα σημείο, κανένας χάρτης
 *   Δ1  το κουμπί περιμένει ΟΛΗ τη δήλωση (και το δικαίωμα) · υποβολή ⇒ μία αίτηση ⇒ η έκβαση της αγγελίας με λέξεις
 *   Δ2  χωρίς πόρτα ⇒ η προεπισκόπηση μένει, στη θέση της φόρμας λέγεται τι λείπει
 *   Δ3  δημοσιευμένο έδαφος ⇒ πηγή + αριθμοί του, και το κουμπί λέει «αντικατάσταση»
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { SURVEY_CSV, SURVEY_CSV_HEADER, SURVEY_CSV_ROWS, surveyFileOf } from '@/hooks/listings/__tests__/terrain-survey-file-fixture';
import type { SurveyFileInput } from '@/hooks/listings/useTerrainSurveyImport';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ListingTerrainCard } from '@/lib/terrain/publication/listing-terrain-card';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';

import { TerrainSurveyImportPanel } from '../TerrainSurveyImportPanel';

const ready = { current: true };
jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  return { useTranslation: () => ({ t, isNamespaceReady: ready.current, i18n: { language: 'el' } }) };
});
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: jest.fn() } }));

/** Η ζώνη μεταφοράς: ένα κουμπί που «αφήνει» το επόμενο αρχείο. */
const dropped: { file: SurveyFileInput | null } = { file: null };
jest.mock('@/components/shared/files/FileUploadZone', () => ({
  FileUploadZone: ({ onUpload }: { readonly onUpload: (files: unknown[]) => Promise<void> }) => (
    <button type="button" onClick={() => void onUpload([dropped.file])}>drop</button>
  ),
}));

const post = apiClient.post as jest.Mock;
const TARGET: TerrainPublishTarget = { kind: 'owner-property', ownerPropertyId: 'ownp_1' };
const S = 'listing-detail:terrain.stats';

const PUBLISHED: ListingTerrainCard = {
  snapshotVersion: 1,
  stats: { planAreaM2: 1240, minElevationM: 100, maxElevationM: 106.4, reliefM: 6.4, meanSlopePct: 11, maxSlopePct: 24, downslopeAzimuthDeg: 180 },
  contourIntervalM: 0.5,
  envelope: null,
  survey: { surveyorName: 'Τοπογράφος Α.Ε.', surveyedOn: '2026-09-01' },
};

beforeEach(() => {
  jest.clearAllMocks();
  ready.current = true;
  post.mockResolvedValue({ fileId: 'file_t1', supersedes: [], archived: [], listing: 'published' });
});

function renderPanel(target: TerrainPublishTarget | null = TARGET, published: ListingTerrainCard | null = null) {
  return render(<TerrainSurveyImportPanel target={target} published={published} pending={<p>pending</p>} />);
}

async function drop(file: SurveyFileInput) {
  dropped.file = file;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'drop' })); });
}

/** Περιμένει ώσπου ο χάρτης να είναι ο τρέχων (η ετυμηγορία του ΙΔΙΟΥ στιγμιοτύπου). */
async function settled() {
  await waitFor(() => expect(screen.getByLabelText('listing-detail:terrain.map.preview.label')).toHaveAttribute('aria-busy', 'false'));
}

describe('Φ — πριν από το αρχείο', () => {
  it('Φ1 οι χώροι ονομάτων δεν φόρτωσαν ⇒ μόνο το «φορτώνει»', () => {
    ready.current = false;
    renderPanel();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.queryByText(/terrain-survey:/)).toBeNull();
  });

  it('Φ2 τίποτα δημοσιευμένο ⇒ το λέει, και ζητά αρχείο', () => {
    renderPanel();
    expect(screen.getByText('terrain-survey:current.none')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'drop' })).toBeInTheDocument();
  });
});

describe('Ρ — από το αρχείο στα σημεία', () => {
  it('Ρ1 πίνακας, μονάδα με αιτιολόγηση, σημεία, χάρτης, οι αριθμοί του στιγμιοτύπου', async () => {
    renderPanel();
    await drop(surveyFileOf('survey.csv', SURVEY_CSV));
    await settled();
    expect(screen.getByRole('table', { name: 'terrain-survey:columns.caption' })).toBeInTheDocument();
    expect(screen.getByText(/^terrain-survey:unit\.suggested\.greek-grid/)).toBeInTheDocument();
    expect(screen.getByText(/^terrain-survey:points\.summary::\{"points":5,"withElevation":5\}/)).toBeInTheDocument();
    expect(document.querySelector('figure[data-terrain-contour-map]')).not.toBeNull();
    expect(screen.getByText(`${S}.relief`)).toBeInTheDocument();
  });

  it('Ρ2 αρχείο που δεν διαβάζεται ⇒ η πράξη με λέξεις, κανένας πίνακας', async () => {
    renderPanel();
    await drop(surveyFileOf('old.xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])));
    expect(await screen.findByRole('alert')).toHaveTextContent('terrain-survey:read.refusals.xls-legacy');
    expect(screen.queryByRole('table', { name: 'terrain-survey:columns.caption' })).toBeNull();
  });

  it('Ρ3 γραμμές που δεν έγιναν σημεία ⇒ με τον αριθμό τους', async () => {
    renderPanel();
    await drop(surveyFileOf('survey.csv', [SURVEY_CSV_HEADER, ...SURVEY_CSV_ROWS, 'σημείωση;χωρίς;αριθμούς;-'].join('\n')));
    await settled();
    expect(screen.getByText(/^terrain-survey:points\.skipped::\{"count":1,"rows":"6"\}/)).toBeInTheDocument();
  });

  it('Ρ4 χωρίς Χ/Ψ ⇒ το λέει, κανένα σημείο, κανένας χάρτης', async () => {
    renderPanel();
    await drop(surveyFileOf('survey.csv', ['α;β;γ', 'κείμενο;χωρίς;αριθμούς'].join('\n')));
    expect(await screen.findByText('terrain-survey:points.noPosition')).toBeInTheDocument();
    expect(screen.queryByLabelText('listing-detail:terrain.map.preview.label')).toBeNull();
  });
});

describe('Δ — δήλωση και δημοσίευση', () => {
  function fillSurveyor() {
    fireEvent.change(screen.getByLabelText('terrain-survey:declaration.surveyorName'), { target: { value: 'Τοπογράφος Α.Ε.' } });
    fireEvent.change(screen.getByLabelText('terrain-survey:declaration.surveyedOn'), { target: { value: '2026-09-01' } });
  }

  const affirmRights = () => fireEvent.click(screen.getByRole('checkbox', { name: 'terrain-survey:declaration.rights' }));

  it('Δ1 το κουμπί περιμένει τη δήλωση · υποβολή ⇒ μία αίτηση ⇒ η έκβαση με λέξεις', async () => {
    renderPanel();
    await drop(surveyFileOf('survey.csv', SURVEY_CSV));
    await settled();
    const submit = screen.getByRole('button', { name: 'terrain-survey:publish.action' });
    expect(submit).toBeDisabled();
    fillSurveyor();
    // Χωρίς τη δήλωση δικαιώματος (Δ2) δεν φεύγει τίποτα — ούτε με τοπογράφο και ημερομηνία.
    expect(submit).toBeDisabled();
    affirmRights();
    expect(submit).toBeEnabled();
    await act(async () => { fireEvent.click(submit); });
    expect(post).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('terrain-survey:publish.listing.published')).toBeInTheDocument();
  });

  it('Δ2 χωρίς πόρτα ⇒ η προεπισκόπηση μένει, στη θέση της φόρμας λέγεται τι λείπει', async () => {
    renderPanel(null);
    await drop(surveyFileOf('survey.csv', SURVEY_CSV));
    await settled();
    expect(screen.getByText('terrain-survey:publish.unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terrain-survey:publish\./ })).toBeNull();
  });

  it('Δ3 δημοσιευμένο έδαφος ⇒ πηγή και αριθμοί του, και «αντικατάσταση»', async () => {
    renderPanel(TARGET, PUBLISHED);
    expect(screen.getByText(/^terrain-survey:current\.survey::\{"name":"Τοπογράφος Α\.Ε\."/)).toBeInTheDocument();
    expect(screen.getByText(`${S}.towards.south`)).toBeInTheDocument();
    await drop(surveyFileOf('survey.csv', SURVEY_CSV));
    await settled();
    expect(screen.getByRole('button', { name: 'terrain-survey:publish.replace' })).toBeInTheDocument();
  });
});
