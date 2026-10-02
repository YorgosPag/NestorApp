/**
 * ADR-898 Φ4β — **η καρτέλα «Αντικειμενική» του κτιρίου**, από άκρη σε άκρη πάνω στα πραγματικά συστατικά: στελέχη
 * μόνο ο server (ανάγνωση) και η πόρτα γραφής των γεγονότων.
 *
 * Τι αποδεικνύει: (1) σύνολο **μόνο** όταν είναι αληθινό — αλλιώς «λείπουν Ν από Μ», ποτέ μερικό άθροισμα · (2) ομάδες
 * ανά όροφο με υποσύνολο μόνο πλήρους ορόφου · (3) κάθε γραμμή λέει **γιατί** δεν έχει ποσό · (4) η απάντηση σε γεγονός
 * φαίνεται **αμέσως** και φεύγει **μία** διόρθωση · (5) στάδιο από το χρονοδιάγραμμα ⇒ όχι επεξεργασία, σύνδεσμος στο
 * Gantt · (6) ανάλυση ανά μονάδα με ό,τι ήρθε από το κτίριο.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
import { readBuildingObjectiveValueFacts, type BuildingObjectiveValuePatch } from '@/lib/objective-value/building-objective-value-facts';
import type { BuildingObjectiveValues, BuildingUnitObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';
import type { ObjectiveValueWriteOutcome } from '@/lib/objective-value/objective-value-improve-subject';

import { BuildingObjectiveValueTab } from '../BuildingObjectiveValueTab';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

let response: BuildingObjectiveValues;
const get = jest.fn(() => Promise.resolve(response));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (...args: unknown[]) => get(...(args as [])) } }));

const writes: { patch: BuildingObjectiveValuePatch; settle: (outcome: ObjectiveValueWriteOutcome) => void }[] = [];
jest.mock('@/services/building/building-mutation-gateway', () => ({
  updateBuildingObjectiveValueFactsWithPolicy: ({ patch }: { patch: BuildingObjectiveValuePatch }) =>
    new Promise<ObjectiveValueWriteOutcome>((settle) => writes.push({ patch, settle })),
}));

const exact = (value: number, inherited: readonly ('stage' | 'hasElevator')[] = []): BuildingUnitObjectiveValue => ({
  kind: 'evaluated',
  bounds: { kind: 'exact', commercialityAssumed: false, result: { kind: 'computed', form: 'residence', value, zonePrice: 2000, area: 90, factors: [] } },
  levelBasis: { kind: 'single' },
  assumptions: [],
  inherited,
});

const range: BuildingUnitObjectiveValue = {
  kind: 'evaluated',
  bounds: { kind: 'range', low: 100, high: 120, open: ['hasElevator'], commercialityAssumed: false },
  levelBasis: { kind: 'single' },
  assumptions: [],
  inherited: ['stage'],
};

const row = (id: string, floor: number | null, value: BuildingUnitObjectiveValue): BuildingUnitObjectiveValueRow => ({ id, name: id, type: 'apartment', floor, value });

function values(units: readonly BuildingUnitObjectiveValueRow[], overrides: Partial<BuildingObjectiveValues> = {}): BuildingObjectiveValues {
  return {
    valuationDate: '2026-10-02',
    stage: { source: 'declared', stage: 'electricity' },
    facts: readBuildingObjectiveValueFacts({ declaredStage: 'electricity' }),
    units,
    total: { kind: 'exact', value: 0, units: 0 },
    questions: [],
    ...overrides,
  };
}

async function renderTab(onNavigateToTab = jest.fn()) {
  render(<BuildingObjectiveValueTab buildingId="bld_1" buildingName="Κτίριο Α" onNavigateToTab={onNavigateToTab} />);
  await act(async () => { await Promise.resolve(); });
  return onNavigateToTab;
}

beforeEach(() => {
  writes.length = 0;
  get.mockClear();
  Element.prototype.scrollIntoView = jest.fn();
});

describe('BuildingObjectiveValueTab', () => {
  it('πλήρες κτίριο ⇒ το σύνολο του server και υποσύνολο ανά όροφο', async () => {
    response = values([row('A1', 1, exact(1000)), row('A2', 1, exact(500)), row('B1', 2, exact(250))], { total: { kind: 'exact', value: 1750, units: 3 } });
    await renderTab();
    expect(get).toHaveBeenCalledWith('/api/buildings/bld_1/objective-values');
    // Ψηφία, όχι μορφή: το διαχωριστικό χιλιάδων εξαρτάται από τη γλώσσα του περιβάλλοντος δοκιμής.
    expect(screen.getByText(/^1[.,]750\s?€$|^€1[.,]750$/)).toBeInTheDocument();
    expect(screen.getByText(/floorGroup::.*"amount":"(1[.,]500\s?€|€1[.,]500)"/)).toBeInTheDocument();
  });

  it('έστω μία χωρίς ποσό ⇒ ΚΑΝΕΝΑ σύνολο, «λείπουν Ν από Μ» — και η γραμμή λέει γιατί', async () => {
    response = values([row('A1', 1, exact(1000)), row('A2', 1, range)], { total: { kind: 'incomplete', pending: 1, units: 2 } });
    await renderTab();
    expect(screen.getByText('objective-value:building.total.incomplete::{"pending":1,"units":2}')).toBeInTheDocument();
    expect(screen.queryByText(/1[.,]100/)).not.toBeInTheDocument();
    expect(screen.getByText(/floorGroupIncomplete::.*"pending":1,"units":2/)).toBeInTheDocument();
    expect(screen.getByText(/building\.status\.range::/)).toBeInTheDocument();
  });

  it('απάντηση σε γεγονός ⇒ φαίνεται ΑΜΕΣΩΣ και φεύγει ΜΙΑ διόρθωση', async () => {
    response = values([row('A1', 4, range)], { total: { kind: 'incomplete', pending: 1, units: 1 }, questions: [{ fact: 'hasElevator', units: 1 }] });
    await renderTab();
    const yes = screen.getAllByRole('radio')[0];
    fireEvent.click(yes);
    expect(yes).toBeChecked();
    expect(writes.map((write) => write.patch)).toEqual([{ hasElevator: true }]);
    await act(async () => { writes[0].settle({ kind: 'saved' }); });
  });

  it('στάδιο από το χρονοδιάγραμμα ⇒ δεν επεξεργάζεται εδώ · σύνδεσμος στο Gantt', async () => {
    response = values([row('A1', 1, exact(10))], { stage: { source: 'schedule', stage: 'frame' }, total: { kind: 'exact', value: 10, units: 1 } });
    const navigate = await renderTab();
    expect(screen.getByText(/facts\.stageFromSchedule::/)).toBeInTheDocument();
    expect(screen.queryByText('objective-value:building.facts.stageDeclaredHelp')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'objective-value:building.facts.openSchedule' }));
    expect(navigate).toHaveBeenCalledWith('timeline');
  });

  it('ανάλυση ανά μονάδα ⇒ συρτάρι με ό,τι ήρθε από το κτίριο', async () => {
    response = values([row('A1', 4, exact(1000, ['stage', 'hasElevator']))], { total: { kind: 'exact', value: 1000, units: 1 } });
    await renderTab();
    fireEvent.click(screen.getByRole('button', { name: /columns\.detailsFor::.*A1/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/inherited\.facts\.stage, objective-value:building\.inherited\.facts\.hasElevator/)).toBeInTheDocument();
  });
});
