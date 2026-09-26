/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 §9.1 Α4 — η `/shared/[token]` για περιήγηση. Το «κανένα ωμό κλειδί στο πρώτο καρέ» **δεν** ζει πια εδώ
 * (φραγμός `isNamespaceReady` = κενό καρέ σε επαναφόρτωση, CHECK 3.25): το φυλά το chunk της διαδρομής —
 * άγκυρα `utils/__tests__/lazyRouteFactory-namespaces.test.tsx`.
 */

import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

jest.mock('@/components/spatial-tour/TourViewSurface', () => ({
  TourViewSurface: () => <section data-testid="tour-surface" />,
}));

import { SharedTourPageContent } from '../SharedTourPageContent';
import type { SpatialTourShareResolvedData } from '@/services/sharing/resolvers/spatial-tour.resolver';

const withSubject = { subject: { kind: 'property', subjectId: 'prop_1' }, shareId: 'share_1' } as unknown as SpatialTourShareResolvedData;
const withoutSubject = { subject: null, shareId: 'share_1' } as unknown as SpatialTourShareResolvedData;

describe('SharedTourPageContent', () => {
  it('με θέμα: η επιφάνεια θέασης', () => {
    render(<SharedTourPageContent data={withSubject} />);
    expect(screen.getByTestId('tour-surface')).toBeTruthy();
  });

  it('χωρίς θέμα: το μήνυμα μη διαθεσιμότητας', () => {
    render(<SharedTourPageContent data={withoutSubject} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
