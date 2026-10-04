/**
 * ADR-899 §9 Ε4γ — **η στροφή δεν αλλάζει την ανάλυση** του πάνελ προεπισκόπησης.
 *
 * Μετρημένο ζωντανά 2026-10-04 (deploy `7402112f`): 3000×4000 σε κουτί 2352×928, στροφή 90° ⇒ layout του `<img>` **696×928**
 * (αμετάβλητο), ζωγραφισμένο 928×696 — ο άξονας πλάτους της εικόνας μένει **696** px. Το `scale(z) rotate(r)` δεν κάνει
 * layout. Η υπόθεση «στροφή = άλλο κουτί» δήλωνε `sizes` 936 ⇒ `w=1280` (287 KB) χωρίς κέρδος ευκρίνειας.
 *
 * Μετάλλαξη που πρέπει να πιάσει: η γωνία ξαναμπαίνει στην ερώτηση ανάλυσης (`paintedWidthOf` / `useZoomResolution`).
 *
 * ADR-899 §9 θέμα 3 — η γραμμή εργαλείων του πάνελ: κουμπιά **με όνομα** (ήταν χωρίς), `role="toolbar"`, και όριο zoom με
 * `aria-disabled` που **κρατά την εστίαση** (μάθημα θέματος 4). Μετάλλαξη: `aria-disabled` → `disabled` στο `ViewerToolbarButton`.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';

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

function renderPanel() {
  return render(
    <TooltipProvider>
      <FilePreviewRenderer url={ORIGINAL} contentType="image/jpeg" fileName="photo.jpg" displayName="φ" preview={PORTRAIT} />
    </TooltipProvider>,
  );
}

describe('ADR-899 §9 Ε4γ — FilePreviewRenderer: στροφή χωρίς νέα ανάλυση', () => {
  it('🔴 στροφή 90° και 180° ⇒ ίδιο `sizes` (936 × ¾ = 702), καμία φόρτωση', () => {
    renderPanel();
    const image = screen.getByRole('img');
    expect(image.getAttribute('sizes')).toBe('702px');

    const rotate = screen.getByRole('button', { name: 'photoPreview.actions.rotate' });
    fireEvent.click(rotate);
    expect(image.style.transform).toContain('rotate(90deg)');
    expect(image.getAttribute('sizes')).toBe('702px');
    fireEvent.click(rotate);
    expect(image.getAttribute('sizes')).toBe('702px');
    expect(decodes).toHaveLength(0);
  });
});

describe('ADR-899 §9 θέμα 3 — γραμμή εργαλείων του πάνελ', () => {
  it('🔴 toolbar με όνομα και τέσσερα κουμπιά με όνομα', () => {
    renderPanel();
    const toolbar = screen.getByRole('toolbar', { name: 'photoPreview.toolbar.ariaLabel' });
    const names = within(toolbar).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['photoPreview.zoom.out', 'photoPreview.zoom.in', 'photoPreview.actions.rotate', 'photoPreview.zoom.fit']);
  });

  it('🔴 στο ελάχιστο: `aria-disabled`, όχι `disabled` — η εστίαση μένει, το πάτημα είναι no-op', () => {
    renderPanel();
    const out = screen.getByRole('button', { name: 'photoPreview.zoom.out' });
    expect(out).toHaveAttribute('aria-disabled', 'true');
    expect(out).not.toBeDisabled();
    out.focus();
    fireEvent.click(out);
    expect(document.activeElement).toBe(out);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'photoPreview.zoom.in' }));
    expect(screen.getByText('150%')).toBeInTheDocument();
    expect(out).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'photoPreview.zoom.fit' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
