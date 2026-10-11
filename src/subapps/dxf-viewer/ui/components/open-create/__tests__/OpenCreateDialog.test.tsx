/**
 * ADR-914 — το παράθυρο «Άνοιγμα / Δημιουργία»: τρεις ενότητες, πέντε κάρτες, και οι κανόνες που
 * λένε πότε μια κάρτα δουλεύει. Κλειδώνει και τη μετάφραση επιλογής οδηγού → δέσμευση.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { WizardCompleteMeta } from '@/features/floorplan-import';
import { OpenCreateDialog } from '../OpenCreateDialog';
import { buildOpenCreateSections, type OpenCreateAvailability } from '../open-create-cards';
import { wizardMetaToBinding } from '../wizard-meta-binding';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ lg: 'h-6 w-6', xl2: 'h-12 w-12' }),
}));
jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({
    quick: { card: 'rounded-lg border' },
    radius: { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg' },
  }),
}));

const ALL_ON: OpenCreateAvailability = { hasOpenLevel: true, openLevelIsBound: true, canImportFloorplan: true };
const t = (key: string) => key;
const card = (kind: string) => `panels.openCreate.cards.${kind}`;

describe('buildOpenCreateSections', () => {
  it('τρεις ενότητες με πέντε κάρτες, στη σειρά Δημιουργία · Άνοιγμα · Εισαγωγή', () => {
    const sections = buildOpenCreateSections(ALL_ON, t);

    expect(sections.map((s) => s.id)).toEqual(['create', 'open', 'import']);
    expect(sections.map((s) => s.cards.map((c) => c.id))).toEqual([
      ['draft', 'floorplanFor'],
      ['fromStorage'],
      ['importFloorplan', 'importMesh3d'],
    ]);
    expect(sections.flatMap((s) => s.cards).every((c) => !c.disabled)).toBe(true);
  });

  it('«Από την αποθήκη» ανενεργή — ΜΕ λόγο — όταν το ανοιχτό επίπεδο δεν είναι δεμένο', () => {
    const sections = buildOpenCreateSections({ ...ALL_ON, openLevelIsBound: false }, t);
    const fromStorage = sections[1].cards[0];

    expect(fromStorage.disabled).toBe(true);
    expect(fromStorage.disabledReason).toBe(`${card('fromStorage')}.disabledReason`);
  });

  it('«3Δ αρχείο» ανενεργή χωρίς ανοιχτό επίπεδο', () => {
    const sections = buildOpenCreateSections({ ...ALL_ON, hasOpenLevel: false }, t);
    const mesh = sections[2].cards.find((c) => c.id === 'importMesh3d');

    expect(mesh?.disabled).toBe(true);
    expect(mesh?.disabledReason).toBe(`${card('importMesh3d')}.disabledReason`);
  });

  it('«Κάτοψη DXF / PDF» δεν προσφέρεται όταν ο host δεν παραλαμβάνει σκηνές', () => {
    const sections = buildOpenCreateSections({ ...ALL_ON, canImportFloorplan: false }, t);
    expect(sections[2].cards.map((c) => c.id)).toEqual(['importMesh3d']);
  });

  it('οι δύο κάρτες δημιουργίας δεν εξαρτώνται από τίποτα — δουλεύουν και χωρίς κανένα επίπεδο', () => {
    const sections = buildOpenCreateSections(
      { hasOpenLevel: false, openLevelIsBound: false, canImportFloorplan: false },
      t,
    );
    expect(sections[0].cards.every((c) => !c.disabled)).toBe(true);
  });
});

describe('OpenCreateDialog', () => {
  it('αποδίδει τις ενότητες ως ομάδες καρτών και εκπέμπει το είδος της ενέργειας', () => {
    const onAction = jest.fn();
    render(<OpenCreateDialog open onOpenChange={jest.fn()} availability={ALL_ON} onAction={onAction} />);

    const create = screen.getByRole('list', { name: 'panels.openCreate.sections.create' });
    expect(within(create).getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /panels\.openCreate\.cards\./ })).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${card('draft')}.title`) }));
    expect(onAction).toHaveBeenCalledWith('draft');
  });

  it('η ανενεργή κάρτα δεν εκπέμπει και δείχνει τον λόγο της', () => {
    const onAction = jest.fn();
    render(
      <OpenCreateDialog
        open
        onOpenChange={jest.fn()}
        availability={{ ...ALL_ON, openLevelIsBound: false }}
        onAction={onAction}
      />,
    );

    const fromStorage = screen.getByRole('button', { name: new RegExp(`${card('fromStorage')}.title`) });
    expect(fromStorage).toBeDisabled();
    expect(fromStorage).toHaveTextContent(`${card('fromStorage')}.disabledReason`);
    fireEvent.click(fromStorage);
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('wizardMetaToBinding', () => {
  const base: Omit<WizardCompleteMeta, 'entityType' | 'entityId'> = {
    companyId: 'c1', projectId: 'p1', purpose: '', entityLabel: 'Ετικέτα',
  };

  it('όροφος ⇒ `storey` με όροφο ΚΑΙ κτήριο μαζί', () => {
    expect(wizardMetaToBinding({ ...base, entityType: 'floor', entityId: 'f1', floorId: 'f1', buildingId: 'b1' }, 'Κάτοψη'))
      .toEqual({ kind: 'storey', floorId: 'f1', buildingId: 'b1', projectId: 'p1', label: 'Ετικέτα' });
  });

  it('κτήριο ⇒ `building`· έργο ⇒ `project`', () => {
    expect(wizardMetaToBinding({ ...base, entityType: 'building', entityId: 'b1' }, 'Κάτοψη'))
      .toEqual({ kind: 'building', buildingId: 'b1', projectId: 'p1', label: 'Ετικέτα' });
    expect(wizardMetaToBinding({ ...base, entityType: 'project', entityId: 'p1' }, 'Κάτοψη'))
      .toEqual({ kind: 'project', projectId: 'p1', label: 'Ετικέτα' });
  });

  it('χωρίς ετικέτα παίρνει την εφεδρική του καλούντα', () => {
    const binding = wizardMetaToBinding({ ...base, entityLabel: undefined, entityType: 'project', entityId: 'p1' }, 'Κάτοψη');
    expect(binding).toMatchObject({ label: 'Κάτοψη' });
  });

  it('επιλογή χωρίς ταυτότητα ⇒ `null`, ποτέ μισή δέσμευση', () => {
    expect(wizardMetaToBinding({ ...base, entityType: 'building', entityId: '' }, 'Κάτοψη')).toBeNull();
  });

  it('ακίνητο ⇒ `property`· πολυεπίπεδη μονάδα παίρνει τον όροφο του ΕΠΙΠΕΔΟΥ της', () => {
    const meta = { ...base, entityType: 'property' as const, entityId: 'prop_1', floorId: 'f1', buildingId: 'b1' };
    expect(wizardMetaToBinding(meta, 'Κάτοψη')).toEqual({
      kind: 'property', propertyId: 'prop_1', floorId: 'f1', buildingId: 'b1', projectId: 'p1', label: 'Ετικέτα',
    });
    expect(wizardMetaToBinding({ ...meta, levelFloorId: 'f2' }, 'Κάτοψη')).toMatchObject({ floorId: 'f2' });
  });
});
