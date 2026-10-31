/**
 * ADR-923 §5.6.1 — το κουμπί προεπισκόπησης ζει σε χρήστη `products`, που **δεν** έχει `pricingView`: δεν πρέπει ποτέ να
 * ρωτήσει την όψη των συνταγών. Στέλνει μόνο το μοντέλο και δείχνει ό,τι απαντήσει ο διακομιστής.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { fetchPublicationPreview, fetchPublicationsView } from '@/services/catalog/catalog-publishing-api.client';
import type { PublicationPreviewWire } from '@/subapps/catalog/types/publication';
import { PublicationPreviewButton } from '../PublicationPreviewButton';

jest.mock('@/services/catalog/catalog-publishing-api.client', () => ({ fetchPublicationPreview: jest.fn(), fetchPublicationsView: jest.fn() }));
jest.mock('../../shared/catalog-ui-hooks', () => ({
  useCatalogText: () => ({ t: (key: string) => key }),
  useCatalogFailureNotice: () => jest.fn(),
}));

const preview = jest.mocked(fetchPublicationPreview);

async function press(result: PublicationPreviewWire): Promise<void> {
  preview.mockResolvedValueOnce(result);
  render(<PublicationPreviewButton modelId="model_1" />);
  fireEvent.click(screen.getByRole('button'));
  await screen.findByText(/.*/, { selector: '[role="status"], [role="alert"]' }).catch(() => undefined);
}

describe('PublicationPreviewButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('🔒 στέλνει μόνο το μοντέλο και δεν διαβάζει ποτέ συνταγές', async () => {
    await press({ status: 'noRecipe' });
    expect(preview).toHaveBeenCalledWith('model_1');
    expect(fetchPublicationsView).not.toHaveBeenCalled();
  });

  it('ο διακομιστής λέει «καμία συνταγή» ⇒ ζητά συνταγή, δεν δείχνει σφάλμα', async () => {
    await press({ status: 'noRecipe' });
    expect(screen.getByRole('status').textContent).toBe('publishing.preview.noRecipe');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('αδύνατη απόδοση ⇒ ένα μήνυμα', async () => {
    await press({ status: 'unavailable', failure: 'engineUnavailable' });
    expect(screen.getByRole('alert').textContent).toBe('publishing.preview.unavailable');
  });

  it('έτοιμη σελίδα ⇒ η εικόνα', async () => {
    preview.mockResolvedValueOnce({ status: 'ready', pngBase64: 'QUJD' });
    render(<PublicationPreviewButton modelId="model_1" />);
    fireEvent.click(screen.getByRole('button'));
    expect((await screen.findByRole('img')).getAttribute('src')).toBe('data:image/png;base64,QUJD');
  });
});
