/**
 * ADR-651 Φάση Ε — **σφραγίδα-ως-εικόνα** + **έλεγχος πληρότητας**.
 *
 * Το ζητούμενο του Giorgio: (α) ανεβάζω σφραγίδα → εμφανίζεται στο κελί σφραγίδας **στην
 * οθόνη ΚΑΙ στο PDF, στην ίδια θέση/μέγεθος**, (β) σχέδιο χωρίς Α.Μ. ΤΕΕ / κλίμακα → ο
 * διάλογος εκτύπωσης **λέει τι λείπει** (χωρίς να μπλοκάρει).
 *
 * Τα tests κλειδώνουν ακριβώς αυτά: ένα layout model → τρία backends (PDF primitives ===
 * in-scene entities), και έναν κανόνα πληρότητας που **παράγεται από το registry**.
 */

import { detailPrimitivesToEntities } from '../../../bim/structural/detail-sheet/render/detail-primitives-to-entities';
import { containFitRectMm } from '../../../bim/structural/detail-sheet/render/detail-raster-fit';
import type { PaperSpec } from '../../../print/config/paper-types';
import { isImageEntity } from '../../../types/entities';
import { TITLE_BLOCK_PERMIT_EL, TITLE_BLOCK_SIMPLE_EL } from '../../templates/defaults/title-blocks';
import type { PlaceholderScope } from '../../templates/resolver/scope.types';
import { buildPrintSheet } from '../print-sheet';
import { computeSheetFrameMetrics } from '../sheet-frame';
import {
  PERMIT_REQUIRED_PATHS,
  validateTitleBlock,
  issueLabelKeys,
} from '../title-block-compliance';
import { buildTitleBlockLayout, type TitleBlockStampImage } from '../title-block-layout';
import type { TitleBlockContent } from '../title-block-rows';

const PAPER: PaperSpec = { size: 'A3', orientation: 'landscape' };

const CONTENT: TitleBlockContent = {
  heading: 'ΓΡΑΦΕΙΟ ΜΕΛΕΤΩΝ',
  rows: [
    { label: 'Έργο:', value: 'Οικία Παπαδοπούλου' },
    { label: 'Κλίμακα:', value: '1:50' },
    { label: 'Α.Μ. ΤΕΕ:', value: '12345' },
  ],
};

/** Ρεαλιστική σφραγίδα: ορθογώνια (2:1) — η αναλογία ΠΡΕΠΕΙ να διατηρηθεί. */
const STAMP: TitleBlockStampImage = {
  src: 'https://firebasestorage.example/stamp.png',
  widthPx: 400,
  heightPx: 200,
};

const STAMP_OPTIONS = {
  paper: PAPER,
  withFrame: true,
  withStampBox: true,
  stampLabel: 'ΣΦΡΑΓΙΔΑ / ΥΠΟΓΡΑΦΗ',
};

function rasterOf(primitives: readonly { kind: string }[]) {
  return primitives.filter((p) => p.kind === 'raster');
}

