/**
 * @fileoverview **Α42 — Η ΦΟΡΜΑ ΑΝΕΒΑΖΕΙ ΣΤΟΝ ΦΑΚΕΛΟ ΚΑΙ ΔΗΛΩΝΕΙ ΤΙ ΔΗΜΟΣΙΕΥΕΤΑΙ** (ADR-866 Φ1.3β · §2.11).
 * @related ADR-866 §2.7.4 · §2.11.2 (Δ1 · Δ2 · Δ4) · services/property-dossier/dossier-media-publication
 *
 * **Α42.1** — ζει στο `lib/owner-property/__tests__/owner-property-draft-memory.test.ts` (Ν8-Ν11: η μνήμη).
 * **Α42.2** — ποια οθόνη φοριέται, και **τι ταξιδεύει** στη γέννηση της αγγελίας.
 * **Α42.3** — το ανέβασμα: γέννηση **μία** φορά, και **πού** γράφει.
 * **Α42.4** — η δήλωση: ποια φεύγουν, **με ποια σειρά**, και τι **δεν μπορεί** να φύγει.
 *
 * 🔑 **Ο κριτής εγκυρότητας τρέχει ΑΛΗΘΙΝΟΣ** (οι τιμές παράγονται από πραγματική αγγελία μέσω
 * `ownerPropertyFormFrom`) — αντικαθίστανται **μόνο** τα σύνορα δικτύου.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { ownerPropertyFormFrom } from '@/lib/owner-property/owner-property-form-values';
import type { FileRecord } from '@/types/file-record';
import type { OwnerProperty } from '@/types/owner-property';

const USER_ID = 'user_maria';

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user_maria', email: 'maria@example.gr' } }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const createOwnerListing = jest.fn().mockResolvedValue({ kind: 'saved', property: validOwnerProperty() });
const createBrokeredOwnerListing = jest.fn().mockResolvedValue({ kind: 'saved', property: validOwnerProperty() });
jest.mock('@/services/owner-property/owner-property.service', () => ({
  ...jest.requireActual('@/services/owner-property/owner-property.service'),
  createOwnerListing: (...args: unknown[]) => createOwnerListing(...args),
  createBrokeredOwnerListing: (...args: unknown[]) => createBrokeredOwnerListing(...args),
  updateOwnerListing: jest.fn(),
}));

/** Η **πόρτα γέννησης** του φακέλου — το `newPropertyDossierId` μένει **αληθινό** (ταυτότητα, όχι δίκτυο). */
const createPropertyDossierRequest = jest.fn();
jest.mock('@/services/property-dossier/property-dossier.service', () => ({
  ...jest.requireActual('@/services/property-dossier/property-dossier.service'),
  createPropertyDossierRequest: (...args: unknown[]) => createPropertyDossierRequest(...args),
}));

const uploadEntityFile = jest.fn();
jest.mock('@/services/filesystem/upload-entity-file', () => ({
  uploadEntityFile: (...args: unknown[]) => uploadEntityFile(...args),
}));

const validateCustodyUploadAuth = jest.fn();
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  ...jest.requireActual('@/services/filesystem/file-mutation-gateway'),
  validateCustodyUploadAuth: (...args: unknown[]) => validateCustodyUploadAuth(...args),
}));

/**
 * Ο **ζωντανός αναγνώστης** — σύνορο δικτύου.
 *
 * 🔑 Η λίστα παράγεται **από την ταυτότητα του φακέλου** που ζήτησε η οθόνη, και όχι από σταθερά: στη **δημιουργία**
 * ο φάκελος προ-γεννιέται μέσα στην απόδοση, άρα καμία δοκιμή δεν μπορεί να ξέρει το `pdos_*` **πριν**. Έτσι το
 * fixture απαντά «τα αρχεία **αυτού** του φακέλου» — που είναι ακριβώς ό,τι κάνει και η Firestore.
 */
let filesFor: (entityId: string) => FileRecord[] = () => [];
const requestedEntityIds: string[] = [];
jest.mock('@/components/shared/files/hooks/useEntityFiles', () => ({
  useEntityFiles: (params: { entityId: string }) => {
    requestedEntityIds.push(params.entityId);
    return {
      files: filesFor(params.entityId),
      loading: false,
      error: null,
      refetch: jest.fn(),
      moveToTrash: jest.fn(),
      renameFile: jest.fn(),
      updateDescription: jest.fn(),
      deleteFile: jest.fn(),
      totalStorageBytes: 0,
    };
  },
}));

