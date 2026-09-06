/**
 * =============================================================================
 * ADR-841 §7 **Α17.7** — **Η ΟΘΟΝΗ ΤΩΝ ΚΑΤΟΨΕΩΝ, ΕΚΤΕΛΕΣΜΕΝΗ** *(Ο-21)*
 * =============================================================================
 *
 * Τρεις ερωτήσεις, και η **τρίτη** είναι που ξεχωρίζει αυτή την οθόνη από την αδελφή της:
 *
 *   1. *«δείχνει **όλες** τις κατόψεις — και εκείνες που δεν φεύγουν;»*
 *   2. *«η **δήλωση** γράφεται, και ανακαλείται;»*
 *   3. *«λέει **γιατί** μια δηλωμένη κάτοψη δεν φεύγει;»*
 *
 * 🔴 **Η τρίτη είναι το ασφαλές σκέλος.** Η δήλωση **δεν αρκεί** *(χρειάζεται και
 * `classification: 'public'`, και αποκωδικοποιήσιμη εικόνα)*. Οθόνη που το έκρυβε θα
 * άφηνε τον άνθρωπο να πιστεύει ότι η πράξη του δημοσίευσε κάτι — **το χειρότερο είδος
 * σιωπής**, γιατί μοιάζει με επιτυχία.
 *
 * ⚠️ **ΜΟΝΤΑΡΕΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ COMPONENT** και το **πραγματικό** hook· ψεύτικα είναι μόνο
 * τα **σύνορα** *(η ανάγνωση αρχείων, ο γραφέας)*. Ο κανόνας *«φεύγει;»* που κρίνει τη
 * σήμανση είναι ο **ίδιος** που τρέχει ο διακομιστής.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListingFloorplansPanel } from '@/components/listings/ListingFloorplansPanel';
import type { FileRecord } from '@/types/file-record';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

let filesFromFirestore: FileRecord[] = [];
jest.mock('@/components/shared/files/hooks/useEntityFiles', () => ({
  useEntityFiles: () => ({ files: filesFromFirestore, loading: false, error: null }),
}));

const updateProperty = jest.fn<Promise<{ success: boolean }>, [string, Record<string, unknown>]>();
jest.mock('@/services/properties.service', () => ({
  updateProperty: (id: string, updates: Record<string, unknown>) => updateProperty(id, updates),
}));

const PROPERTY_ID = 'prop_a0000006-7777-4aaa-8aaa-000000000006';
const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

const K = 'property-market:listing.floorplans';

function plan(id: string, over: Partial<FileRecord> = {}): FileRecord {
  return {
    id,
    entityType: 'property',
    entityId: PROPERTY_ID,
    storagePath: `companies/${COMPANY_ID}/entities/property/${PROPERTY_ID}/floorplans/${id}.jpg`,
    displayName: `Κάτοψη ${id}`,
    category: 'floorplans',
    classification: 'public',
    contentType: 'image/jpeg',
    status: 'ready',
    createdAt: '2026-08-20T10:00:00.000Z',
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  } as unknown as FileRecord;
}

const PLAN_A = plan('file_pa');
const PLAN_B = plan('file_pb');
/** Σημασμένη ιδιωτική — δηλωμένη ή όχι, **δεν φεύγει**. */
const PRIVATE = plan('file_priv', { classification: 'internal' } as Partial<FileRecord>);
/** Σχέδιο εργασίας: DXF, δεν μπαίνει σε `<img>`. */
const DXF = plan('file_dxf', { contentType: 'application/dxf' } as Partial<FileRecord>);

function mount(storedFloorplans: unknown) {
  return render(
    <ListingFloorplansPanel
      propertyId={PROPERTY_ID}
      companyId={COMPANY_ID}
      storedFloorplans={storedFloorplans}
    />,
  );
}

function rowOf(fileId: string): HTMLElement {
  const row = screen
    .getAllByRole('listitem')
    .find((item) => (item.textContent ?? '').includes(fileId));
  if (row === undefined) throw new Error(`δεν βρέθηκε γραμμή για ${fileId}`);
  return row;
}

beforeEach(() => {
  filesFromFirestore = [];
  updateProperty.mockReset();
  updateProperty.mockResolvedValue({ success: true });
});

// ============================================================================
// Κ1 — ΔΕΙΧΝΕΙ ΟΛΕΣ ΤΙΣ ΚΑΤΟΨΕΙΣ, ΟΧΙ ΜΟΝΟ ΤΙΣ ΔΗΜΟΣΙΕΥΣΙΜΕΣ
// ============================================================================

