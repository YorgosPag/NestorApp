/**
 * ADR-280 §11.8 Β3 — η ειδοποίηση εισαγωγής DXF **δεν** κοστίζει στην οθόνη το namespace της στο mount.
 *
 * 🔴 Πριν: `useTranslation(['dxf-viewer'])` ⇒ ο hook φόρτωνε τον γονέα **και τα 6 compat splits** (594,5 KB) σε κάθε
 * οθόνη με καρτέλα αρχείων, για έναν τίτλο που εμφανίζεται μόνο μετά από επεξεργασία κάτοψης.
 * Εδώ κρίνεται και η αρχή (`translateOnDemand`) και ο καταναλωτής (το hook), με τον ΠΡΑΓΜΑΤΙΚΟ βοηθό.
 *
 * Μεταλλάξεις: (Μ1) το hook φορτώνει στο mount ⇒ Δ1 · (Μ2) ο βοηθός μεταφράζει πριν φτάσει το namespace ⇒ Δ3 ·
 * (Μ3) ο βοηθός φορτώνει με compat επέκταση / λάθος όνομα ⇒ Δ2 · (Μ4) φόρτωση χωρίς ρητό ns ⇒ Δ5.
 */
import { renderHook } from '@testing-library/react';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

const warning = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ warning }) }));

const pending: Array<() => void> = [];
const loadNamespace = jest.fn((_ns: string) => new Promise<void>((resolve) => { pending.push(resolve); }));
jest.mock('@/i18n/lazy-config', () => ({
  loadNamespace: (ns: string) => loadNamespace(ns),
  isSupportedNamespace: (value: string) => value === 'dxf-viewer',
}));

const translate = jest.fn((key: string, options: { count?: number }) => `«${key}·${options.count ?? ''}»`);
jest.mock('i18next', () => ({ __esModule: true, default: { t: (key: string, options: { count?: number }) => translate(key, options) } }));

import { useDxfImportNotifications } from '../useDxfImportNotifications';
import { translateOnDemand } from '@/i18n/translate-on-demand';

const KEY = NOTIFICATION_KEYS.dxfImport.importedWithWarnings;
const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const release = (): void => { pending.splice(0).forEach((resolve) => resolve()); };

beforeEach(() => {
  warning.mockClear();
  loadNamespace.mockClear();
  translate.mockClear();
  pending.length = 0;
});

describe('useDxfImportNotifications — namespace τη στιγμή της ειδοποίησης', () => {
  it('Δ1 — το mount ΔΕΝ ζητά κανένα namespace', () => {
    renderHook(() => useDxfImportNotifications());
    expect(loadNamespace).not.toHaveBeenCalled();
  });

  it('Δ2 — η ειδοποίηση ζητά ΜΟΝΟ το namespace του κλειδιού, και εμφανίζεται μεταφρασμένη', async () => {
    const { result } = renderHook(() => useDxfImportNotifications());
    result.current.importedWithWarnings(['LWPOLYLINE clamp', 'HATCH skipped']);
    expect(loadNamespace.mock.calls).toEqual([['dxf-viewer']]);
    release();
    await flush();
    expect(warning).toHaveBeenCalledWith(`«${KEY}·2»\nLWPOLYLINE clamp\nHATCH skipped`);
  });

  it('Δ3 — καμία μετάφραση πριν φτάσει το namespace', async () => {
    const { result } = renderHook(() => useDxfImportNotifications());
    result.current.importedWithWarnings(['x']);
    await flush();
    expect(translate).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
    release();
    await flush();
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('Δ4 — χωρίς προειδοποιήσεις: τίποτα (ούτε λήψη)', () => {
    const { result } = renderHook(() => useDxfImportNotifications());
    result.current.importedWithWarnings([]);
    result.current.importedWithWarnings(undefined);
    expect(loadNamespace).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });
});

describe('translateOnDemand — η αρχή', () => {
  it('Δ5 — κλειδί χωρίς ρητό namespace ⇒ καμία φόρτωση (δεν μαντεύουμε)', async () => {
    await expect(translateOnDemand('plain.key')).resolves.toBe('«plain.key·»');
    expect(loadNamespace).not.toHaveBeenCalled();
  });

  it('Δ6 — namespace που ο loader δεν ξέρει ⇒ καμία φόρτωση', async () => {
    await expect(translateOnDemand('unknown-ns:a.b')).resolves.toBe('«unknown-ns:a.b·»');
    expect(loadNamespace).not.toHaveBeenCalled();
  });
});