const { OwnerPropertyFormContent } =
  require('@/components/owner-property/OwnerPropertyFormContent') as typeof import('@/components/owner-property/OwnerPropertyFormContent');

const PERSONAL: OwnerProperty = validOwnerProperty();

const MANDATE_PROP = {
  section: <div />,
  blockers: [] as readonly never[],
  request: {
    clientContactId: 'cont_kostas',
    expiresAt: '2027-02-20T23:59:59.999Z',
    via: 'owner-consent',
    documentFileId: null,
  },
  onNotify: () => undefined,
};

/** Ένα **έτοιμο** αρχείο του φακέλου, στην εμβέλεια που γράφει η καρτέλα «Φωτογραφίες». */
function dossierPhoto(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 'file_photo_1',
    entityType: 'property_dossier',
    entityId: 'PLACEHOLDER',
    userId: USER_ID,
    displayName: 'Σαλόνι.jpg',
    originalFilename: 'IMG_1.jpg',
    storagePath: 'people/user_maria/entities/property_dossier/pdos_x/sales/photos/IMG_1.jpg',
    contentType: 'image/jpeg',
    status: 'ready',
    isDeleted: false,
    lifecycleState: 'active',
    createdAt: '2026-09-22T10:00:00.000Z',
    domain: 'sales',
    category: 'photos',
    purpose: 'dossier-photo',
    ...overrides,
  } as FileRecord;
}

function renderForm(props: Record<string, unknown> = {}): void {
  render(<OwnerPropertyFormContent initialValues={ownerPropertyFormFrom(PERSONAL)} {...props} />);
}

/** Η ταυτότητα φακέλου που **ζήτησε η οθόνη** σε αυτή την απόδοση — η μόνη αλήθεια πριν σταλεί οτιδήποτε. */
function askedDossierId(): string {
  const asked = requestedEntityIds.at(-1);
  if (asked === undefined) throw new Error('ο παρονομαστής έσπασε: η οθόνη δεν ζήτησε φάκελο');
  return asked;
}

/**
 * Τα κουτάκια **των γραμμών αρχείου** — ποτέ `getAllByRole('checkbox')` σκέτο.
 *
 * ⚠️ Η ίδια φόρμα έχει **και άλλα** κουτάκια (διαθέσεις, κατοικίδια)· ένα καθολικό ερώτημα θα μετρούσε εκείνα και
 * η άγκυρα θα ήταν πράσινη ή κόκκινη για **λάθος** λόγο. Μετρημένο: μία γραμμή αρχείου ⇒ 2 κουτάκια στην οθόνη.
 */
function fileCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]'));
}

/** Οι γραμμές της λίστας αρχείων, **με τη σειρά που τις βλέπει ο άνθρωπος** — δηλαδή η σειρά της γκαλερί. */
function fileRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll('li'));
}

