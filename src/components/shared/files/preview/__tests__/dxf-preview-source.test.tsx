/**
 * ADR-899 §9 θέμα 8 — **το πάνελ ζητά τη σκηνή DXF από τον ίδιο δρόμο με το `FloorplanGallery`**, και μια σκηνή
 * χωρίς οντότητες δεν είναι ποτέ σιωπηλός λευκός καμβάς.
 *
 * Μετρημένο στην παραγωγή (2026-10-05): οι εγγραφές CAD έχουν `ext: 'dxf'`, `storagePath → ….dxf`, αλλά
 * `downloadUrl → ….scene.json`. Το πάνελ έχτιζε «ελάχιστη εγγραφή» χωρίς `processedData`, κατέβαζε το JSON και το
 * έδινε στον αναλυτή DXF ⇒ επιτυχία με 0 οντότητες ⇒ καμβάς 300×150, λευκός, χωρίς σφάλμα.
 *
 * Εδώ τρέχουν τα **πραγματικά** `FilePreviewRenderer` → `DxfPreview` → `useFloorplanSceneLoader` →
 * `loadSceneFromBytes`. Ψεύτικα μόνο το δίκτυο, ο αναλυτής DXF και η ζωγραφική (το jsdom δεν έχει καμβά).
 *
 * Μεταλλάξεις που πρέπει να πιάσει: ο renderer δεν προωθεί το `record` · η ταξινόμηση απαντά πάντα `dxf` · ο
 * καταναλωτής αγνοεί το `isEmpty` · σταθερό `contentKey`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, render, screen, waitFor } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { FileRecord } from '@/types/file-record';

import { FilePreviewRenderer } from '../FilePreviewRenderer';

const importDxfFile = jest.fn();
const renderDxfToCanvas = jest.fn();

jest.mock('@/components/file-manager/PdfCanvasViewer', () => ({ PdfCanvasViewer: () => null }));
jest.mock('@/components/file-manager/preview/DocxPreview', () => ({ DocxPreview: () => null }));
jest.mock('@/components/file-manager/preview/ExcelPreview', () => ({ ExcelPreview: () => null }));
jest.mock('@/components/file-manager/preview/XmlPreview', () => ({ XmlPreview: () => null }));
jest.mock('@/components/file-manager/preview/TxtPreview', () => ({ TxtPreview: () => null }));
jest.mock('@/components/file-manager/preview/HtmlPreview', () => ({ HtmlPreview: () => null }));
// Σταθερή ταυτότητα `t`, όπως στο πραγματικό i18next: ο φορτωτής το έχει στις εξαρτήσεις του effect.
jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { subscribeDoc: () => () => undefined },
}));
jest.mock('@/subapps/dxf-viewer/io/dxf-import', () => ({
  dxfImportService: { importDxfFile: (...args: unknown[]) => importDxfFile(...args) },
}));
jest.mock('@/services/floorplans/dxf-scene-data-projection', () => ({ toDxfSceneData: (scene: unknown) => scene }));
jest.mock('@/components/shared/files/media/floorplan-dxf-renderer', () => ({
  renderDxfToCanvas: (...args: unknown[]) => renderDxfToCanvas(...args),
}));

const LINE = { id: 'line_0', type: 'line', layer: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
const SCENE_JSON = JSON.stringify({ entities: [LINE], layers: {} });
const EMPTY_SCENE_JSON = JSON.stringify({ entities: [], layers: {} });
const DXF_TEXT = '0\nSECTION\n2\nENTITIES\n0\nLINE\n0\nENDSEC\n0\nEOF\n';

const SCENE_URL = 'https://storage.test/o/file_a.scene.json?alt=media';
const SIGNED_DXF_URL = 'https://storage.test/signed/file_a.dxf';

/** Η μορφή της παραγωγής: `ext: dxf`, αλλά το `downloadUrl` δείχνει στο συνοδευτικό `.scene.json`. */
function cadRecord(id: string): FileRecord {
  return {
    id,
    ext: 'dxf',
    status: 'ready',
    contentType: 'application/dxf',
    originalFilename: 'Ισόγειο 1.dxf',
    storagePath: `companies/c/files/${id}.dxf`,
    downloadUrl: SCENE_URL,
    processedData: { fileType: 'dxf', processedDataPath: `companies/c/files/${id}.scene.json` },
  } as unknown as FileRecord;
}