describe('ADR-651 Φάση Ε — η σφραγίδα ως εικόνα στο κελί σφραγίδας', () => {
  it('χωρίς ανεβασμένη εικόνα το κελί μένει ΚΕΝΟ (Απόφαση #6γ — σφράγιση με το χέρι)', () => {
    const layout = buildTitleBlockLayout(CONTENT, { ...STAMP_OPTIONS, stampImage: null });
    expect(rasterOf(layout.primitives)).toHaveLength(0);
    // Το κουτί + ο υπότιτλος παραμένουν — το κελί υπάρχει, απλώς είναι άδειο.
    expect(layout.primitives.some((p) => p.kind === 'text')).toBe(true);
  });

  it('με εικόνα παράγει ΕΝΑ raster ΜΕΣΑ στο κελί σφραγίδας, με διατηρημένη αναλογία', () => {
    const layout = buildTitleBlockLayout(CONTENT, { ...STAMP_OPTIONS, stampImage: STAMP });
    const rasters = rasterOf(layout.primitives);
    expect(rasters).toHaveLength(1);

    const raster = rasters[0] as { rect: { x: number; y: number; w: number; h: number } };
    const metrics = computeSheetFrameMetrics({
      paper: PAPER,
      rowCount: CONTENT.rows.length,
      withStampBox: true,
    });
    const cell = metrics.stamp!;

    // Εντός του κελιού (καμία υπερχείλιση πάνω στα πεδία ή έξω από την πινακίδα).
    expect(raster.rect.x).toBeGreaterThanOrEqual(cell.x);
    expect(raster.rect.y).toBeGreaterThanOrEqual(cell.y);
    expect(raster.rect.x + raster.rect.w).toBeLessThanOrEqual(cell.x + cell.w + 1e-9);
    expect(raster.rect.y + raster.rect.h).toBeLessThanOrEqual(cell.y + cell.h + 1e-9);
  });

  it('η σφραγίδα δεν πατά πάνω στη λέξη «ΣΦΡΑΓΙΔΑ» (ζώνη υπότιτλου)', () => {
    const withLabel = buildTitleBlockLayout(CONTENT, { ...STAMP_OPTIONS, stampImage: STAMP });
    const withoutLabel = buildTitleBlockLayout(CONTENT, {
      ...STAMP_OPTIONS,
      stampLabel: '',
      stampImage: STAMP,
    });
    const y = (l: typeof withLabel) =>
      (rasterOf(l.primitives)[0] as { rect: { y: number } }).rect.y;
    expect(y(withLabel)).toBeGreaterThan(y(withoutLabel));
  });

  it('ΟΘΟΝΗ === PDF: το τυπωμένο φύλλο φέρει το ΙΔΙΟ raster με το in-scene layout', () => {
    const sheet = buildPrintSheet({
      paper: PAPER,
      content: CONTENT,
      options: { withFrame: true, withStampBox: true, stampLabel: 'ΣΦΡΑΓΙΔΑ', stampImage: STAMP },
    });
    const layout = buildTitleBlockLayout(CONTENT, {
      ...STAMP_OPTIONS,
      stampLabel: 'ΣΦΡΑΓΙΔΑ',
      stampImage: STAMP,
      origin: 'sheet',
    });
    expect(rasterOf(sheet.primitives)).toEqual(rasterOf(layout.primitives));
  });

  it('το raster μεταφέρει src + pixel διαστάσεις (contain-fit χωρίς decode στον ζωγράφο)', () => {
    const layout = buildTitleBlockLayout(CONTENT, { ...STAMP_OPTIONS, stampImage: STAMP });
    expect(rasterOf(layout.primitives)[0]).toMatchObject({
      dataUrl: STAMP.src,
      widthPx: 400,
      heightPx: 200,
    });
  });
});

describe('ADR-651 Φάση Ε — τρίτο backend: raster → ImageEntity (in-scene)', () => {
  const layout = buildTitleBlockLayout(CONTENT, { ...STAMP_OPTIONS, stampImage: STAMP });

  it('η σφραγίδα γίνεται ImageEntity με αναφορά (URL), ΠΟΤΕ pixels', () => {
    const entities = detailPrimitivesToEntities(layout.primitives, {
      layerId: '0',
      scaleFactor: 1,
      sheetHeightMm: layout.sizeMm.heightMm,
    });
    const images = entities.filter(isImageEntity);
    expect(images).toHaveLength(1);
    expect(images[0].url).toBe(STAMP.src);
    // 2:1 εικόνα ⇒ 2:1 ορθογώνιο στη σκηνή (καμία παραμόρφωση).
    expect(images[0].width / images[0].height).toBeCloseTo(2, 6);
  });

  it('annotative: ο συντελεστής κλίμακας μεγεθύνει γραμμικά τη σφραγίδα (1:50 ⇒ ×50)', () => {
    const scaled = detailPrimitivesToEntities(layout.primitives, {
      layerId: '0',
      scaleFactor: 50,
      sheetHeightMm: layout.sizeMm.heightMm,
    }).filter(isImageEntity)[0];
    const unscaled = detailPrimitivesToEntities(layout.primitives, {
      layerId: '0',
      scaleFactor: 1,
      sheetHeightMm: layout.sizeMm.heightMm,
    }).filter(isImageEntity)[0];
    expect(scaled.width).toBeCloseTo(unscaled.width * 50, 6);
    expect(scaled.height).toBeCloseTo(unscaled.height * 50, 6);
  });

  it('y-flip: το `position` είναι η ΚΑΤΩ-αριστερή γωνία (σύμβαση DXF, σκηνή y-πάνω)', () => {
    const raster = rasterOf(layout.primitives)[0] as {
      rect: { x: number; y: number; w: number; h: number };
    };
    const image = detailPrimitivesToEntities(layout.primitives, {
      layerId: '0',
      scaleFactor: 1,
      sheetHeightMm: layout.sizeMm.heightMm,
    }).filter(isImageEntity)[0];
    const fit = containFitRectMm(raster.rect, STAMP.widthPx, STAMP.heightPx);
    expect(image.position.x).toBeCloseTo(fit.x, 6);
    expect(image.position.y).toBeCloseTo(layout.sizeMm.heightMm - (fit.y + fit.h), 6);
  });
});

