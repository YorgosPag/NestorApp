/**
 * 🔗 Η ΑΓΚΥΡΑ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ ΘΕΑΤΗ ΚΑΙ ΤΗΣ ΚΑΛΩΔΙΩΣΗΣ ΤΗΣ (ADR-899 §9 θέμα 10, 2026-10-05).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Δ1: η διεύθυνση αλλάζει μορφή / παύει να κωδικοποιεί το id ⇒ σπασμένοι σύνδεσμοι και σελιδοδείκτες.
 * - Δ2: εταιρικό αρχείο ξαναπαίρνει γυμνή καρτέλα (ή καμία) αντί για τον θεατή — DXF/Office χάνουν την ενέργεια.
 * - Δ3: προσωπικό αρχείο παίρνει διεύθυνση θεατή γραφείου, όπου δεν θα βρεθεί ποτέ.
 * - Δ4: μια επιφάνεια ξαναγράφει τη δική της απόφαση αντί να ρωτά τον ΕΝΑΝ απαντητή.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { fileOpenInTabTarget } from '../file-open-in-tab';
import { FILE_VIEWER_PARAM, fileViewerHref } from '../file-viewer-route';

const source = (relative: string) => readFileSync(join(process.cwd(), 'src', relative), 'utf8');

describe('fileViewerHref', () => {
  test('🔴 Δ1 `/files?file=<id>` — χωρίς πρόθεμα χώρου, με κωδικοποιημένο id', () => {
    expect(FILE_VIEWER_PARAM).toBe('file');
    expect(fileViewerHref('file_227cec18')).toBe('/files?file=file_227cec18');
    expect(fileViewerHref('a b&c=d')).toBe('/files?file=a%20b%26c%3Dd');
  });
});

describe('fileOpenInTabTarget', () => {
  const dxf = { contentType: 'application/dxf', originalFilename: 'Ισόγειο.dxf', storagePath: 'companies/c1/files/f.dxf' };

  test('🔴 Δ2 εταιρικό αρχείο ⇒ ο θεατής, για ΚΑΘΕ τύπο (DXF · Office · PDF)', () => {
    const viewer = { kind: 'viewer', href: '/files?file=file_1' };
    expect(fileOpenInTabTarget({ ...dxf, id: 'file_1', companyId: 'c1' })).toEqual(viewer);
    expect(fileOpenInTabTarget({ id: 'file_1', companyId: 'c1', contentType: 'application/msword', originalFilename: 'a.doc' })).toEqual(viewer);
    expect(fileOpenInTabTarget({ id: 'file_1', companyId: 'c1', contentType: 'application/pdf', downloadUrl: 'https://x.test/a.pdf' })).toEqual(viewer);
  });

  test('🔴 Δ3 προσωπικό αρχείο ⇒ ποτέ θεατής γραφείου: γυμνή καρτέλα όπου ο browser αποδίδει, αλλιώς τίποτα', () => {
    expect(fileOpenInTabTarget({ id: 'f', userId: 'u1', contentType: 'application/pdf', originalFilename: 'a.pdf', downloadUrl: 'https://x.test/a.pdf' }))
      .toEqual({ kind: 'native', url: 'https://x.test/a.pdf' });
    expect(fileOpenInTabTarget({ ...dxf, id: 'f', userId: 'u1' })).toEqual({ kind: 'none' });
  });

  test('🔴 Δ3 χωρίς ταυτότητα ή χωρίς ΑΚΡΙΒΩΣ έναν κάτοχο ⇒ ο απαντητής δεν μαντεύει διαμέρισμα', () => {
    expect(fileOpenInTabTarget({ ...dxf, companyId: 'c1' })).toEqual({ kind: 'none' });
    expect(fileOpenInTabTarget({ ...dxf, id: 'f' })).toEqual({ kind: 'none' });
    expect(fileOpenInTabTarget({ ...dxf, id: 'f', companyId: 'c1', userId: 'u1' })).toEqual({ kind: 'none' });
  });
});

// ⚠️ Άγκυρες ΠΗΓΑΙΟΥ κώδικα, όχι συμπεριφοράς: οι επιφάνειες ρωτούν τον ΕΝΑΝ απαντητή μέσα από τη ΜΙΑ επιφάνεια.
describe('🔴 Δ4 καλωδίωση', () => {
  test('το πάνελ, το διπλό κλικ και τα Εισερχόμενα περνούν από το FileOpenInTabAction', () => {
    const panel = source('components/file-manager/FilePreviewPanel.tsx');
    expect(panel).toContain('<FileOpenInTabButton');
    const handlers = source('components/file-manager/file-manager-handlers.ts');
    expect(handlers).toContain('const handleFileDoubleClick = useOpenFileInNewTab();');
    const inbox = source('components/shared/files/InboxView.tsx');
    expect(inbox).toContain('<FileOpenInTabButton');
    expect(inbox).toContain('handleDownload(file)');
    for (const surface of [panel, handlers, inbox]) {
      expect(surface).not.toContain('openRemoteUrlInNewTab');
      expect(surface).not.toContain('fileOpenInTabUrl');
    }
  });

  test('η ΜΙΑ επιφάνεια ρωτά τον απαντητή και περνά τον θεατή από το σύνορο πλοήγησης', () => {
    const action = source('components/shared/files/FileOpenInTabAction.tsx');
    expect(action).toContain("from '@/lib/workspace/navigation'");
    expect(action).toContain('fileOpenInTabTarget(record)');
    expect(action).toContain('openRemoteUrlInNewTab(resolve(target.href))');
    expect(action).not.toContain('window.open(');
  });

  test('η επιλογή του /files ζει στη διεύθυνση, και η μορφή διαδρομής ανακατευθύνει στην ίδια', () => {
    const state = source('components/file-manager/useFileManagerState.ts');
    expect(state).toContain('useFileViewerSelection(');
    expect(state).not.toMatch(/useState<FileRecord \| null>/);
    expect(source('components/file-manager/useFileViewerSelection.ts')).toContain('useSelectedEntityUrlState(FILE_VIEWER_PARAM)');
    expect(source('app/(app)/o/[workspace]/files/[id]/page.tsx')).toContain('redirect(fileViewerHref(id), workspace)');
  });
});
