/**
 * ADR-920 Β4.7 — ΑΓΚΥΡΕΣ του hook εισαγωγής τοπογραφικού (πραγματικός πυρήνας και client· ψεύτικο ΜΟΝΟ το δίκτυο).
 *
 *   Ε1  αρχείο ⇒ πρόταση στηλών + προτεινόμενη μονάδα ⇒ σημεία mm ⇒ ετυμηγορία της πόρτας, χωρίς κανένα κλικ
 *   Ε2  δεύτερο αρχείο πριν διαβαστεί το πρώτο ⇒ μετρά μόνο το τελευταίο
 *   Ε3  αλλαγή στήλης ⇒ η ετυμηγορία ακολουθεί (χωρίς X δεν υπάρχει τίποτα να κριθεί)
 *   Δ1  δήλωση που η πόρτα θα αρνιόταν ⇒ ίδιος κωδικός, ΚΑΜΙΑ αίτηση
 *   Δ2  δημοσίευση ⇒ `published` · ξανά με τα ίδια ⇒ το ΙΔΙΟ κλειδί · άλλη μονάδα ⇒ η επιτυχία δεν μένει στην οθόνη
 *   Δ3  χωρίς πόρτα (`null`) ⇒ δεν δημοσιεύεται τίποτα
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';

import { useTerrainSurveyImport, type SurveyFileInput, type TerrainSurveyDraft } from '../useTerrainSurveyImport';

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: jest.fn() } }));

const post = apiClient.post as jest.Mock;
const TARGET: TerrainPublishTarget = { kind: 'owner-property', ownerPropertyId: 'ownp_1' };
const DRAFT: TerrainSurveyDraft = { surveyorName: 'Τοπογράφος Α.Ε.', surveyedOn: '2026-09-01', rightsAffirmed: true };

const CSV = [
  'ΑΑ;Χ;Ψ;Υψόμετρο',
  '1;450000,000;4200000,000;100,000',
  '2;450030,000;4200000,000;101,000',
  '3;450030,000;4200020,000;102,500',
  '4;450000,000;4200020,000;101,500',
  '5;450015,000;4200010,000;101,200',
].join('\n');

function fileOf(name: string, text: string, gate?: Promise<void>): SurveyFileInput {
  const bytes = new TextEncoder().encode(text);
  return {
    name,
    arrayBuffer: async () => {
      await gate;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

const keyOf = (call: unknown[]): string => (call[2] as { headers: Record<string, string> }).headers[IDEMPOTENCY_KEY_HEADER];

beforeEach(() => {
  jest.clearAllMocks();
  post.mockResolvedValue({ fileId: 'file_t1', supersedes: [], archived: [], listing: 'published' });
});

async function loaded(target: TerrainPublishTarget | null = TARGET) {
  const hook = renderHook(() => useTerrainSurveyImport(target));
  await act(() => hook.result.current.loadFile(fileOf('survey.csv', CSV)));
  return hook;
}

describe('Ε — από το αρχείο στην ετυμηγορία', () => {
  it('Ε1 πρόταση στηλών, προτεινόμενη μονάδα, σημεία mm, ετυμηγορία', async () => {
    const { result } = await loaded();
    expect(result.current.mapping).toStrictEqual(['pointId', 'x', 'y', 'z']);
    expect(result.current.unit).toBe('m');
    expect(result.current.unitDecision).toStrictEqual({ kind: 'to-confirm', suggestion: { unit: 'm', evidence: 'greek-grid' } });
    expect(result.current.points.points).toHaveLength(5);
    expect(result.current.preparation?.ok).toBe(true);
    expect(result.current.canPublish).toBe(true);
  });

  it('Ε2 μετρά μόνο το τελευταίο αρχείο', async () => {
    const { result } = renderHook(() => useTerrainSurveyImport(TARGET));
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => { release = resolve; });

    let first: Promise<void> = Promise.resolve();
    act(() => { first = result.current.loadFile(fileOf('old.csv', 'α;β\n1;2', slow)); });
    await act(() => result.current.loadFile(fileOf('survey.csv', CSV)));
    await act(async () => { release(); await first; });

    expect(result.current.fileName).toBe('survey.csv');
    expect(result.current.points.points).toHaveLength(5);
  });

  it('Ε3 χωρίς στήλη X δεν υπάρχει τίποτα να κριθεί', async () => {
    const { result } = await loaded();
    act(() => result.current.setRole(1, 'ignore'));
    expect(result.current.points.points).toStrictEqual([]);
    expect(result.current.preparation).toBeNull();
    expect(result.current.canPublish).toBe(false);
  });
});

describe('Δ — η δημοσίευση', () => {
  it('Δ1 δήλωση που η πόρτα θα αρνιόταν ⇒ ο ίδιος κωδικός, καμία αίτηση', async () => {
    const { result } = await loaded();
    await act(() => result.current.publish({ ...DRAFT, rightsAffirmed: false }));
    expect(result.current.publication).toStrictEqual({ kind: 'refused', refusal: 'TERRAIN_DECLARATION_INVALID' });

    await act(() => result.current.publish({ ...DRAFT, surveyedOn: '2999-01-01' }));
    expect(result.current.publication).toStrictEqual({ kind: 'refused', refusal: 'TERRAIN_SURVEY_DATE_IN_FUTURE' });
    expect(post).not.toHaveBeenCalled();
  });

  it('Δ2 published · ίδιο κλειδί στην επανάληψη · άλλη μονάδα ⇒ καμία μπαγιάτικη επιτυχία', async () => {
    const { result } = await loaded();
    await act(() => result.current.publish(DRAFT));
    expect(result.current.publication).toStrictEqual({ kind: 'published', fileId: 'file_t1', listing: 'published' });

    await act(() => result.current.publish(DRAFT));
    expect(keyOf(post.mock.calls[1])).toBe(keyOf(post.mock.calls[0]));

    act(() => result.current.setUnit('mm'));
    expect(result.current.publication).toStrictEqual({ kind: 'idle' });
  });

  it('Δ3 χωρίς πόρτα δεν δημοσιεύεται τίποτα', async () => {
    const { result } = await loaded(null);
    expect(result.current.canPublish).toBe(false);
    await act(() => result.current.publish(DRAFT));
    expect(post).not.toHaveBeenCalled();
  });
});
