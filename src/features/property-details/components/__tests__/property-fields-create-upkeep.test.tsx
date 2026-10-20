/**
 * @fileoverview ADR-915 §37 (Γ) — **το συρτάρι δημιουργίας δείχνει την πρόταση μόνιμων υποχρεώσεων** από τα ΙΔΙΑ πεδία
 *   της φόρμας (είδος + φάση) — και **μόνο** στη δημιουργία.
 *
 * 🔴 Αληθινά: `PropertyFieldsBlock` και η ροή `formData` → προεπισκόπηση (`buildFormDataFromProperty`). Στελέχη: ό,τι
 *    μιλά με τον έξω κόσμο (δίκτυο · πάροχοι · βαριά παιδιά της φόρμας). Η ίδια η προεπισκόπηση έχει δικές της άγκυρες
 *    (`upkeep-create-preview.test.tsx`)· εδώ κρίνεται ΜΟΝΟ ότι η φόρμα της δίνει τα δικά της πεδία.
 */

import { render, waitFor } from '@testing-library/react';
import React from 'react';

import type { Property } from '@/types/property-viewer';

const previewProps = jest.fn();
jest.mock('@/components/document-registry/UpkeepCreatePreview', () => ({
  UpkeepCreatePreview: (props: Record<string, unknown>) => {
    previewProps(props);
    return null;
  },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ success: jest.fn(), error: jest.fn() }) }));
jest.mock('@/hooks/useSpacingTokens', () => ({ useSpacingTokens: () => ({}) }));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({}) }));
jest.mock('@/hooks/useBorderTokens', () => ({ useBorderTokens: () => ({ quick: {} }) }));
jest.mock('@/hooks/useTypography', () => ({ useTypography: () => ({}) }));
jest.mock('@/hooks/useUnsavedEdits', () => ({ useUnsavedEdits: () => undefined }));
jest.mock('@/hooks/properties/usePropertyFormSync', () => ({ usePropertyFormSync: () => undefined }));
jest.mock('@/hooks/useGuardedPropertyMutation', () => ({
  useGuardedPropertyMutation: () => ({ runExistingPropertyUpdate: jest.fn(), ImpactDialog: null }),
}));
jest.mock('@/services/property/property-mutation-gateway', () => ({ createPropertyWithPolicy: jest.fn() }));
jest.mock('../../hooks/useAutoLevelCreation', () => ({
  useAutoLevelCreation: () => ({
    triggerAutoLevelCreation: jest.fn(), dialogState: null, handleDialogConfirm: jest.fn(), handleDialogDismiss: jest.fn(),
    needsFloorCreation: false,
  }),
}));
jest.mock('../AutoLevelDialogs', () => ({ AutoLevelDialogs: () => null }));
jest.mock('../PropertyFieldsEditForm', () => ({ PropertyFieldsEditForm: () => null }));
jest.mock('../PropertyCompletionMeter', () => ({ PropertyCompletionMeter: () => null }));
jest.mock('@/components/properties/shared/NewUnitHierarchySection', () => ({ NewUnitHierarchySection: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PropertyFieldsBlock } = require('../PropertyFieldsBlock') as typeof import('../PropertyFieldsBlock');

const PROPERTY = { id: 'prop_1', name: 'Μονάδα', type: 'apartment', operationalStatus: 'ready' } as unknown as Property;

beforeEach(() => previewProps.mockReset());

describe('§37 (Γ) — η πρόταση στο συρτάρι δημιουργίας', () => {
  it('δημιουργία ⇒ η προεπισκόπηση παίρνει ΤΟ είδος και ΤΗ φάση της φόρμας', async () => {
    render(<PropertyFieldsBlock property={PROPERTY} isCreatingNewUnit isEditMode />);
    await waitFor(() => expect(previewProps).toHaveBeenCalled());
    expect(previewProps).toHaveBeenLastCalledWith({ type: 'apartment', phase: 'ready' });
  });

  it('υπάρχον ακίνητο ⇒ ΚΑΜΙΑ προεπισκόπηση (η απόφαση ζει στην καρτέλα «Έγγραφα»)', async () => {
    render(<PropertyFieldsBlock property={PROPERTY} isEditMode />);
    // Παρονομαστής: το ίδιο render στη δημιουργία ΤΗ φέρνει — εδώ η απουσία είναι απόφαση, όχι αργή φόρτωση.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(previewProps).not.toHaveBeenCalled();
  });
});
