/**
 * Α40.1 — ADR-866 §2.10.9: «επεξεργάζεται ο διακομιστής αυτό το αρχείο κάτοψης;» — ΜΙΑ απάντηση.
 *
 * Μετρημένο ζωντανά 2026-09-22: ο πελάτης έστελνε PNG **προσωπικού** φακέλου στο `/api/floorplans/process`
 * ⇒ `404 File not found`, ξανά σε κάθε αλλαγή της λίστας. Ο κανόνας (είδος + διαμέρισμα) ζει πλέον εδώ,
 * και τον ρωτούν **και** ο διακομιστής (`getFileType`) **και** ο πελάτης (`useFloorplanAutoProcess`).
 *
 * Α40.4 — η διαδρομή αρνείται άγνωστο είδος **ΠΡΙΝ** πάρει το κλείδωμα `processingStatus: 'processing'`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFileType } from '@/app/api/floorplans/process/floorplan-process.service';
import {
  floorplanProcessKindOf,
  isAutoProcessableFloorplan,
  type FloorplanProcessCandidate,
} from '../floorplan-processability';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const READY = { status: 'ready', downloadUrl: 'https://x/y' } as const;
const company = (ext: string): FloorplanProcessCandidate => ({ ...READY, ext, companyId: 'comp_1' });
const personal = (ext: string): FloorplanProcessCandidate => ({ ...READY, ext, userId: 'uid_1' });

describe('Α40.1 floorplanProcessKindOf — τα είδη του αγωγού, σε ΕΝΑ σημείο', () => {
  it.each([
    ['dxf', 'dxf'], ['DXF', 'dxf'], ['.dxf', 'dxf'], ['pdf', 'pdf'], ['.PDF', 'pdf'],
  ])('%s ⇒ %s', (ext, kind) => {
    expect(floorplanProcessKindOf(ext)).toBe(kind);
  });

  it.each(['png', 'jpg', 'webp', 'dwg', '', 'd.xf'])('%s ⇒ null', (ext) => {
    expect(floorplanProcessKindOf(ext)).toBeNull();
  });

  it('null/undefined ⇒ null', () => {
    expect(floorplanProcessKindOf(undefined)).toBeNull();
    expect(floorplanProcessKindOf(null)).toBeNull();
  });

  it('ο διακομιστής (getFileType) απαντά ΤΟ ΙΔΙΟ — όχι δικό του αντίγραφο', () => {
    for (const ext of ['dxf', '.PDF', 'png', '']) {
      expect(getFileType(ext)).toBe(floorplanProcessKindOf(ext));
    }
  });
});

describe('Α40.1 isAutoProcessableFloorplan — είδος + διαμέρισμα + ανάγκη', () => {
  it('εταιρικό DXF/PDF έτοιμο, χωρίς αποτέλεσμα ⇒ ναι', () => {
    expect(isAutoProcessableFloorplan(company('dxf'))).toBe(true);
    expect(isAutoProcessableFloorplan(company('pdf'))).toBe(true);
  });

  it('🔴 η ζωντανή περίπτωση: PNG προσωπικού φακέλου ⇒ όχι', () => {
    expect(isAutoProcessableFloorplan(personal('png'))).toBe(false);
  });

  it('προσωπικό DXF ⇒ όχι (ο αγωγός διαβάζει μόνο το εταιρικό διαμέρισμα)', () => {
    expect(isAutoProcessableFloorplan(personal('dxf'))).toBe(false);
  });

  it('εταιρική εικόνα ⇒ όχι (ο αγωγός δεν ξέρει εικόνες)', () => {
    expect(isAutoProcessableFloorplan(company('png'))).toBe(false);
  });

  it('χωρίς ακριβώς έναν κάτοχο ⇒ όχι — δεν μαντεύει', () => {
    expect(isAutoProcessableFloorplan({ ...READY, ext: 'dxf' })).toBe(false);
    expect(isAutoProcessableFloorplan({ ...READY, ext: 'dxf', companyId: 'c', userId: 'u' })).toBe(false);
  });

  it('μη έτοιμο · χωρίς bytes · ήδη επεξεργασμένο ⇒ όχι', () => {
    expect(isAutoProcessableFloorplan({ ...company('dxf'), status: 'pending' })).toBe(false);
    expect(isAutoProcessableFloorplan({ ...company('dxf'), downloadUrl: undefined })).toBe(false);
    expect(isAutoProcessableFloorplan({ ...company('dxf'), processedData: { fileType: 'dxf' } })).toBe(false);
  });
});

describe('Α40.4 /api/floorplans/process — άρνηση είδους ΠΡΙΝ το κλείδωμα', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/floorplans/process/route.ts'), 'utf8',
  );

  it('το UNSUPPORTED_TYPE απαντιέται πριν από το runTransaction του κλειδώματος', () => {
    const refusal = route.indexOf("errorCode: 'UNSUPPORTED_TYPE'");
    const lock = route.indexOf('adminDb.runTransaction(');
    expect(refusal).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(lock);
  });
});