const fetched: string[] = [];
let bodies: Record<string, string> = {};

/** Ψεύτικο δίκτυο: το σώμα διαλέγεται από το πρώτο κλειδί που περιέχεται στο URL. */
function installFetch(): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetched.push(url);
    const key = Object.keys(bodies).find((k) => url.includes(k));
    const body = key === undefined ? '' : bodies[key];
    return {
      ok: key !== undefined,
      status: key !== undefined ? 200 : 404,
      json: async () => JSON.parse(body),
      blob: async () => new Blob([body]),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

const realFetch = global.fetch;
const realObserver = global.ResizeObserver;

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  fetched.length = 0;
  bodies = {};
  importDxfFile.mockReset();
  renderDxfToCanvas.mockReset();
  installFetch();
});

afterAll(() => {
  global.fetch = realFetch;
  global.ResizeObserver = realObserver;
});

function panel(props: { url: string; record?: FileRecord | null; displayName?: string }) {
  return (
    <TooltipProvider>
      <FilePreviewRenderer
        url={props.url}
        record={props.record}
        contentType="application/dxf"
        fileName="Ισόγειο 1.dxf"
        displayName={props.displayName ?? 'σχέδιο'}
      />
    </TooltipProvider>
  );
}

const lastPaint = () => renderDxfToCanvas.mock.calls[renderDxfToCanvas.mock.calls.length - 1];

describe('ADR-899 §9 θέμα 8 — από πού έρχεται η σκηνή του DXF preview', () => {
  it('🔴 εγγραφή CAD ⇒ η σκηνή από το scene API· το `downloadUrl` (.scene.json) ΔΕΝ κατεβαίνει και ο αναλυτής ΔΕΝ τρέχει', async () => {
    bodies = { '/api/floorplans/scene': SCENE_JSON };
    render(panel({ url: SCENE_URL, record: cadRecord('file_a') }));

    await waitFor(() => expect(renderDxfToCanvas).toHaveBeenCalled());
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain('/api/floorplans/scene');
    expect(fetched[0]).toContain('file_a');
    expect(importDxfFile).not.toHaveBeenCalled();
    expect(lastPaint()[1].entities).toHaveLength(1);
  });

  it('χωρίς εγγραφή (σελίδα κοινοποίησης): πρωτότυπο DXF από το URL ⇒ αναλυτής', async () => {
    bodies = { [SIGNED_DXF_URL]: DXF_TEXT };
    importDxfFile.mockResolvedValue({ success: true, scene: { entities: [LINE], layers: {} } });
    render(panel({ url: SIGNED_DXF_URL }));

    await waitFor(() => expect(renderDxfToCanvas).toHaveBeenCalled());
    expect(fetched).toEqual([SIGNED_DXF_URL]);
    expect(importDxfFile).toHaveBeenCalledTimes(1);
  });

  it('🔴 χωρίς εγγραφή, αλλά τα bytes είναι JSON σκηνής ⇒ διαβάζονται ως σκηνή, ΠΟΤΕ από τον αναλυτή DXF', async () => {
    bodies = { [SCENE_URL]: SCENE_JSON };
    // Ό,τι έκανε ο αναλυτής στην παραγωγή όταν του δόθηκε JSON: «επιτυχία» με 0 οντότητες.
    importDxfFile.mockResolvedValue({ success: true, scene: { entities: [], layers: {} } });
    render(panel({ url: SCENE_URL }));

    await waitFor(() => expect(renderDxfToCanvas).toHaveBeenCalled());
    expect(importDxfFile).not.toHaveBeenCalled();
    expect(lastPaint()[1].entities).toHaveLength(1);
  });

  it('🔴 bytes που δεν είναι ούτε σκηνή ούτε DXF ⇒ ονομασμένο σφάλμα, όχι άδεια σκηνή', async () => {
    bodies = { [SIGNED_DXF_URL]: '<!DOCTYPE html><html><body>Sign in</body></html>' };
    render(panel({ url: SIGNED_DXF_URL }));

    expect(await screen.findByText('preview.dxfError')).toBeInTheDocument();
    expect(importDxfFile).not.toHaveBeenCalled();
    expect(document.querySelector('canvas')).toBeNull();
  });
});

