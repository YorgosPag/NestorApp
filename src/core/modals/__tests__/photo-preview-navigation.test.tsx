/**
 * @fileoverview **Πλοήγηση του `PhotoPreviewModal`: ΜΙΑ πολιτική για κουμπιά και πληκτρολόγιο** (ADR-899 §9 · θέμα 4).
 *
 * Μετρημένο ζωντανά: τα κουμπιά σταματούσαν στο 4/4, το → πήγαινε 1/4 (λούπα) · Enter στο «Επόμενη» στο 3/4 πετούσε
 * την εστίαση στο `<body>`, έξω από το dialog. Μεταλλάξεις που πρέπει να πιάσει:
 * - Μ1: το πληκτρολόγιο κάνει λούπα στο άκρο.
 * - Μ2: το κουμπί στο άκρο γίνεται `disabled` (πετά την εστίαση) αντί για `aria-disabled`.
 * - Μ3: η θέση ανακοινώνεται με hardcoded κείμενο / στο πρώτο άνοιγμα / καθόλου από το πληκτρολόγιο.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';

import { PhotoPreviewModal } from '../PhotoPreviewModal';

const announce = jest.fn();
jest.mock('@/utils/accessibility', () => ({ announceToScreenReader: (message: string) => announce(message) }));
jest.mock('@/components/shared/files/hooks/useFileDownload', () => ({ useFileDownload: () => ({ handleDownload: jest.fn() }) }));
// Το ShareButton σέρνει όλο το i18n bootstrap + ShareModal — άσχετο με την πλοήγηση.
jest.mock('@/components/ui/ShareButton', () => ({ ShareButton: () => null }));
// Τα factories του jest.mock ανυψώνονται πάνω από τα imports ⇒ δεν βλέπουν εξωτερικές σταθερές.
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params && 'current' in params ? `${key}:${params.current}/${params.total}` : key),
  }),
}));
// Το `Dialog` του design system μεταφράζει μέσω του δικού μας wrapper.
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const PHOTOS = ['/a.jpg', '/b.jpg', '/c.jpg'];
const NEXT = 'photoPreview.navigation.next';
const PREVIOUS = 'photoPreview.navigation.previous';

function renderAt(index: number) {
  return render(
    <TooltipProvider>
      <PhotoPreviewModal open onOpenChange={() => undefined} photoUrl={PHOTOS[index]}
        galleryPhotos={PHOTOS} currentGalleryIndex={index} />
    </TooltipProvider>,
  );
}

const imageSrc = () => screen.getByRole('dialog').querySelector('figure img')?.getAttribute('src');
const pressKey = (key: string) => act(() => { fireEvent.keyDown(document, { key }); });

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => announce.mockClear());

describe('PhotoPreviewModal — πλοήγηση', () => {
  it('🔴 Μ1 → στο τελευταίο ΜΕΝΕΙ (όπως το κουμπί) · ← στο πρώτο ΜΕΝΕΙ', () => {
    renderAt(2);
    pressKey('ArrowRight');
    expect(imageSrc()).toContain('/c.jpg');
    fireEvent.click(screen.getByRole('button', { name: NEXT }));
    expect(imageSrc()).toContain('/c.jpg');

    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    pressKey('ArrowLeft');
    expect(imageSrc()).toContain('/a.jpg');
  });

  it('🔴 Μ2 στο άκρο: aria-disabled, ΟΧΙ disabled — η εστίαση μένει στο κουμπί, μέσα στο dialog', () => {
    renderAt(1);
    const next = screen.getByRole('button', { name: NEXT });
    next.focus();
    fireEvent.click(next);

    expect(imageSrc()).toContain('/c.jpg');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(next.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(next);
    expect(screen.getByRole('button', { name: PREVIOUS }).getAttribute('aria-disabled')).toBeNull();
  });

  it('🔴 Μ3 ανακοίνωση με το κλειδί i18n, από κουμπί ΚΑΙ πληκτρολόγιο, όχι στο άνοιγμα, όχι στο άκρο', () => {
    renderAt(0);
    expect(announce).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: NEXT }));
    pressKey('ArrowRight');
    pressKey('ArrowRight');

    expect(announce.mock.calls.map(([message]) => message)).toEqual([
      'photoPreview.navigation.slide:2/3',
      'photoPreview.navigation.slide:3/3',
    ]);
  });
});
