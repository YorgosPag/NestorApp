/**
 * @jest-environment jsdom
 *
 * @fileoverview Άγκυρες της **δήλωσης κάτοψης ορόφου στον χώρο** (ADR-907 §11.10).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | ΔΧ-1 | ανάγνωση που απέτυχε ⇒ **σιωπή**, και καμία ανάγνωση αρχείων | πάνελ που μαντεύει «δεν υπάρχει δήλωση» |
 * | ΔΧ-2 | χωρίς δικαίωμα ⇒ κατάσταση **χωρίς** κουμπιά | κουμπί που θα έπαιρνε `403` |
 * | ΔΧ-3 | υπογραφή **μόνο** με εικόνα **και** δήλωση· η εικόνα φεύγει με το όνομά της | υπογραφή με ένα κλικ · λάθος `fileId` |
 * | ΔΧ-4 | με δύο εικόνες δεν διαλέγουμε εμείς· μη εικόνα δεν προσφέρεται· μη δημόσια **σημαίνεται** | σιωπηλή προεπιλογή · PDF στη λίστα |
 * | ΔΧ-5 | άρνηση ⇒ **η πρόταση της** και το περίγραμμα, η φόρμα μένει | «δοκίμασε ξανά» χωρίς λόγο |
 * | ΔΧ-6 | άλλη αποτυχία ⇒ «απέτυχε», ποτέ πρόταση άρνησης | ξένο σφάλμα μεταφρασμένο ως άρνηση |
 * | ΔΧ-7 | δήλωση ⇒ ποιος · πότε (`<time>`) · ποια εικόνα | υπογραφή χωρίς υπογράφοντα |
 * | ΔΧ-8 | άρση **μόνο** μετά από επιβεβαίωση, από την **ίδια** πόρτα | άρση με ένα κλικ · ακύρωση που γράφει |
 * | ΔΧ-9 | δήλωση που η εικόνα της έφυγε ⇒ προειδοποίηση | «όλα καλά» ενώ η κάτοψη δεν φαίνεται |
 *
 * Τα Radix Select / Checkbox / ConfirmDialog αντικαθίστανται από εγγενή στοιχεία: ελέγχεται ο **καλών**, όχι η βιβλιοθήκη.
 * Τα hooks της πόρτας και της ανάγνωσης αρχείων είναι τα **αληθινά** — ψεύτικο είναι μόνο το σύρμα.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { FILE_CLASSIFICATIONS, FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import { ApiClientError } from '@/lib/api/api-client-types';
import { floorPlateRefusalBody } from '@/lib/listings/floor-plate/floor-plate-refusal';
import type { FileRecord } from '@/types/file-record';

const apiGet = jest.fn();
const apiPost = jest.fn();
const apiDelete = jest.fn();
const getFilesByEntity = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));
jest.mock('@/services/file-record.service', () => ({
  FileRecordService: { getFilesByEntity: (...args: unknown[]) => getFilesByEntity(...args) },
}));
jest.mock('@/services/realtime', () => ({ RealtimeService: { subscribe: () => () => undefined } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));
jest.mock('@/hooks/useFileDisplayName', () => ({
  useFileDisplayName: () => (file: { displayName: string }) => file.displayName,
}));
jest.mock('@/hooks/useUserDisplayNames', () => ({
  useUserDisplayNames: (uids: string[]) => new Map(uids.filter((uid) => uid === 'uid_maria').map((uid) => [uid, 'Μαρία Π.'])),
}));
jest.mock('@/components/ui/select', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (next: string) => void; children?: React.ReactNode }) => (
      <select aria-label="image" value={value} onChange={(event) => onValueChange(event.target.value)}>
        <option value="">—</option>
        {children}
      </select>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: Pass,
    SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => <option value={value}>{children}</option>,
  };
});
jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange, 'aria-describedby': describedBy }: {
    id?: string; checked?: boolean; onCheckedChange?: (value: boolean) => void; 'aria-describedby'?: string;
  }) => (
    <input id={id} type="checkbox" aria-describedby={describedBy} checked={checked === true}
      onChange={(event) => onCheckedChange?.(event.target.checked)} />
  ),
}));
jest.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) =>
    open ? (
      <section role="alertdialog">
        <button type="button" onClick={() => { onConfirm(); onOpenChange(false); }}>confirm</button>
        <button type="button" onClick={() => onOpenChange(false)}>cancel</button>
      </section>
    ) : null,
}));

import { FloorPlateDeclaration } from '../FloorPlateDeclaration';
import { chosenFloorPlateImageId } from '../FloorPlateSigningForm';

const K = 'tabs.floors.floorPlate';
const ROUTE = '/api/floors/floor_1/floor-plate';

function fileOf(id: string, over: Partial<FileRecord> = {}): FileRecord {
  return {
    id,
    displayName: `${id}.png`,
    entityType: 'floor',
    entityId: 'floor_1',
    contentType: 'image/png',
    storagePath: `companies/c1/${id}.png`,
    status: FILE_STATUS.READY,
    lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
    isDeleted: false,
    classification: FILE_CLASSIFICATIONS.PUBLIC,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...over,
  } as FileRecord;
}

const SIGNED = { fileId: 'img_a', declaredBy: 'uid_maria', declaredAt: '2026-10-10T09:30:00.000Z' };

function arrange(status: { declaration: typeof SIGNED | null; mayDeclare: boolean } | Error, files: FileRecord[] = [fileOf('img_a')]): void {
  if (status instanceof Error) apiGet.mockRejectedValue(status);
  else apiGet.mockResolvedValue({ floorId: 'floor_1', ...status });
  getFilesByEntity.mockResolvedValue(files);
}

function mount(): ReturnType<typeof render> {
  return render(<FloorPlateDeclaration floorId="floor_1" companyId="c1" />);
}

const signButton = (): HTMLElement => screen.getByRole('button', { name: `${K}.declare` });
const statement = (): HTMLElement => screen.getByRole('checkbox');
const picker = (): HTMLSelectElement => screen.getByRole('combobox', { name: 'image' }) as HTMLSelectElement;

beforeEach(() => { jest.clearAllMocks(); });

describe('FloorPlateDeclaration', () => {
  it('ΔΧ-1 — ανάγνωση που απέτυχε: τίποτα στην οθόνη, καμία ανάγνωση αρχείων', async () => {
    arrange(new Error('network'));
    const { container } = mount();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(ROUTE));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(getFilesByEntity).not.toHaveBeenCalled();
  });

  it('ΔΧ-2 — χωρίς δικαίωμα: λέει την κατάσταση, δεν δείχνει κουμπί ούτε φόρμα', async () => {
    arrange({ declaration: null, mayDeclare: false });
    mount();

    expect(await screen.findByText(`${K}.notDeclared`)).toBeInTheDocument();
    // Η φόρμα σιωπά όσο φορτώνουν τα αρχεία: η απουσία της μετρά ΜΟΝΟ αφού έχουν έρθει (ADR-907 §11.11).
    await waitFor(() => expect(getFilesByEntity).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('ΔΧ-3 — υπογραφή μόνο με εικόνα ΚΑΙ δήλωση· μετά δείχνει υπογραφή και αγγελίες', async () => {
    arrange({ declaration: null, mayDeclare: true }, [fileOf('img_a'), fileOf('img_b')]);
    apiPost.mockResolvedValue({ floorId: 'floor_1', state: 'declared', declaration: { ...SIGNED, fileId: 'img_b' }, listings: [{}, {}, {}] });
    mount();

    await waitFor(() => expect(signButton()).toBeDisabled());
    fireEvent.click(statement());
    expect(signButton()).toBeDisabled(); // δήλωση χωρίς εικόνα
    fireEvent.click(statement());
    fireEvent.change(picker(), { target: { value: 'img_b' } });
    expect(signButton()).toBeDisabled(); // εικόνα χωρίς δήλωση
    fireEvent.click(statement());
    expect(signButton()).toBeEnabled();

    fireEvent.click(signButton());
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(ROUTE, { fileId: 'img_b' }));
    expect(apiPost).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('Μαρία Π.')).toBeInTheDocument();
    expect(screen.getByText('img_b.png')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`${K}.listingsRefreshed {"count":3}`);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('ΔΧ-3 — καμία δημοσιευμένη μονάδα: το λέει, δεν γράφει «0»', async () => {
    arrange({ declaration: null, mayDeclare: true });
    apiPost.mockResolvedValue({ floorId: 'floor_1', state: 'declared', declaration: SIGNED, listings: [] });
    mount();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(signButton());
    expect(await screen.findByRole('status')).toHaveTextContent(`${K}.listingsNone`);
  });

  it('ΔΧ-4 — δύο εικόνες: καμία προεπιλογή· μία: προεπιλεγμένη', async () => {
    arrange({ declaration: null, mayDeclare: true }, [fileOf('img_a'), fileOf('img_b')]);
    const two = mount();
    await waitFor(() => expect(picker().value).toBe(''));
    two.unmount();

    arrange({ declaration: null, mayDeclare: true }, [fileOf('img_a')]);
    mount();
    await waitFor(() => expect(picker().value).toBe('img_a'));
  });

  it('ΔΧ-4 — PDF, σχέδιο και σβησμένη εικόνα δεν προσφέρονται· η μη δημόσια σημαίνεται', async () => {
    arrange({ declaration: null, mayDeclare: true }, [
      fileOf('plan_pdf', { contentType: 'application/pdf' }),
      fileOf('plan_dxf', { contentType: 'application/dxf' }),
      fileOf('img_gone', { isDeleted: true }),
      fileOf('img_private', { classification: FILE_CLASSIFICATIONS.INTERNAL }),
      fileOf('img_unmarked', { classification: undefined }),
      fileOf('img_public'),
    ]);
    mount();

    await waitFor(() => expect(within(picker()).getAllByRole('option')).toHaveLength(4)); // «—» + τρεις εικόνες
    const labels = within(picker()).getAllByRole('option').map((option) => option.textContent);
    expect(labels).toEqual(['—', `img_private.png — ${K}.notPublicSuffix`, `img_unmarked.png — ${K}.notPublicSuffix`, 'img_public.png']);
  });

  it('ΔΧ-4 — όροφος χωρίς εικόνα: οδηγία, όχι άδεια φόρμα', async () => {
    arrange({ declaration: null, mayDeclare: true }, [fileOf('plan_dxf', { contentType: 'application/dxf' })]);
    mount();

    expect(await screen.findByText(`${K}.noImage`)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ΔΧ-5 — άρνηση: η πρόταση της άρνησης και το περίγραμμα· η φόρμα μένει', async () => {
    arrange({ declaration: null, mayDeclare: true });
    const body = floorPlateRefusalBody({ why: 'unlinked-outline', overlayId: 'ovl_9' });
    apiPost.mockRejectedValue(new ApiClientError(body.error, 409, body.errorCode, undefined, 'req_1', undefined, body));
    mount();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(signButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(`${K}.refusal.outlineUnlinked`);
    expect(alert).toHaveTextContent(`${K}.outlineRef {"id":"ovl_9"}`);
    expect(alert).not.toHaveTextContent(`${K}.failed`);
    expect(signButton()).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ΔΧ-6 — ξένη αποτυχία: «απέτυχε», ποτέ πρόταση άρνησης', async () => {
    arrange({ declaration: null, mayDeclare: true });
    apiPost.mockRejectedValue(new ApiClientError('boom', 500, 'FLOOR_PLATE_FAILED', undefined, 'req_2', undefined, { why: 'unlinked-outline' }));
    mount();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(signButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(`${K}.failed`);
    expect(alert).not.toHaveTextContent('refusal');
  });

  it('ΔΧ-7 — δήλωση: ποιος, πότε (σε <time>), ποια εικόνα· χωρίς δικαίωμα καμία άρση', async () => {
    arrange({ declaration: SIGNED, mayDeclare: false });
    const { container } = mount();

    expect(await screen.findByText('Μαρία Π.')).toBeInTheDocument();
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(SIGNED.declaredAt);
    expect(await screen.findByText('img_a.png')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ΔΧ-7 — υπογράφων που δεν λύθηκε σε όνομα: ουδέτερη λέξη, ποτέ το uid', async () => {
    arrange({ declaration: { ...SIGNED, declaredBy: 'uid_unknown' }, mayDeclare: false });
    mount();

    expect(await screen.findByText(`${K}.signerUnknown`)).toBeInTheDocument();
    expect(screen.queryByText('uid_unknown')).not.toBeInTheDocument();
  });

  it('ΔΧ-8 — άρση: ακύρωση δεν γράφει· επιβεβαίωση γράφει ΜΙΑ φορά στην ίδια πόρτα, και γυρίζει η φόρμα', async () => {
    arrange({ declaration: SIGNED, mayDeclare: true });
    apiDelete.mockResolvedValue({ floorId: 'floor_1', state: 'withdrawn', declaration: null, listings: [{}] });
    mount();

    fireEvent.click(await screen.findByRole('button', { name: `${K}.withdraw` }));
    expect(apiDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(apiDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: `${K}.withdraw` }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith(ROUTE));
    expect(apiDelete).toHaveBeenCalledTimes(1);
    expect(apiPost).not.toHaveBeenCalled();

    expect(await screen.findByRole('checkbox')).toBeInTheDocument();
    expect(screen.queryByText('Μαρία Π.')).not.toBeInTheDocument();
  });

  it('ΔΧ-9 — η εικόνα της δήλωσης έφυγε από τον όροφο: προειδοποίηση', async () => {
    arrange({ declaration: SIGNED, mayDeclare: true }, [fileOf('img_other')]);
    mount();

    expect(await screen.findByRole('alert')).toHaveTextContent(`${K}.imageGone`);
    expect(screen.queryByText('img_other.png')).not.toBeInTheDocument();
  });

  it('ΔΧ-9β — όσο τα αρχεία ΦΟΡΤΩΝΟΥΝ δεν υπάρχει προειδοποίηση: «δεν ξέρω ακόμη» δεν είναι «έφυγε»', async () => {
    arrange({ declaration: SIGNED, mayDeclare: true });
    getFilesByEntity.mockReturnValue(new Promise(() => undefined));
    mount();

    expect(await screen.findByText('Μαρία Π.')).toBeInTheDocument();
    await waitFor(() => expect(getFilesByEntity).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/** Υπόσχεση που λύνεται με το χέρι: η κατάσταση «τρέχει» γίνεται παρατηρήσιμη. */
