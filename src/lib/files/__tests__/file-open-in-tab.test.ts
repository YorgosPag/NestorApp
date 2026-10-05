/**
 * 🔗 Η ΑΓΚΥΡΑ ΤΟΥ «ΑΝΟΙΓΜΑ ΣΕ ΝΕΑ ΚΑΡΤΕΛΑ» (ADR-899 §9 θέμα 9, 2026-10-05).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Α1: ο απαντητής ξαναγίνεται σκέτο `fileDisplayUrl` ⇒ ένα DXF «ανοίγει» ως λήψη / ωμό κείμενο.
 * - Α2: το `html` μπαίνει στους τύπους του browser ⇒ αποθηκευμένο HTML αποδίδεται στη δική μας προέλευση.
 * - Α3: το URL παύει να περνά από τον ΕΝΑΝ αναγνώστη ⇒ εικόνα χωρίς `downloadUrl` χάνει την ενέργεια.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { buildProxyUrl } from '@/lib/storage/storage-object-url';

import { fileOpenInTabUrl } from '../file-open-in-tab';

const DXF = 'companies/c1/entities/property/p1/domains/construction/categories/floorplans/files/file_9.dxf';
const sceneUrl = `https://firebasestorage.googleapis.com/v0/b/bucket.test/o/${encodeURIComponent(DXF.replace(/\.dxf$/, '.scene.json'))}?alt=media&token=t`;

describe('fileOpenInTabUrl', () => {
  test('🔴 Α1 εγγραφή CAD της παραγωγής ⇒ καμία καρτέλα: ούτε το JSON της σκηνής, ούτε ωμό DXF', () => {
    expect(fileOpenInTabUrl({
      downloadUrl: sceneUrl, storagePath: DXF, contentType: 'application/dxf', originalFilename: 'Ισόγειο 1.dxf',
    })).toBeNull();
  });

  test('🔴 Α1 τύποι που ο browser δεν αποδίδει (Office, άγνωστοι) ⇒ null, ακόμη κι αν υπάρχει URL', () => {
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(fileOpenInTabUrl({ downloadUrl: 'https://x.test/a.docx', contentType: docx, originalFilename: 'a.docx' })).toBeNull();
    expect(fileOpenInTabUrl({ downloadUrl: 'https://x.test/a.glb', contentType: 'model/gltf-binary', originalFilename: 'a.glb' })).toBeNull();
  });

  test('🔴 Α2 αποθηκευμένο HTML δεν ανοίγει ποτέ σε καρτέλα', () => {
    expect(fileOpenInTabUrl({ downloadUrl: 'https://x.test/a.html', contentType: 'text/html', originalFilename: 'a.html' })).toBeNull();
  });

  test('τύποι που ο browser αποδίδει ⇒ το URL του ΕΝΟΣ αναγνώστη', () => {
    expect(fileOpenInTabUrl({ downloadUrl: 'https://x.test/a.pdf', contentType: 'application/pdf', originalFilename: 'a.pdf' }))
      .toBe('https://x.test/a.pdf');
    expect(fileOpenInTabUrl({ downloadUrl: 'https://x.test/a.jpg', contentType: 'image/jpeg', originalFilename: 'a.jpg' }))
      .toBe('https://x.test/a.jpg');
  });

  // ⚠️ Άγκυρα ΠΗΓΑΙΟΥ κώδικα, όχι συμπεριφοράς: οι δύο επιφάνειες του file manager ρωτούν τον ΕΝΑΝ απαντητή.
  test('🔴 Α4 το πάνελ και το διπλό κλικ του file manager περνούν από τον fileOpenInTabUrl', () => {
    const source = (relative: string) => readFileSync(join(process.cwd(), 'src/components/file-manager', relative), 'utf8');
    const panel = source('FilePreviewPanel.tsx');
    expect(panel).toContain('openRemoteUrlInNewTab(openInTabUrl)');
    expect(panel).toContain('{openInTabUrl && (');
    expect(panel).not.toContain('openRemoteUrlInNewTab(fileUrl)');
    const handlers = source('file-manager-handlers.ts');
    expect(handlers).toContain('openRemoteUrlInNewTab(fileOpenInTabUrl(file))');
    expect(handlers).not.toContain('fileDisplayUrl(');
  });

  test('🔴 Α3 εικόνα χωρίς `downloadUrl` ⇒ το proxy του `storagePath` · χωρίς τίποτα ⇒ null', () => {
    const path = 'companies/c1/files/file_1.jpg';
    expect(fileOpenInTabUrl({ storagePath: path, contentType: 'image/jpeg', originalFilename: 'a.jpg' })).toBe(buildProxyUrl(path));
    expect(fileOpenInTabUrl({ contentType: 'image/jpeg', originalFilename: 'a.jpg' })).toBeNull();
  });
});
