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
import type { BuildingObjectiveValues, BuildingObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';
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
const spaceWrites: unknown[] = [];
jest.mock('@/services/objective-value/space-position-mutation-gateway', () => ({
  updateSpaceObjectiveValuePositionWithPolicy: (write: unknown) => {
    spaceWrites.push(write);
    return Promise.resolve({ kind: 'saved' });
  },
}));

// Ο σύνδεσμος προς άλλο κτίριο (ADR-898 §20): απλό <a> — ο χώρος εργασίας δεν είναι το θέμα εδώ.
jest.mock('@/lib/workspace/navigation', () => ({
  ...jest.requireActual('@/lib/workspace/navigation'),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

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

const row = (id: string, floor: number | null, value: BuildingUnitObjectiveValue): BuildingObjectiveValueRow => ({
  id,
  kind: 'unit',
  name: id,
  type: 'apartment',
  floor,
  value,
  space: null,
});

/** Αποθήκη υπογείου της μονάδας `ownerUnitId`, με την απάντηση του χώρου (§19). */
const storageOf = (id: string, ownerUnitId: string, value: BuildingUnitObjectiveValue): BuildingObjectiveValueRow => ({
  ...row(id, -1, value),
  kind: 'storage',
  space: {
    ownerUnitId,
    ownerUnitName: null,
    ownerElsewhere: null,
    inclusion: 'included',
    declaredPosition: 'basementYardEntrance',
    position: { kind: 'fixed', position: 'basementYardEntrance', source: 'declared' },
  },
});

function values(rows: readonly BuildingObjectiveValueRow[], overrides: Partial<BuildingObjectiveValues> = {}): BuildingObjectiveValues {
  return {
    valuationDate: '2026-10-02',
    stage: { source: 'declared', stage: 'electricity' },
    facts: readBuildingObjectiveValueFacts({ declaredStage: 'electricity' }),
    rows,
    references: [],
    total: { kind: 'exact', value: 0, items: 0 },
    questions: [],
    ...overrides,
  };
}

async function renderTab(onNavigateToTab = jest.fn()) {
  render(<BuildingObjectiveValueTab buildingId="bld_1" buildingName="Κτίριο Α" onNavigateToTab={onNavigateToTab} />);
  await act(async () => { await Promise.resolve(); });
  return onNavigateToTab;
}

/** Η γραμμή ενός γεγονότος στην ενότητα «Γεγονότα κτιρίου» — δύο ομάδες Ναι/Όχι πλέον (ανελκυστήρας · θέρμανση). */
function factItem(fact: string): HTMLElement {
  const item = document.getElementById(`building-objective-value-fact-${fact}-item`);
  if (item === null) throw new Error(`fact ${fact} not rendered`);
  return item;
}

beforeEach(() => {
  writes.length = 0;
  spaceWrites.length = 0;
  get.mockClear();
  Element.prototype.scrollIntoView = jest.fn();
});

describe('BuildingObjectiveValueTab', () => {
  it('πλήρες κτίριο ⇒ το σύνολο του server και υποσύνολο ανά όροφο', async () => {
    response = values([row('A1', 1, exact(1000)), row('A2', 1, exact(500)), row('B1', 2, exact(250))], { total: { kind: 'exact', value: 1750, items: 3 } });
    await renderTab();
    expect(get).toHaveBeenCalledWith('/api/buildings/bld_1/objective-values');
    // Ψηφία, όχι μορφή: το διαχωριστικό χιλιάδων εξαρτάται από τη γλώσσα του περιβάλλοντος δοκιμής.
    expect(screen.getByText(/^1[.,]750\s?€$|^€1[.,]750$/)).toBeInTheDocument();
    expect(screen.getByText(/building\.group::.*"amount":"(1[.,]500\s?€|€1[.,]500)"/)).toBeInTheDocument();
  });

  it('έστω μία χωρίς ποσό ⇒ ΚΑΝΕΝΑ σύνολο, «λείπουν Ν από Μ» — και η γραμμή λέει γιατί', async () => {
    response = values([row('A1', 1, exact(1000)), row('A2', 1, range)], { total: { kind: 'incomplete', pending: 1, items: 2 } });
    await renderTab();
    expect(screen.getByText('objective-value:building.total.incomplete::{"pending":1,"items":2}')).toBeInTheDocument();
    expect(screen.queryByText(/1[.,]100/)).not.toBeInTheDocument();
    expect(screen.getByText(/groupIncomplete::.*"pending":1,"items":2/)).toBeInTheDocument();
    expect(screen.getByText(/building\.status\.range::/)).toBeInTheDocument();
  });

  it('απάντηση σε γεγονός ⇒ φαίνεται ΑΜΕΣΩΣ και φεύγει ΜΙΑ διόρθωση', async () => {
    response = values([row('A1', 4, range)], { total: { kind: 'incomplete', pending: 1, items: 1 }, questions: [{ fact: 'hasElevator', items: 1 }] });
    await renderTab();
    const elevator = within(factItem('hasElevator'));
    expect(elevator.getByRole('radio', { name: 'objective-value:questions.unset.undeclared' })).toBeChecked();
    const yes = elevator.getByRole('radio', { name: 'objective-value:questions.yes' });
    fireEvent.click(yes);
    expect(yes).toBeChecked();
    expect(writes.map((write) => write.patch)).toEqual([{ hasElevator: true }]);
    await act(async () => { writes[0].settle({ kind: 'saved' }); });
  });

  it('ανελκυστήρας = τρεις ΡΗΤΕΣ επιλογές · «δεν δηλώθηκε» αναιρεί ΑΠΟ ΤΟ ΙΔΙΟ χειριστήριο (ADR-898 §18.1)', async () => {
    const facts = readBuildingObjectiveValueFacts({ declaredStage: 'electricity', hasElevator: true });
    response = values([row('A1', 4, exact(10, ['hasElevator']))], { facts, total: { kind: 'exact', value: 10, items: 1 } });
    await renderTab();
    const unset = within(factItem('hasElevator')).getByRole('radio', { name: 'objective-value:questions.unset.undeclared' });
    expect(unset).not.toBeChecked();
    // Ένα «καθαρισμός» μόνο — του σταδίου· ο ανελκυστήρας δεν έχει δεύτερο δρόμο για την ίδια πράξη.
    expect(screen.getAllByRole('button', { name: 'objective-value:building.facts.clear' })).toHaveLength(1);
    fireEvent.click(unset);
    expect(unset).toBeChecked();
    expect(writes.map((write) => write.patch)).toEqual([{ hasElevator: null }]);
    await act(async () => { writes[0].settle({ kind: 'saved' }); });
  });

  it('κεντρική θέρμανση = γεγονός κτιρίου με το ΙΔΙΟ χειριστήριο · «Όχι» ⇒ ΜΙΑ διόρθωση (ADR-898 §18.3)', async () => {
    response = values([row('A1', 2, range)], { total: { kind: 'incomplete', pending: 1, items: 1 }, questions: [{ fact: 'hasCentralHeating', items: 1 }] });
    await renderTab();
    const heating = within(factItem('hasCentralHeating'));
    expect(heating.getByText('objective-value:building.facts.waiting::{"count":1}')).toBeInTheDocument();
    const no = heating.getByRole('radio', { name: 'objective-value:questions.no' });
    fireEvent.click(no);
    expect(no).toBeChecked();
    expect(writes.map((write) => write.patch)).toEqual([{ hasCentralHeating: false }]);
    await act(async () => { writes[0].settle({ kind: 'saved' }); });
  });

  it('στάδιο από το χρονοδιάγραμμα ⇒ δεν επεξεργάζεται εδώ · σύνδεσμος στο Gantt', async () => {
    response = values([row('A1', 1, exact(10))], { stage: { source: 'schedule', stage: 'frame' }, total: { kind: 'exact', value: 10, items: 1 } });
    const navigate = await renderTab();
    expect(screen.getByText(/facts\.stageFromSchedule::/)).toBeInTheDocument();
    expect(screen.queryByText('objective-value:building.facts.stageDeclaredHelp')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'objective-value:building.facts.openSchedule' }));
    expect(navigate).toHaveBeenCalledWith('timeline');
  });

  it('ανάλυση ανά μονάδα ⇒ συρτάρι με ό,τι ήρθε από το κτίριο', async () => {
    response = values([row('A1', 4, exact(1000, ['stage', 'hasElevator']))], { total: { kind: 'exact', value: 1000, items: 1 } });
    await renderTab();
    fireEvent.click(screen.getByRole('button', { name: /columns\.detailsFor::.*A1/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/inherited\.facts\.stage, objective-value:building\.inherited\.facts\.hasElevator/)).toBeInTheDocument();
  });

  it('μονάδα ⇒ τα παρακολουθήματά της και το ποσό «μαζί», με τον ΙΔΙΟ κανόνα · το σύνολο τα μετρά μία φορά (§19)', async () => {
    response = values([row('A1', 1, exact(1000)), storageOf('S1', 'A1', exact(250))], { total: { kind: 'exact', value: 1250, items: 2 } });
    await renderTab();
    fireEvent.click(screen.getByRole('button', { name: /columns\.detailsFor::.*"unit":"A1"/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /kinds\.storage · S1/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/relations\.bundle::.*"amount":"(1[.,]250\s?€|€1[.,]250)"/)).toBeInTheDocument();
  });

  it('χώρος ⇒ ανήκει σε μονάδα · η απάντηση θέσης καθαρίζεται από την πόρτα γραφής του χώρου', async () => {
    response = values([row('A1', 1, exact(1000)), storageOf('S1', 'A1', exact(250))], { total: { kind: 'exact', value: 1250, items: 2 } });
    await renderTab();
    fireEvent.click(screen.getByRole('button', { name: /columns\.detailsFor::.*"unit":"S1"/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/relations\.owner/)).toBeInTheDocument();
    expect(within(dialog).getByText(/space\.source\.declared/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'objective-value:building.space.clear' })); });
    expect(spaceWrites).toEqual([{ kind: 'storage', spaceId: 'S1', position: null }]);
  });

  it('χώρος σε ΑΛΛΟ κτίριο ⇒ αναφορά στο συρτάρι της μονάδας με σύνδεσμο · ΚΑΝΕΝΑ ποσό, έξω από τη δέσμη (§20)', async () => {
    response = values([row('A1', 1, exact(1000)), storageOf('S1', 'A1', exact(250))], {
      total: { kind: 'exact', value: 1250, items: 2 },
      references: [{ id: 'P5', kind: 'parking', name: 'Π-5', ownerUnitId: 'A1', ownerUnitName: 'A1', locatedIn: { buildingId: 'bld_2', label: 'Κτίριο Β' } }],
    });
    await renderTab();
    expect(screen.queryByText('Π-5')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /columns\.detailsFor::.*"unit":"A1"/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/kinds\.parking · Π-5/)).toBeInTheDocument();
    const link = within(dialog).getByRole('link', { name: /elsewhere\.locatedIn::.*"building":"Κτίριο Β"/ });
    expect(link).toHaveAttribute('href', '/buildings?buildingId=bld_2');
    // Η δέσμη μετρά ΜΟΝΟ ό,τι μετρά εδώ: 1000 + 250, όχι η Π-5.
    expect(within(dialog).getByText(/relations\.bundle::.*"amount":"(1[.,]250\s?€|€1[.,]250)"/)).toBeInTheDocument();
    expect(within(dialog).getByText('objective-value:building.elsewhere.bundleNote')).toBeInTheDocument();
  });

  it('χώρος ΕΔΩ με μονάδα ΑΛΛΟΥ κτιρίου ⇒ ο κάτοχος με όνομα και σύνδεσμο, ΟΧΙ «Χωρίς μονάδα» (§20)', async () => {
    const own = storageOf('S9', 'U9', exact(250));
    const elsewhere = { buildingId: 'bld_A', label: 'Κτίριο Α' };
    response = values([{ ...own, space: own.space && { ...own.space, ownerUnitName: 'Α3', ownerElsewhere: elsewhere } }], {
      total: { kind: 'exact', value: 250, items: 1 },
    });
    await renderTab();
    expect(screen.queryByText('objective-value:building.unattached')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /columns\.detailsFor::.*"unit":"S9"/ }));
    const dialog = await screen.findByRole('dialog');
    const link = within(dialog).getByRole('link', { name: /elsewhere\.owner::.*"unit":"Α3".*"building":"Κτίριο Α"/ });
    expect(link).toHaveAttribute('href', '/buildings?buildingId=bld_A');
  });
});
