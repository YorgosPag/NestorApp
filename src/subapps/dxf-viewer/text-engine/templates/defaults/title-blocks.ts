/**
 * ADR-344 Phase 7.A — Title block defaults (Greek + English).
 *
 * Architectural title block intended for placement in the lower-right
 * corner of a sheet. Stacks: project / drawing title / owner / drawn-by /
 * checked-by / date / scale / revision / sheet number.
 *
 * Placeholders consumed at insertion time (Phase 7.C resolver):
 *   project.name, project.code, project.owner,
 *   drawing.title, drawing.scale, drawing.sheetNumber,
 *   revision.number, revision.date,
 *   user.fullName, user.checkerName,
 *   company.name,
 *   date.today
 */

import { CAPTION_RUN_STYLE, DEFAULT_RUN_STYLE, HEADING_RUN_STYLE, makeBuiltIn, makeNode, makeParagraph, makeRun } from './template-helpers';
import type { BuiltInTextTemplate } from '../template.types';

const TITLE_BLOCK_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('{{company.name}}', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Έργο: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Κωδικός Έργου: {{project.code}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Κύριος Έργου: {{project.owner}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Τίτλος Σχεδίου: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Σχεδίαση: {{user.fullName}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Έλεγχος: {{user.checkerName}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Κλίμακα: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Φύλλο: {{drawing.sheetNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Αναθεώρηση: {{revision.number}} — {{revision.date}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Ημερομηνία: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

const TITLE_BLOCK_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('{{company.name}}', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Project: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Project Code: {{project.code}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Owner: {{project.owner}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Drawing Title: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Drawn by: {{user.fullName}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Checked by: {{user.checkerName}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Scale: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Sheet: {{drawing.sheetNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Revision: {{revision.number}} — {{revision.date}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Date: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

// ─── ADR-651 Φάση Γ — βιβλιοθήκη presets (Απόφαση Giorgio #3) ───────────────────────────
// Τρία ακόμη built-in πρότυπα (EL+EN, Απόφαση #8) δίπλα στο τυπικό παραπάνω. Καθένα είναι
// ΑΠΛΩΣ ένα `TextTemplate` — καμία νέα έννοια, κανένα νέο μοντέλο: η γεωμετρία (κορνίζα,
// θέση, κελί σφραγίδας) ζει στο `title-block/sheet-frame.ts`, το ΠΕΡΙΕΧΟΜΕΝΟ εδώ. Ο χρήστης
// τα κλωνοποιεί/επεξεργάζεται → user template στο Firestore (υπάρχον CRUD, two-tier ADR-344).

/** «Άδεια δόμησης» — τα de-facto υποχρεωτικά πεδία της ελληνικής πρακτικής (ΤΕΕ, ADR-651 §2). */
const TITLE_BLOCK_PERMIT_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('{{company.name}}', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Έργο: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Θέση Έργου: {{project.location}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Εργοδότης: {{project.client}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Κύριος Έργου: {{project.owner}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Είδος Σχεδίου: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Κλίμακα: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Μελετητής: {{user.fullName}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Ειδικότητα: {{user.title}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Α.Μ. ΤΕΕ: {{user.licenseNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Έλεγχος: {{user.checkerName}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Αρ. Σχεδίου: {{drawing.sheetNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Ημερομηνία: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

const TITLE_BLOCK_PERMIT_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('{{company.name}}', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Project: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Location: {{project.location}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Client: {{project.client}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Owner: {{project.owner}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Drawing Type: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Scale: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Engineer: {{user.fullName}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Discipline: {{user.title}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Licence No: {{user.licenseNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Checked by: {{user.checkerName}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Drawing No: {{drawing.sheetNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Date: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

/** «Απλή» — το ελάχιστο που θέλει ένα σχέδιο γραφείου (χωρίς αναθεωρήσεις/ελέγχους). */
const TITLE_BLOCK_SIMPLE_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('{{company.name}}', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Έργο: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Τίτλος Σχεδίου: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Κλίμακα: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Ημερομηνία: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

const TITLE_BLOCK_SIMPLE_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('{{company.name}}', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Project: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Drawing Title: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Scale: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Date: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

/** «Λεπτομέρεια» — φύλλο κατασκευαστικής λεπτομέρειας (1:10/1:20): τίτλος + κλίμακα + φύλλο. */
const TITLE_BLOCK_DETAIL_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('Λεπτομέρεια: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Έργο: {{project.name}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Κλίμακα: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Φύλλο: {{drawing.sheetNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Ημερομηνία: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

const TITLE_BLOCK_DETAIL_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('Detail: {{drawing.title}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Project: {{project.name}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Scale: {{drawing.scale}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Sheet: {{drawing.sheetNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Date: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'BR' },
);

export const TITLE_BLOCK_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-el',
  nameI18nKey: 'textTemplates:defaults.titleBlock.el',
  displayName: 'Ταμπέλα Σχεδίου (Ελληνικά)',
  category: 'title-block',
  locale: 'el',
  content: TITLE_BLOCK_EL_CONTENT,
});

export const TITLE_BLOCK_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-en',
  nameI18nKey: 'textTemplates:defaults.titleBlock.en',
  displayName: 'Title Block (English)',
  category: 'title-block',
  locale: 'en',
  content: TITLE_BLOCK_EN_CONTENT,
});

export const TITLE_BLOCK_PERMIT_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-permit-el',
  nameI18nKey: 'textTemplates:defaults.titleBlockPermit.el',
  displayName: 'Πινακίδα Άδειας Δόμησης (Ελληνικά)',
  category: 'title-block',
  locale: 'el',
  content: TITLE_BLOCK_PERMIT_EL_CONTENT,
});

export const TITLE_BLOCK_PERMIT_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-permit-en',
  nameI18nKey: 'textTemplates:defaults.titleBlockPermit.en',
  displayName: 'Building Permit Title Block (English)',
  category: 'title-block',
  locale: 'en',
  content: TITLE_BLOCK_PERMIT_EN_CONTENT,
});

export const TITLE_BLOCK_SIMPLE_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-simple-el',
  nameI18nKey: 'textTemplates:defaults.titleBlockSimple.el',
  displayName: 'Απλή Πινακίδα (Ελληνικά)',
  category: 'title-block',
  locale: 'el',
  content: TITLE_BLOCK_SIMPLE_EL_CONTENT,
});

export const TITLE_BLOCK_SIMPLE_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-simple-en',
  nameI18nKey: 'textTemplates:defaults.titleBlockSimple.en',
  displayName: 'Simple Title Block (English)',
  category: 'title-block',
  locale: 'en',
  content: TITLE_BLOCK_SIMPLE_EN_CONTENT,
});

export const TITLE_BLOCK_DETAIL_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-detail-el',
  nameI18nKey: 'textTemplates:defaults.titleBlockDetail.el',
  displayName: 'Πινακίδα Λεπτομέρειας (Ελληνικά)',
  category: 'title-block',
  locale: 'el',
  content: TITLE_BLOCK_DETAIL_EL_CONTENT,
});

export const TITLE_BLOCK_DETAIL_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'title-block-detail-en',
  nameI18nKey: 'textTemplates:defaults.titleBlockDetail.en',
  displayName: 'Detail Title Block (English)',
  category: 'title-block',
  locale: 'en',
  content: TITLE_BLOCK_DETAIL_EN_CONTENT,
});

export const TITLE_BLOCK_DEFAULTS: readonly BuiltInTextTemplate[] = [
  TITLE_BLOCK_EL,
  TITLE_BLOCK_EN,
  TITLE_BLOCK_PERMIT_EL,
  TITLE_BLOCK_PERMIT_EN,
  TITLE_BLOCK_SIMPLE_EL,
  TITLE_BLOCK_SIMPLE_EN,
  TITLE_BLOCK_DETAIL_EL,
  TITLE_BLOCK_DETAIL_EN,
];
