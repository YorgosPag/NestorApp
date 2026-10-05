/**
 * ADR-899 §9 θέμα 5β — **η στροφή ξαναχωρά την εικόνα, και η ανάλυση ακολουθεί ό,τι ζωγραφίζεται**.
 *
 * Ιστορικό (Ε4γ, 2026-10-04): η στροφή **δεν** άλλαζε την ανάλυση, γιατί το `scale(z) rotate(r)` δεν έκανε layout και ο
 * άξονας πλάτους έμενε ίδιος. Με το «ξαναχωρά» (Google Photos) η κλίμακα γίνεται `zoom × fit`: κάθετη σε φαρδύ κουτί
 * ζωγραφίζεται ×1,333 ⇒ μεγαλύτερη βαθμίδα· οριζόντια μικραίνει ×0,75 ⇒ **καμία** λήψη. Η γωνία **δεν** είναι είσοδος της
 * ερώτησης ανάλυσης — μπαίνει μόνο το `scale` ως zoom.
 *
 * Μεταλλάξεις που πρέπει να πιάσει: ο καταναλωτής περνά `zoom` αντί `scale` · το fit δεν φτάνει στον μετασχηματισμό.
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
const LANDSCAPE = buildProxyPreview('a/photo.jpg', 'legacy-default', { width: 4000, height: 3000 });
/** Το layout του `<img>` (το jsdom δεν έχει διάταξη) — `object-contain` στο κουτί 1600×800. */
let imageLayout = { width: 600, height: 800 };
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
  // Φαρδύ κουτί 2:1 (σκαλοπάτι 16 ⇒ 1600×800 · άνω φράγμα +8 ⇒ 1608×808).
  HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 1600, 800);
  Object.defineProperties(HTMLImageElement.prototype, {
    offsetWidth: { configurable: true, get: () => imageLayout.width },
    offsetHeight: { configurable: true, get: () => imageLayout.height },
  });
});

beforeEach(() => {
  decodes.length = 0;
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = realRect;
});

function renderPanel(preview = PORTRAIT) {
  return render(
    <TooltipProvider>
      <FilePreviewRenderer url={ORIGINAL} contentType="image/jpeg" fileName="photo.jpg" displayName="φ" preview={preview} />
    </TooltipProvider>,
  );
}

describe('ADR-899 §9 θέμα 5β — FilePreviewRenderer: η στροφή ξαναχωρά', () => {
  it('🔴 κάθετη σε φαρδύ κουτί: 90° ⇒ ×1,333 και ΜΙΑ λήψη μεγαλύτερης βαθμίδας· το `sizes` δεν αλλάζει', () => {
    imageLayout = { width: 600, height: 800 };
    renderPanel();
    const image = screen.getByRole('img');
    expect(image.getAttribute('sizes')).toBe('606px'); // 808 × ¾ ⇒ βαθμίδα 640

    fireEvent.click(screen.getByRole('button', { name: 'photoPreview.actions.rotate' }));
    expect(image.style.transform).toMatch(/scale\(1\.33\d*\) rotate\(90deg\)/);
    expect(image.getAttribute('sizes')).toBe('606px');
    expect(decodes).toHaveLength(1); // 606 × 1,333 = 808 > 640
    expect(decodes[0]).toContain('w=1280');
    expect(screen.getByText('100%')).toBeInTheDocument(); // «100%» = «χωρά» σε κάθε γωνία
  });

  it('🔴 οριζόντια: 90° ⇒ ×0,75, καμία λήψη· 180° ⇒ πίσω στο 1', () => {
    imageLayout = { width: 1067, height: 800 };
    renderPanel(LANDSCAPE);
    const image = screen.getByRole('img');
    const rotate = screen.getByRole('button', { name: 'photoPreview.actions.rotate' });
    fireEvent.click(rotate);
    expect(image.style.transform).toMatch(/scale\(0\.75\) rotate\(90deg\)/);
    fireEvent.click(rotate);
    expect(image.style.transform).toContain('scale(1) rotate(180deg)');
    expect(decodes).toHaveLength(0);
  });
});

describe('ADR-899 §9 θέμα 7 — FilePreviewRenderer: το επόμενο αρχείο δεν κληρονομεί την όψη', () => {
  const NEXT = '/api/storage/file/b/next.jpg';
  const NEXT_PREVIEW = buildProxyPreview('b/next.jpg', 'legacy-default', { width: 3000, height: 4000 });

  it('🔴 στροφή → άλλο αρχείο στο ΙΔΙΟ πάνελ ⇒ ουδέτερη όψη, ακαριαία, και καμία λήψη με την κλίμακα του προηγούμενου', () => {
    imageLayout = { width: 600, height: 800 };
    const { rerender } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'photoPreview.actions.rotate' }));
    expect(screen.getByRole('img').style.transform).toMatch(/scale\(1\.33\d*\) rotate\(90deg\)/);
    expect(decodes).toHaveLength(1);

    rerender(
      <TooltipProvider>
        <FilePreviewRenderer url={NEXT} contentType="image/jpeg" fileName="next.jpg" displayName="ν" preview={NEXT_PREVIEW} />
      </TooltipProvider>,
    );
    const image = screen.getByRole('img');
    expect(image.style.transform).toBe('translate(0px, 0px) scale(1) rotate(0deg)');
    expect(image.style.transition).toBe('none');
    expect(image.getAttribute('src')).toContain('b/next.jpg');
    expect(decodes).toHaveLength(1); // το ×1,333 του προηγούμενου δεν έφτασε στην ερώτηση ανάλυσης του νέου
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