describe('Κ1 — ΤΙ ΔΕΙΧΝΕΙ', () => {
  it('🔴 δείχνει ΚΑΙ τις μη-δημοσιεύσιμες — αλλιώς ζητά πράξη για αρχεία που κρύβει', () => {
    filesFromFirestore = [PLAN_A, PRIVATE, DXF];
    mount(undefined);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('🔴 καμία κάτοψη ⇒ λέει ΤΙ ΝΑ ΚΑΝΕΙ ο άνθρωπος, και κανένα πλαίσιο ελέγχου', () => {
    mount(undefined);

    expect(screen.getByText(`${K}.empty`)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('🔴 η αποθηκευμένη δήλωση ΦΑΙΝΕΤΑΙ τσεκαρισμένη — και ΜΟΝΟ αυτή', () => {
    filesFromFirestore = [PLAN_A, PLAN_B];
    mount(['file_pb']);

    expect(within(rowOf('file_pa')).getByRole('checkbox')).not.toBeChecked();
    expect(within(rowOf('file_pb')).getByRole('checkbox')).toBeChecked();
  });
});

// ============================================================================
// Κ2 — Η ΠΡΑΞΗ
// ============================================================================

describe('Κ2 — «ΣΤΗΝ ΑΓΓΕΛΙΑ»', () => {
  it('🔴 κλικ ⇒ ΓΡΑΦΕΤΑΙ η δήλωση με τη νέα ταυτότητα', async () => {
    filesFromFirestore = [PLAN_A];
    mount(undefined);

    await userEvent.click(within(rowOf('file_pa')).getByRole('checkbox'));

    await waitFor(() => expect(updateProperty).toHaveBeenCalledTimes(1));
    expect(updateProperty).toHaveBeenCalledWith(PROPERTY_ID, {
      publishedFloorplans: ['file_pa'],
    });
  });

  it('🔴 δεύτερο κλικ ΑΝΑΚΑΛΕΙ — η πράξη είναι αναστρέψιμη', async () => {
    filesFromFirestore = [PLAN_A, PLAN_B];
    mount(['file_pa', 'file_pb']);

    await userEvent.click(within(rowOf('file_pa')).getByRole('checkbox'));

    await waitFor(() => expect(updateProperty).toHaveBeenCalledTimes(1));
    expect(updateProperty.mock.calls[0][1]).toEqual({ publishedFloorplans: ['file_pb'] });
  });

  it('🔴 ΑΙΣΙΟΔΟΞΑ: το πλαίσιο τσεκάρεται ΠΡΙΝ γυρίσει το έγγραφο', async () => {
    filesFromFirestore = [PLAN_A];
    mount(undefined);

    await userEvent.click(within(rowOf('file_pa')).getByRole('checkbox'));

    await waitFor(() =>
      expect(within(rowOf('file_pa')).getByRole('checkbox')).toBeChecked(),
    );
  });
});

// ============================================================================
// Κ3 — Η ΟΘΟΝΗ ΛΕΕΙ ΟΤΑΝ Η ΔΗΛΩΣΗ **ΔΕΝ ΑΡΚΕΙ**
// ============================================================================

describe('Κ3 — «ΔΗΛΩΜΕΝΗ, ΑΛΛΑ ΔΕΝ ΦΕΥΓΕΙ»', () => {
  it('🔴 δηλωμένη ΙΔΙΩΤΙΚΗ κάτοψη ⇒ η οθόνη το ΛΕΕΙ', () => {
    filesFromFirestore = [PRIVATE];
    mount(['file_priv']);

    expect(within(rowOf('file_priv')).getByText(`${K}.blocked`)).toBeInTheDocument();
  });

  it('🔴 δηλωμένο **DXF** ⇒ η οθόνη το ΛΕΕΙ — δεν υπόσχεται δημοσίευση που δεν γίνεται', () => {
    filesFromFirestore = [DXF];
    mount(['file_dxf']);

    expect(within(rowOf('file_dxf')).getByText(`${K}.blocked`)).toBeInTheDocument();
  });

  it('🔴 δηλωμένη ΕΓΚΥΡΗ κάτοψη ⇒ ΚΑΜΙΑ σήμανση — η σήμανση δεν είναι διακοσμητική', () => {
    filesFromFirestore = [PLAN_A];
    mount(['file_pa']);

    expect(within(rowOf('file_pa')).queryByText(`${K}.blocked`)).toBeNull();
  });

  it('🔴 ΑΔΗΛΩΤΗ ιδιωτική κάτοψη ⇒ ΚΑΜΙΑ σήμανση — θα ήταν θόρυβος, όχι πληροφορία', () => {
    filesFromFirestore = [PRIVATE];
    mount(undefined);

    expect(within(rowOf('file_priv')).queryByText(`${K}.blocked`)).toBeNull();
  });
});

// ============================================================================
// Κ4 — Η ΑΠΟΤΥΧΙΑ ΔΕΝ ΛΕΕΙ ΨΕΜΑΤΑ
// ============================================================================

describe('Κ4 — ΟΤΑΝ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΑΡΝΕΙΤΑΙ', () => {
  it('🔴 η οθόνη ΓΥΡΙΖΕΙ ΠΙΣΩ και το ΛΕΕΙ', async () => {
    updateProperty.mockRejectedValue(new Error('403'));
    filesFromFirestore = [PLAN_A];
    mount(undefined);

    await userEvent.click(within(rowOf('file_pa')).getByRole('checkbox'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(`${K}.saveFailed`),
    );
    expect(within(rowOf('file_pa')).getByRole('checkbox')).not.toBeChecked();
  });
});