async function submit(): Promise<void> {
  const form = document.querySelector('form');
  if (form === null) throw new Error('ο παρονομαστής έσπασε: η φόρμα δεν αποδόθηκε');
  fireEvent.submit(form);
  await waitFor(() => {
    expect(createOwnerListing.mock.calls.length + createBrokeredOwnerListing.mock.calls.length).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  localStorage.clear();
  filesFor = () => [];
  requestedEntityIds.length = 0;
  createOwnerListing.mockClear();
  createBrokeredOwnerListing.mockClear();
  createPropertyDossierRequest.mockReset().mockResolvedValue({ kind: 'saved', dossier: { id: 'pdos_x' } });
  uploadEntityFile.mockReset().mockResolvedValue({ fileId: 'file_new', displayName: 'νέο' });
  validateCustodyUploadAuth.mockReset().mockResolvedValue({ uid: USER_ID, custody: 'personal' });
});

// =============================================================================
// Α42.2 — ΠΟΙΑ ΟΘΟΝΗ, ΚΑΙ ΤΙ ΤΑΞΙΔΕΥΕΙ
// =============================================================================

describe('Α42.2 — η αγγελία γεννιέται ΜΕ τον φάκελό της', () => {
  it('🔴 δημιουργία ιδιώτη ⇒ η **νέα** οθόνη, και ο φάκελος ΤΑΞΙΔΕΥΕΙ στη γέννηση', async () => {
    renderForm();

    // Η νέα οθόνη ρωτά «φωτογραφίες ή κάτοψη;» — η παλιά είχε **ένα** «Προσθήκη αρχείου».
    expect(screen.getByText('property-market:offer.media.dossier.addPhotos')).toBeInTheDocument();
    expect(screen.queryByText('property-market:offer.media.add')).not.toBeInTheDocument();

    await submit();

    const [, , dossierId] = createOwnerListing.mock.calls[0] as [string, unknown, string | null];
    expect(dossierId).toMatch(/^pdos_/);
    // 🔑 **Η ΙΔΙΑ** ταυτότητα που ρώτησε η οθόνη — όχι δεύτερη κομμένη στην υποβολή, που θα έστελνε την
    //    αγγελία σε φάκελο **άλλο** από αυτόν όπου ανέβηκαν τα αρχεία.
    expect(dossierId).toBe(askedDossierId());
  });

  it('🔴 αγγελία ΓΡΑΦΕΙΟΥ ⇒ ΚΑΝΕΝΑΣ φάκελος, και η ΠΑΛΙΑ οθόνη (Ε-Φ1-2)', async () => {
    renderForm({ mandate: MANDATE_PROP });

    // Φάκελος **ενός ανθρώπου** σε αγγελία γραφείου θα έβαζε τα αρχεία του πελάτη στον
    // **προσωπικό** χώρο του υπαλλήλου — η αντίστροφη βλάβη από αυτήν που η Φ1 κλείνει.
    expect(screen.getByText('property-market:offer.media.add')).toBeInTheDocument();
    expect(screen.queryByText('property-market:offer.media.dossier.addPhotos')).not.toBeInTheDocument();

    await submit();

    expect(createBrokeredOwnerListing).toHaveBeenCalled();
    // Καμία οθόνη φακέλου ⇒ κανένας ακροατής αρχείων ζητήθηκε ποτέ.
    expect(requestedEntityIds).toHaveLength(0);
  });

  it('🔴 ΠΑΛΙΑ αγγελία σε επεξεργασία (χωρίς φάκελο) ⇒ το `media[]` ΑΥΤΟΥΣΙΟ (dual-read)', () => {
    renderForm({ editingId: PERSONAL.id, existingDossierId: null });

    expect(screen.getByText('property-market:offer.media.add')).toBeInTheDocument();
    expect(screen.queryByText('property-market:offer.media.dossier.addPhotos')).not.toBeInTheDocument();
  });

  it('επεξεργασία αγγελίας ΜΕ φάκελο ⇒ η νέα οθόνη, πάνω στον ΔΙΚΟ ΤΗΣ φάκελο', () => {
    renderForm({ editingId: PERSONAL.id, existingDossierId: 'pdos_existing' });

    expect(screen.getByText('property-market:offer.media.dossier.addPhotos')).toBeInTheDocument();
  });
});

// =============================================================================
// Α42.3 — ΤΟ ΑΝΕΒΑΣΜΑ
// =============================================================================

describe('Α42.3 — το πρώτο ανέβασμα γεννά τον φάκελο, και γράφει ΜΕΣΑ του', () => {
  /** Διαλέγει αρχείο στο **ν-οστό** κουμπί ανεβάσματος (0 = φωτογραφίες, 1 = κάτοψη/τοπογραφικό). */
  async function pick(index: number, file: File): Promise<void> {
    const inputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[index], { target: { files: [file] } });
    await waitFor(() => expect(uploadEntityFile).toHaveBeenCalled());
  }

  it('🔴 ΜΗΔΕΝ ΟΡΦΑΝΑ: ο φάκελος γεννιέται στο ΠΡΩΤΟ ανέβασμα — όχι στο άνοιγμα της φόρμας', async () => {
    renderForm();
    // Το άνοιγμα **δεν** γράφει τίποτα: μια φόρμα που άνοιξε και έκλεισε δεν αφήνει φάκελο πίσω της.
    expect(createPropertyDossierRequest).not.toHaveBeenCalled();

    await pick(0, new File(['α'], 'σαλόνι.jpg', { type: 'image/jpeg' }));

    expect(createPropertyDossierRequest).toHaveBeenCalledTimes(1);
    const [dossierId, draft] = createPropertyDossierRequest.mock.calls[0] as [string, { label: string }];
    expect(dossierId).toBe(askedDossierId());
    // Δ7 — το όνομα είναι ο **τίτλος** της αγγελίας (αντιγραφή, όχι μετάφραση).
    expect(draft.label).toBe(PERSONAL.title);
  });

  it('🔑 ΙΔΕΜΠΟΤΗΤΟ: δεύτερο αρχείο ⇒ ΚΑΝΕΝΑ δεύτερο αίτημα γέννησης', async () => {
    renderForm();
    await pick(0, new File(['α'], 'α.jpg', { type: 'image/jpeg' }));
    uploadEntityFile.mockClear();
    await pick(0, new File(['β'], 'β.jpg', { type: 'image/jpeg' }));

    expect(createPropertyDossierRequest).toHaveBeenCalledTimes(1);
    expect(uploadEntityFile).toHaveBeenCalledTimes(1);
  });

  it('🔴 ΓΡΑΦΕΙ ΜΕΣΑ ΣΤΟΝ ΦΑΚΕΛΟ, με κάτοχο ΑΝΘΡΩΠΟ και την εμβέλεια της καρτέλας', async () => {
    renderForm();
    await pick(0, new File(['α'], 'σαλόνι.jpg', { type: 'image/jpeg' }));

    const [spec] = uploadEntityFile.mock.calls[0] as [Record<string, unknown>];
    expect(spec.entityType).toBe('property_dossier');
    expect(spec.entityId).toBe(askedDossierId());
    // 🔴 Κάτοχος **άνθρωπος**, ποτέ εταιρεία: ο προσωπικός χώρος δεν διευρύνεται προς την εταιρεία του υπαλλήλου.
    expect(spec.custody).toEqual({ userId: USER_ID });
    expect(validateCustodyUploadAuth).toHaveBeenCalledWith({ userId: USER_ID });
    // Η εμβέλεια είναι **παραγόμενη** (`resolveUploadScope` πάνω στις προεπιλογές της καρτέλας) — ποτέ χειρόγραφη.
    expect(spec.domain).toBe('sales');
    expect(spec.category).toBe('photos');
    expect(spec.purpose).toBe('dossier-photo');
  });

  it('η καρτέλα ΚΑΤΟΨΗΣ γράφει σε ΑΛΛΗ εμβέλεια — το κουμπί ΕΙΝΑΙ η απάντηση στο «τι είναι»', async () => {
    renderForm();
    await pick(1, new File(['α'], 'κατοψη.pdf', { type: 'application/pdf' }));

    const [spec] = uploadEntityFile.mock.calls[0] as [Record<string, unknown>];
    expect(spec.domain).toBe('construction');
    expect(spec.category).toBe('floorplans');
    expect(spec.purpose).toBe('dossier-floorplan');
  });

  it('🔴 αποτυχία γέννησης ⇒ ΚΑΝΕΝΑ ανέβασμα (αρχείο χωρίς κάτοχο δεν γράφεται ποτέ)', async () => {
    createPropertyDossierRequest.mockResolvedValue({ kind: 'failed' });
    renderForm();

    const inputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[0], { target: { files: [new File(['α'], 'α.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => {
      expect(screen.getByText('property-market:offer.media.failed')).toBeInTheDocument();
    });
    expect(uploadEntityFile).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Α42.4 — Η ΔΗΛΩΣΗ
// =============================================================================

describe('Α42.4 — η αγγελία δηλώνει: ποια φεύγουν και ΜΕ ΠΟΙΑ ΣΕΙΡΑ', () => {
  const PDOS = 'pdos_x';

  function renderWithFiles(files: FileRecord[]): void {
    filesFor = () => files;
    renderForm({ editingId: PERSONAL.id, existingDossierId: PDOS });
  }

  it('🔴 αδήλωτο ΔΕΝ φεύγει· η δήλωση γράφεται με ΣΕΙΡΑ ΕΠΙΛΟΓΗΣ', () => {
    renderWithFiles([
      dossierPhoto({ id: 'file_a', entityId: PDOS, displayName: 'Α.jpg' }),
      dossierPhoto({ id: 'file_b', entityId: PDOS, displayName: 'Β.jpg' }),
    ]);

    expect(fileCheckboxes()).toHaveLength(2);
    // Τίποτα δεν είναι επιλεγμένο εξ ορισμού — opt-in **δομικά** (§2.7.4).
    expect(fileCheckboxes().every((box) => !box.checked)).toBe(true);

    fireEvent.click(fileCheckboxes()[1]);
    // Η δηλωμένη ανεβαίνει στην κορυφή ⇒ η **δεύτερη** γραμμή είναι πάλι η αδήλωτη.
    fireEvent.click(fileCheckboxes()[1]);

    expect(screen.getByText('property-market:offer.media.publishedCount')).toBeInTheDocument();
    expect(fileCheckboxes().filter((box) => box.checked)).toHaveLength(2);
    // 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΔΗΛΩΣΗ: πρώτη δηλώθηκε η «Β», άρα πρώτη φεύγει.
    expect(fileRows()[0].textContent).toContain('Β.jpg');
  });

  it('🔴 «Να μπει πρώτη» ΑΛΛΑΖΕΙ ΤΗ ΣΕΙΡΑ — η λίστα στην οθόνη ΕΙΝΑΙ η γκαλερί', () => {
    renderWithFiles([
      dossierPhoto({ id: 'file_a', entityId: PDOS, displayName: 'Α.jpg' }),
      dossierPhoto({ id: 'file_b', entityId: PDOS, displayName: 'Β.jpg' }),
    ]);

    fireEvent.click(fileCheckboxes()[0]);
    fireEvent.click(fileCheckboxes()[1]);

    // Η πρώτη δηλωμένη φοράει το σήμα· η δεύτερη προσφέρει «να μπει πρώτη».
    expect(screen.getByText('property-market:offer.media.firstBadge')).toBeInTheDocument();
    fireEvent.click(screen.getByText('property-market:offer.media.makeFirst'));

    expect(fileRows()[0].textContent).toContain('Β.jpg');
    expect(fileRows()[0].textContent).toContain('property-market:offer.media.firstBadge');
  });

  it('🔴 ΜΗ ΔΗΜΟΣΙΕΥΣΙΜΟ (DXF) ⇒ ΚΑΝΕΝΑ κουτάκι, και το λέει — ποτέ υπόσχεση που δεν τηρείται', () => {
    renderWithFiles([
      dossierPhoto({
        id: 'file_dxf',
        entityId: PDOS,
        displayName: 'κάτοψη.dxf',
        contentType: 'application/dxf',
        domain: 'construction',
        category: 'floorplans',
        purpose: 'dossier-floorplan',
      }),
    ]);

    expect(fileCheckboxes()).toHaveLength(0);
    expect(screen.getByText('property-market:offer.media.dossier.notDeliverable')).toBeInTheDocument();
  });

  it('🔴 ΞΕΝΟ αρχείο (άλλος φάκελος) ⇒ ΔΕΝ μπορεί να δηλωθεί, όποιος κι αν το έφερε', () => {
    renderWithFiles([dossierPhoto({ id: 'file_ξένο', entityId: 'pdos_άλλος', displayName: 'ξένο.jpg' })]);

    expect(fileCheckboxes()).toHaveLength(0);
    expect(screen.getByText('property-market:offer.media.dossier.notDeliverable')).toBeInTheDocument();
  });

  it('🔑 η δήλωση ταξιδεύει ΜΕ το προσχέδιο στη γέννηση της αγγελίας', async () => {
    // 🔑 Το αρχείο ανήκει στον φάκελο **αυτής** της απόδοσης — ο επιλογέας ξαναρωτά `entityId`+`userId` (N.7.2 #4),
    //    άρα ένα σταθερό `pdos_*` στο fixture θα έπεφτε έξω και η άγκυρα θα ήταν πράσινη για λάθος λόγο.
    filesFor = (entityId) => [dossierPhoto({ id: 'file_a', entityId })];
    renderForm();

    fireEvent.click(fileCheckboxes()[0]);
    await submit();

    const [, draft] = createOwnerListing.mock.calls[0] as [string, { publishedFileIds?: readonly string[] }];
    expect(draft.publishedFileIds).toEqual(['file_a']);
  });
});
