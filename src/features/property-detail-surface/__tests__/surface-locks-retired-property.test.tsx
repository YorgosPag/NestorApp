/**
 * ⚓ Η επιφάνεια λεπτομερειών είναι το **ΕΝΑ** σημείο που κλειδώνει ένα αποσυρμένο ακίνητο (ADR-329 §3.9).
 *
 * Τέσσερα πράγματα που **μόνο** η επιφάνεια μπορεί να κάνει — τα φύλλα ρωτούν, αυτά δεν ρωτιούνται:
 *   Ε1 — θέτει τον πάροχο: κάθε φύλλο από κάτω βλέπει την απόσυρση χωρίς prop
 *   Ε2 — αγνοεί τη λειτουργία επεξεργασίας του σημείου προσάρτησης (το μολύβι της λίστας δεν ξεκλειδώνει)
 *   Ε3 — δεν προσαρτά τη βιτρίνα (δημόσια προσφορά)
 *   Ε4 — δείχνει την ταινία που εξηγεί
 *   Ε5 — δεν ζωγραφίζει τις καρτέλες-πράξεις (`liveRecordOnly`: αγγελία · αντικειμενική · περιήγηση)
 *
 * | Μετάλλαξη (`PropertyDetailSurface.tsx`) | Αποτέλεσμα |
 * |---|---|
 * | χωρίς `RetiredRecordProvider` | Ε1 ⇒ 🔴 |
 * | `effectiveEditMode = isEditMode` | Ε2 ⇒ 🔴 |
 * | η βιτρίνα χωρίς `!locked` | Ε3 ⇒ 🔴 |
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { useRetiredKind } from '@/lib/firestore/retired-record-context';
import type { Property } from '@/types/property-viewer';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid_1', companyId: 'comp_1' } }),
}));
jest.mock('@/hooks/useEnterpriseMessages', () => ({
  useEmptyStateMessages: () => ({ unit: { title: 'create-unit', description: 'create-unit-hint' } }),
}));
jest.mock('@/features/properties-sidebar/hooks/usePropertiesSidebar', () => ({
  usePropertiesSidebar: () => ({
    safeFloors: [],
    currentFloor: null,
    safeViewerProps: {},
    safeViewerPropsWithFloors: { handleUpdateProperty: jest.fn() },
    ImpactDialog: null,
  }),
}));
jest.mock('../usePropertyShowcase', () => ({
  usePropertyShowcase: () => ({ isOpen: false, setOpen: jest.fn(), preSubmit: jest.fn(), photos: [] }),
}));
jest.mock('@/components/sharing/UnifiedShareDialog', () => ({
  UnifiedShareDialog: () => <div data-testid="showcase-dialog" />,
}));
jest.mock('@/components/shared/trash/RetiredRecordBanner', () => ({
  RetiredRecordBanner: ({ record }: { record: { status?: string } }) =>
    record.status === 'for-sale' ? null : <div data-testid="retired-banner" />,
}));
jest.mock('@/features/properties-sidebar/components/PropertyDetailsHeader', () => ({
  PropertyDetailsHeader: ({ isEditMode }: { isEditMode: boolean }) => (
    <div data-testid="header" data-edit={String(isEditMode)} />
  ),
}));
jest.mock('@/config/properties-tabs-config', () => ({
  getSortedPropertiesTabs: () => [{ id: 'info' }, { id: 'listing', liveRecordOnly: true }],
}));
jest.mock('@/components/generic/mappings/propertiesMappings', () => ({ PROPERTIES_COMPONENT_MAPPING: {} }));

/** Ένα φύλλο κάτω από τα tabs: ρωτά μόνο του, όπως κάθε πραγματικό φύλλο. */
function LeafProbe({ isEditMode, tabIds }: { isEditMode: boolean; tabIds: string }) {
  return <div data-testid="leaf" data-kind={String(useRetiredKind())} data-edit={String(isEditMode)} data-tabs={tabIds} />;
}
jest.mock('@/components/generic/UniversalTabsRenderer', () => ({
  convertToUniversalConfig: (tab: unknown) => tab,
  UniversalTabsRenderer: ({
    additionalData,
    tabs,
  }: {
    additionalData: { isEditMode: boolean };
    tabs: { id: string }[];
  }) => <LeafProbe isEditMode={additionalData.isEditMode} tabIds={tabs.map((tab) => tab.id).join(',')} />,
}));

