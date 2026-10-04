/**
 * ADR-899 §9 Ε4γ — **η στροφή δεν αλλάζει την ανάλυση** του πάνελ προεπισκόπησης.
 *
 * Μετρημένο ζωντανά 2026-10-04 (deploy `7402112f`): 3000×4000 σε κουτί 2352×928, στροφή 90° ⇒ layout του `<img>` **696×928**
 * (αμετάβλητο), ζωγραφισμένο 928×696 — ο άξονας πλάτους της εικόνας μένει **696** px. Το `scale(z) rotate(r)` δεν κάνει
 * layout. Η υπόθεση «στροφή = άλλο κουτί» δήλωνε `sizes` 936 ⇒ `w=1280` (287 KB) χωρίς κέρδος ευκρίνειας.
 *
 * Μετάλλαξη που πρέπει να πιάσει: η γωνία ξαναμπαίνει στην ερώτηση ανάλυσης (`paintedWidthOf` / `useZoomResolution`).
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { buildProxyPreview } from '@/lib/storage/storage-object-url';

import { FilePreviewRenderer } from '../FilePreviewRenderer';

jest.mock('@/components/file-manager/PdfCanvasViewer', () => ({ PdfCanvasViewer: () => null }));
jest.mock('@/components/file-manager/preview/DocxPreview', () => ({ DocxPreview: () => null }));
jest.mock('@/components/file-manager/preview/ExcelPreview', () => ({ ExcelPreview: () => null }));
jest.mock('@/components/file-manager/preview/XmlPreview', () => ({ XmlPreview: () => null }));
jest.mock('@/components/file-manager/preview/TxtPreview', () => ({ TxtPreview: () => null }));
jest.mock('@/components/file-manager/preview/HtmlPreview', () => ({ HtmlPreview: () => null }));
jest.mock('@/components/file-manager/preview/DxfPreview', () => ({ DxfPreview: () => null }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const ORIGINAL = '/api/storage/file/a/photo.jpg';
const PORTRAIT = buildProxyPreview('a/photo.jpg', 'legacy-default', { width: 3000, height: 4000 });
const decodes: string[] = [];
const realRect = HTMLElement.prototype.getBoundingClientRect;

beforeAll(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  class FakeImage {
    src = '';
    decode(): Promise<void> {
      decodes.push(this.src);
      return new Promise(() => undefined);
    }
  }
  (globalThis as { Image: unknown }).Image = FakeImage;
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  // Το κουτί του πάνελ όπως μετρήθηκε ζωντανά (σκαλοπάτι 16 ⇒ 2352×928 · άνω φράγμα +8 ⇒ 2360×936).
  HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 2352, 928);
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = realRect;
});

describe('ADR-899 §9 Ε4γ — FilePreviewRenderer: στροφή χωρίς νέα ανάλυση', () => {
  it('🔴 στροφή 90° και 180° ⇒ ίδιο `sizes` (936 × ¾ = 702), καμία φόρτωση', () => {
    render(
      <FilePreviewRenderer url={ORIGINAL} contentType="image/jpeg" fileName="photo.jpg" displayName="φ" preview={PORTRAIT} />,
    );
    const image = screen.getByRole('img');
    expect(image.getAttribute('sizes')).toBe('702px');

    // [σμίκρυνση, μεγέθυνση, στροφή] — η σειρά της γραμμής εργαλείων του πάνελ.
    const rotate = screen.getAllByRole('button')[2];
    fireEvent.click(rotate);
    expect(image.style.transform).toContain('rotate(90deg)');
    expect(image.getAttribute('sizes')).toBe('702px');
    fireEvent.click(rotate);
    expect(image.getAttribute('sizes')).toBe('702px');
    expect(decodes).toHaveLength(0);
  });
});