describe('ADR-899 §9 θέμα 8 — σκηνή με 0 οντότητες', () => {
  it('🔴 ρητή κατάσταση «κενό σχέδιο»: ούτε καμβάς ούτε ζωγραφική', async () => {
    bodies = { '/api/floorplans/scene': EMPTY_SCENE_JSON };
    render(panel({ url: SCENE_URL, record: cadRecord('file_a') }));

    expect(await screen.findByText('preview.dxfEmpty')).toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeNull();
    expect(renderDxfToCanvas).not.toHaveBeenCalled();
  });
});

/**
 * Καλωδίωση οικοδεσποτών — **άγκυρα πηγαίου κώδικα**, όχι συμπεριφοράς: το `FilePreviewPanel` και το
 * `FloorplanGallery` σέρνουν δεκάδες εξαρτήσεις και δεν στήνονται εδώ. Πιάνει τη διαγραφή της γραμμής, όχι κάθε
 * τρόπο να σπάσει — η συμπεριφορά τους επαληθεύεται ζωντανά (ADR-899 §9 θέμα 8).
 */
describe('ADR-899 §9 θέμα 8 — καλωδίωση οικοδεσποτών (πηγαίος κώδικας)', () => {
  const source = (relative: string) => readFileSync(resolve(__dirname, relative), 'utf8');

  it('το `FilePreviewPanel` δίνει την εγγραφή στον renderer', () => {
    expect(source('../../../../file-manager/FilePreviewPanel.tsx')).toMatch(/<FilePreviewRenderer[^>]*\brecord=\{file\}/s);
  });

  it('το `DxfPreview` δεν χτίζει πια ψεύτικη εγγραφή', () => {
    const dxfPreview = source('../../../../file-manager/preview/DxfPreview.tsx');
    expect(dxfPreview).not.toMatch(/as unknown as FileRecord/);
    expect(dxfPreview).not.toMatch(/minimalRecord\b\s*[:=]/);
  });

  it('το `FloorplanGallery` δεν δείχνει καμβά για άδεια σκηνή και λέει «κενό σχέδιο»', () => {
    const gallery = source('../../media/FloorplanGallery.tsx');
    expect(gallery).toMatch(/showCanvas = \(isDxf && loadedScene && !isEmpty\)/);
    expect(gallery).toMatch(/isDxf && isEmpty[^\n]*\n[\s\S]{0,400}preview\.dxfEmpty/);
  });
});

describe('ADR-899 §9 θέμα 7 — DxfPreview: το επόμενο σχέδιο δεν κληρονομεί την όψη', () => {
  it('🔴 τροχός στο Α → σχέδιο Β στο ΙΔΙΟ πάνελ ⇒ zoom 1, pan 0', async () => {
    bodies = { '/api/floorplans/scene': SCENE_JSON };
    const { rerender } = render(panel({ url: SCENE_URL, record: cadRecord('file_a'), displayName: 'Α' }));
    await waitFor(() => expect(renderDxfToCanvas).toHaveBeenCalled());

    const figure = screen.getByRole('figure', { name: 'Α' });
    figure.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
    act(() => {
      figure.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, clientX: 600, clientY: 100, cancelable: true }));
    });
    expect(lastPaint()[2]).toBeGreaterThan(1);
    expect(lastPaint()[3]).not.toEqual({ x: 0, y: 0 });

    rerender(panel({ url: SCENE_URL, record: cadRecord('file_b'), displayName: 'Β' }));
    await waitFor(() => expect(fetched.some((u) => u.includes('file_b'))).toBe(true));
    await waitFor(() => expect(lastPaint()[2]).toBe(1));
    expect(lastPaint()[3]).toEqual({ x: 0, y: 0 });
  });
});