describe('ADR-651 Φάση Ε — έλεγχος πληρότητας για κατάθεση (Απόφαση #4)', () => {
  const FULL_SCOPE: PlaceholderScope = {
    project: { name: 'Οικία', location: 'Λάρισα', client: 'Γ. Π.' },
    drawing: { title: 'Κάτοψη', scale: '1:50' },
    user: { fullName: 'Γ. Παγώνης', title: 'Αρχιτέκτων', licenseNumber: '12345' },
  };

  it('τα υποχρεωτικά πεδία ΠΑΡΑΓΟΝΤΑΙ από το registry (όχι χειρόγραφη λίστα)', () => {
    expect(PERMIT_REQUIRED_PATHS).toContain('user.licenseNumber');
    expect(PERMIT_REQUIRED_PATHS).toContain('drawing.scale');
    expect(PERMIT_REQUIRED_PATHS).toContain('project.location');
    // Η ημερομηνία γεμίζει πάντα μόνη της ⇒ ποτέ «λείπει».
    expect(PERMIT_REQUIRED_PATHS).not.toContain('date.today');
  });

  it('πλήρες preset «Άδεια δόμησης» + πλήρη δεδομένα + σφραγίδα ⇒ καμία έλλειψη', () => {
    const issues = validateTitleBlock({
      template: TITLE_BLOCK_PERMIT_EL,
      scope: FULL_SCOPE,
      withStampBox: true,
      stampImageUrl: 'https://firebasestorage.example/stamp.png',
    });
    expect(issues).toHaveLength(0);
  });

  it('χωρίς Α.Μ. ΤΕΕ και χωρίς κλίμακα ⇒ δύο «κενά πεδία» (empty-value)', () => {
    const issues = validateTitleBlock({
      template: TITLE_BLOCK_PERMIT_EL,
      scope: {
        ...FULL_SCOPE,
        drawing: { title: 'Κάτοψη' },
        user: { fullName: 'Γ. Παγώνης', title: 'Αρχιτέκτων' },
      },
      withStampBox: true,
      stampImageUrl: 'https://x/stamp.png',
    });
    const paths = issues.filter((i) => i.kind === 'empty-value').map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['user.licenseNumber', 'drawing.scale']));
    expect(issueLabelKeys(issues, 'empty-value')).toContain(
      'textTemplates:placeholders.user.licenseNumber',
    );
  });

  it('το «Απλή» preset ΔΕΝ περιλαμβάνει Α.Μ. ΤΕΕ ⇒ absent-field (λύση: άλλαξε πρότυπο)', () => {
    const issues = validateTitleBlock({
      template: TITLE_BLOCK_SIMPLE_EL,
      scope: FULL_SCOPE,
      withStampBox: false,
    });
    const absent = issues.filter((i) => i.kind === 'absent-field').map((i) => i.path);
    expect(absent).toContain('user.licenseNumber');
    // Χωρίς κελί σφραγίδας δεν υπάρχει θέμα σφραγίδας.
    expect(issues.some((i) => i.kind === 'no-stamp-image')).toBe(false);
  });

  it('κελί σφραγίδας χωρίς ανεβασμένη εικόνα ⇒ υπόδειξη (ΟΧΙ σφάλμα — νόμιμη πρακτική)', () => {
    const issues = validateTitleBlock({
      template: TITLE_BLOCK_PERMIT_EL,
      scope: FULL_SCOPE,
      withStampBox: true,
    });
    expect(issues).toEqual([{ kind: 'no-stamp-image' }]);
  });

  it('ντετερμινισμός: ίδιο input ⇒ ίδια σειρά ευρημάτων (το UI δεν «χοροπηδά»)', () => {
    const input = { template: TITLE_BLOCK_PERMIT_EL, scope: {}, withStampBox: true } as const;
    expect(validateTitleBlock(input)).toEqual(validateTitleBlock(input));
  });
});
