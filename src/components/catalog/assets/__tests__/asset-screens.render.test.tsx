/**
 * @fileoverview **Η φόρμα εισαγωγής και ο επεξεργαστής μέσου, αποδοσμένα** (ADR-923 §5.10.4).
 *
 * Τι αποδεικνύεται: ο προέλεγχος κάθεται στη γραμμή του αρχείου (PDF σε ρόλο «φωτογραφία» ⇒ `fileKindMismatch`) και η
 * εκκίνηση ξεκινά **μόνο** τις καθαρές γραμμές· στον επεξεργαστή, αλλαγή είδους με δεμένο αρχείο που δεν ταιριάζει
 * κλειδώνει την αποθήκευση με το εύρημα στο πεδίο, και «έως ημερομηνία» χωρίς ημερομηνία κλειδώνει επίσης.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { FileRecord } from '@/types/file-record';
import { AssetEditor } from '../AssetEditor';
import { AssetIntakeSheet } from '../AssetIntakeSheet';
import type { AssetIntake } from '../use-asset-intake';
import { intakeRowsFor } from '../asset-intake-model';

jest.setTimeout(60_000);

// Το Radix Select ζητά pointer capture και scrollIntoView, που το jsdom δεν έχει.
beforeAll(() => {
  Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture: () => undefined, releasePointerCapture: () => undefined, scrollIntoView: () => undefined });
});

jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Νίκος' } }) }));
jest.mock('@/components/shared/files/FileThumbnail', () => ({ FileThumbnail: () => null }));
jest.mock('@/components/ui/date-picker-field', () => ({ DatePickerField: () => <span data-testid="date-picker" /> }));

const RIGHTS = {
  creator: { name: 'Νίκος', userId: 'u1', url: null },
  licensors: [],
  copyrightNotice: '© 2026 Νίκος',
  webStatementOfRights: null,
  license: { purpose: 'catalog-publication', term: { kind: 'perpetual' } },
} as const;

const asset: AssetRecord = {
  id: 'casst_sheet', companyId: 'comp_test', revision: 3, isDeleted: false, code: 'sheet', role: 'drawing', kind: 'document',
  labels: { el: 'Σχέδιο' }, description: {}, rights: RIGHTS, fileId: 'file_pdf',
  createdAt: '', createdBy: 'u1', updatedAt: '', updatedBy: 'u1', deletedAt: null, deletedBy: null,
};

const pdf = { id: 'file_pdf', ext: 'pdf', contentType: 'application/pdf', originalFilename: 'sheet.pdf', displayName: 'sheet', sizeBytes: 1000 } as FileRecord;

function ops(view: readonly AssetRecord[]): CatalogOptimistic<AssetRecord> {
  return { view, settled: view, pendingKeys: new Set(), submit: jest.fn() };
}

function intakeWith(files: readonly File[]): AssetIntake & { start: jest.Mock } {
  return {
    rows: intakeRowsFor(files, new Set(), (index) => `k${index}`),
    add: jest.fn(), patch: jest.fn(), remove: jest.fn(), clearDone: jest.fn(), replaceFile: jest.fn(), refreshRenditions: jest.fn(), start: jest.fn(async () => undefined),
  };
}

describe('Νέα μέσα', () => {
  it('Α1 — PDF ως «φωτογραφία» ⇒ εύρημα στη γραμμή μετά την απόπειρα· ξεκινά μόνο η καθαρή γραμμή', async () => {
    const files = [{ name: 'a.jpg', type: 'image/jpeg', size: 10 } as File, { name: 'b.pdf', type: 'application/pdf', size: 10 } as File];
    const intake = intakeWith(files);
    const forced = { ...intake, rows: [intake.rows[0], { ...intake.rows[1], role: 'photo' as const, kind: 'image' as const }] };
    render(<AssetIntakeSheet open onOpenChange={() => undefined} intake={forced} takenCodes={new Set()} />);
    expect(screen.queryByText('issues.fileKindMismatch')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'assets.intake.start' }));
    expect(intake.start).toHaveBeenCalledTimes(1);
    expect(intake.start.mock.calls[0][0].map((row: { key: string }) => row.key)).toEqual(['k0']);
    expect(screen.getByText('issues.fileKindMismatch')).toBeTruthy();
  });

  it('Α2 — τα select ρόλου/είδους έχουν προσβάσιμο όνομα (η κεφαλίδα του πίνακα δεν ονομάζει το πεδίο)', () => {
    const intake = intakeWith([{ name: 'plan.pdf', type: 'application/pdf', size: 10 } as File]);
    const drawing = { ...intake, rows: [{ ...intake.rows[0], role: 'drawing' as const, kind: 'document' as const }] };
    render(<AssetIntakeSheet open onOpenChange={() => undefined} intake={drawing} takenCodes={new Set()} />);
    expect(screen.getByRole('combobox', { name: 'assets.intake.columns.role' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'assets.editor.kind' })).toBeTruthy();
  });
});

describe('Επεξεργαστής μέσου', () => {
  const props = {
    record: asset, current: pdf, versions: [pdf], ops: ops([asset]), canManage: true, fileRow: null,
    onReplaceFile: jest.fn(), onRetryFile: jest.fn(), onRefreshRenditions: jest.fn(), onDeleted: jest.fn(), reportDirty: jest.fn(),
  };

  it('Β1 — σχέδιο: αλλαγή είδους σε «εικόνα» με δεμένο PDF ⇒ fileKindMismatch στο είδος, αποθήκευση κλειδωμένη', async () => {
    render(<AssetEditor {...props} />);
    await userEvent.click(screen.getAllByRole('combobox')[1]);
    await userEvent.click(await screen.findByRole('option', { name: 'assetKinds.image' }));
    expect(screen.getByText('issues.fileKindMismatch')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Β2 — άδεια «έως ημερομηνία» χωρίς ημερομηνία ⇒ αποθήκευση κλειδωμένη', async () => {
    render(<AssetEditor {...props} />);
    const comboboxes = screen.getAllByRole('combobox');
    await userEvent.click(comboboxes[comboboxes.length - 1]);
    await userEvent.click(await screen.findByRole('option', { name: 'assets.licence.termKinds.date' }));
    expect(screen.getByTestId('date-picker')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