import { PropertyDetailSurface } from '../PropertyDetailSurface';

const property = (status: string) => ({ id: 'prop_1', name: 'Δοκιμή', status }) as unknown as Property;

function mount(target: Property | null, isEditMode: boolean, onCreateAction?: () => void, isCreatingNewUnit = false) {
  return render(
    <PropertyDetailSurface
      property={target}
      isCreatingNewUnit={isCreatingNewUnit}
      units={[]}
      viewerProps={{ properties: [] }}
      floors={[]}
      setShowHistoryPanel={jest.fn()}
      isEditMode={isEditMode}
      onToggleEditMode={jest.fn()}
      onExitEditMode={jest.fn()}
      onCreateAction={onCreateAction}
    />,
  );
}

describe.each([
  ['archived', 'archived'],
  ['deleted', 'trashed'],
])('αποσυρμένο ακίνητο · `%s`', (status, kind) => {
  it('🔴 Ε1 — το φύλλο βλέπει την απόσυρση ΧΩΡΙΣ prop', () => {
    mount(property(status), false);

    expect(screen.getByTestId('leaf')).toHaveAttribute('data-kind', kind);
  });

  it('🔴 Ε2 — `isEditMode` από το σημείο προσάρτησης ΑΓΝΟΕΙΤΑΙ, σε κεφαλίδα και tabs', () => {
    mount(property(status), true);

    expect(screen.getByTestId('header')).toHaveAttribute('data-edit', 'false');
    expect(screen.getByTestId('leaf')).toHaveAttribute('data-edit', 'false');
  });

  it('🔴 Ε3 + Ε4 — καμία βιτρίνα, και η ταινία που εξηγεί', () => {
    mount(property(status), false);

    expect(screen.queryByTestId('showcase-dialog')).toBeNull();
    expect(screen.getByTestId('retired-banner')).toBeInTheDocument();
  });

  it('🔴 Ε5 — οι καρτέλες-πράξεις (`liveRecordOnly`) δεν ζωγραφίζονται καθόλου', () => {
    mount(property(status), false);

    expect(screen.getByTestId('leaf')).toHaveAttribute('data-tabs', 'info');
  });
});

describe('καρτέλες-πράξεις (`liveRecordOnly`)', () => {
  it('✅ ζωντανό ακίνητο ⇒ προσφέρονται', () => {
    mount(property('for-sale'), false);

    expect(screen.getByTestId('leaf')).toHaveAttribute('data-tabs', 'info,listing');
  });

  it('🔴 δημιουργία ⇒ δεν υπάρχει ακόμη εγγραφή να δεχτεί την πράξη', () => {
    mount(property('for-sale'), true, undefined, true);

    expect(screen.getByTestId('leaf')).toHaveAttribute('data-tabs', 'info');
  });
});

describe('ζωντανό ακίνητο — τίποτα δεν αλλάζει', () => {
  it('✅ η επεξεργασία περνά, η βιτρίνα προσαρτάται, καμία ταινία', () => {
    mount(property('for-sale'), true);

    expect(screen.getByTestId('leaf')).toHaveAttribute('data-kind', 'null');
    expect(screen.getByTestId('leaf')).toHaveAttribute('data-edit', 'true');
    expect(screen.getByTestId('showcase-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('retired-banner')).toBeNull();
  });
});

describe('κενή κατάσταση', () => {
  it('🔴 χωρίς δημιουργία (κάδος · αρχείο) ⇒ ζητά ΕΠΙΛΟΓΗ, δεν καλεί σε «Δημιουργία»', () => {
    mount(null, false);

    expect(screen.getByText('details.selectProperty')).toBeInTheDocument();
    expect(screen.queryByText('create-unit')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('✅ με δημιουργία ⇒ το κουμπί της κενής κατάστασης υπάρχει', () => {
    mount(null, false, jest.fn());

    expect(screen.getByRole('button', { name: /create-unit/ })).toBeInTheDocument();
  });
});
