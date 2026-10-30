/**
 * **Το πλαίσιο σελίδας καταλόγου φράζει το ύψος του** (ADR-923 §5.11 «3δ» Σ8 — ζωντανό εύρημα 2026-10-30).
 *
 * Ζωντανά (εκπτώσεις, 2400×1121): η `main` του κελύφους δεν είναι flex, άρα το `flex-1 min-h-0` του πλαισίου δεν φράζει
 * τίποτα ⇒ ο εσωτερικός κυλιστής του side peek 1198/1198 (νεκρός), κυλούσε η σελίδα, η «Αποθήκευση» στα 1491px.
 * Το jsdom δεν έχει διάταξη: η άγκυρα κρατά τον **όρο** (`h-full`) και ότι **δεν** κόβει (`overflow-hidden`).
 */
import { render } from '@testing-library/react';

import { CatalogPageFrame } from '../CatalogPageFrame';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

describe('CatalogPageFrame — φραγμένο ύψος', () => {
  it('🔴 το πλαίσιο παίρνει το ύψος της main (h-full) ώστε οι εσωτερικοί κυλιστές να ζουν — και δεν κόβει', () => {
    const { container } = render(<CatalogPageFrame title="t" lead="l" state="ready"><p>x</p></CatalogPageFrame>);
    const frame = container.querySelector('section');
    const classes = frame?.className.split(/\s+/) ?? [];
    expect(classes).toEqual(expect.arrayContaining(['h-full', 'min-h-0', 'flex-1', 'flex-col']));
    expect(classes).not.toContain('overflow-hidden');
  });
});