function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('FloorPlateDeclaration — όσο τρέχει η πράξη, και όταν αλλάζει ο όροφος (ADR-907 §11.11)', () => {
  const section = (): HTMLElement => {
    const found = document.querySelector<HTMLElement>('[data-floor-plate-declaration]');
    if (found === null) throw new Error('κανένα πάνελ δήλωσης');
    return found;
  };

  it('ΔΧ-10 — υπογραφή σε εξέλιξη: το πάνελ το δηλώνει, το κουμπί κλείνει, δεύτερο πάτημα δεν φεύγει', async () => {
    arrange({ declaration: null, mayDeclare: true });
    const pending = deferred<unknown>();
    apiPost.mockReturnValue(pending.promise);
    mount();

    const box = await screen.findByRole('checkbox');
    expect(box).toHaveAccessibleDescription(`${K}.statementNote`);
    expect(section()).toHaveAttribute('aria-busy', 'false');
    fireEvent.click(box);
    fireEvent.click(signButton());

    const busy = await screen.findByRole('button', { name: `${K}.declareBusy` });
    expect(busy).toBeDisabled();
    expect(section()).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busy);
    expect(apiPost).toHaveBeenCalledTimes(1);

    await act(async () => { pending.resolve({ floorId: 'floor_1', state: 'declared', declaration: SIGNED, listings: [] }); });
    expect(await screen.findByText('Μαρία Π.')).toBeInTheDocument();
    expect(section()).toHaveAttribute('aria-busy', 'false');
  });

  it('ΔΧ-11 — νέα προσπάθεια μετά από άρνηση: η παλιά άρνηση φεύγει ΜΟΛΙΣ ξεκινήσει η νέα πράξη', async () => {
    arrange({ declaration: null, mayDeclare: true });
    const body = floorPlateRefusalBody({ why: 'unlinked-outline', overlayId: 'ovl_9' });
    apiPost.mockRejectedValueOnce(new ApiClientError(body.error, 409, body.errorCode, undefined, 'req_1', undefined, body));
    mount();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(signButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    apiPost.mockReturnValue(deferred<unknown>().promise);
    fireEvent.click(signButton());
    await screen.findByRole('button', { name: `${K}.declareBusy` });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ΔΧ-12 — άρση σε εξέλιξη: το κουμπί της κλείνει', async () => {
    arrange({ declaration: SIGNED, mayDeclare: true });
    apiDelete.mockReturnValue(deferred<unknown>().promise);
    mount();

    fireEvent.click(await screen.findByRole('button', { name: `${K}.withdraw` }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(await screen.findByRole('button', { name: `${K}.withdrawBusy` })).toBeDisabled();
  });

  it('ΔΧ-13 — άλλος όροφος: η προηγούμενη υπογραφή φεύγει ΑΜΕΣΩΣ, και αργοπορημένη απάντηση δεν τη φέρνει πίσω', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    apiGet.mockImplementation((route: string) => (route === ROUTE ? first.promise : second.promise));
    getFilesByEntity.mockResolvedValue([fileOf('img_a')]);
    const view = mount();

    view.rerender(<FloorPlateDeclaration floorId="floor_2" companyId="c1" />);
    await act(async () => { first.resolve({ floorId: 'floor_1', declaration: SIGNED, mayDeclare: true }); });
    expect(view.container).toBeEmptyDOMElement(); // η απάντηση του ορόφου 1 ήρθε αργά: δεν ανήκει πια εδώ

    await act(async () => { second.resolve({ floorId: 'floor_2', declaration: null, mayDeclare: false }); });
    expect(await screen.findByText(`${K}.notDeclared`)).toBeInTheDocument();
    expect(screen.queryByText('Μαρία Π.')).not.toBeInTheDocument();
  });

  it('ΔΧ-13β — άλλος όροφος όσο ο νέος διαβάζεται: τίποτα από τον παλιό στην οθόνη', async () => {
    apiGet.mockImplementation((route: string) =>
      route === ROUTE ? Promise.resolve({ floorId: 'floor_1', declaration: SIGNED, mayDeclare: true }) : new Promise(() => undefined));
    getFilesByEntity.mockResolvedValue([fileOf('img_a')]);
    const view = mount();
    expect(await screen.findByText('Μαρία Π.')).toBeInTheDocument();

    view.rerender(<FloorPlateDeclaration floorId="floor_2" companyId="c1" />);
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
  });

  it('ΔΧ-13γ — πράξη του ορόφου 1 που απαντά αφού φύγαμε: δεν γράφει υπογραφή στον όροφο 2', async () => {
    arrange({ declaration: null, mayDeclare: true });
    const pending = deferred<unknown>();
    apiPost.mockReturnValue(pending.promise);
    const view = mount();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(signButton());
    await screen.findByRole('button', { name: `${K}.declareBusy` });

    view.rerender(<FloorPlateDeclaration floorId="floor_2" companyId="c1" />);
    await screen.findByRole('button', { name: `${K}.declare` });
    await act(async () => { pending.resolve({ floorId: 'floor_1', state: 'declared', declaration: SIGNED, listings: [{}] }); });

    expect(screen.queryByText('Μαρία Π.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('chosenFloorPlateImageId — ποια εικόνα ονομάζει η υπογραφή (ADR-907 §11.11)', () => {
  const two = [fileOf('img_a'), fileOf('img_b')];

  it('επιλογή που υπάρχει ακόμη μένει· επιλογή που ΕΦΥΓΕ από τον όροφο δεν υπογράφεται', () => {
    expect(chosenFloorPlateImageId(two, 'img_b')).toBe('img_b');
    expect(chosenFloorPlateImageId(two, 'img_gone')).toBeNull();
    expect(chosenFloorPlateImageId([fileOf('img_a')], 'img_gone')).toBe('img_a');
  });

  it('χωρίς επιλογή: μία εικόνα προεπιλέγεται, δύο όχι, καμία όχι', () => {
    expect(chosenFloorPlateImageId([fileOf('img_a')], null)).toBe('img_a');
    expect(chosenFloorPlateImageId(two, null)).toBeNull();
    expect(chosenFloorPlateImageId([], null)).toBeNull();
  });
});
