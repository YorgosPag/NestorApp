/**
 * ADR-344 Phase 7.A — Sign-off / approval stamps (Greek + English).
 *
 * Compact 3-4 line stamps placed near the signing area of the sheet.
 * Used by the engineer / architect / project manager to claim authorship.
 *
 * Placeholders:
 *   user.fullName, user.title, user.licenseNumber,
 *   date.today, project.name
 */

import { CAPTION_RUN_STYLE, DEFAULT_RUN_STYLE, HEADING_RUN_STYLE, makeBuiltIn, makeNode, makeParagraph, makeRun } from './template-helpers';
import type { BuiltInTextTemplate } from '../template.types';

const SIGNOFF_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('ΥΠΕΥΘΥΝΟΣ ΜΕΛΕΤΗΣ', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('{{user.fullName}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('{{user.title}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Α.Μ. ΤΕΕ: {{user.licenseNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Ημερομηνία: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TL' },
);

const SIGNOFF_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('DESIGN ENGINEER', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('{{user.fullName}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('{{user.title}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('License: {{user.licenseNumber}}', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('Date: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TL' },
);

const APPROVAL_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('ΕΓΚΡΙΣΗ', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Έργο: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Εγκρίνεται από: {{user.fullName}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('Ημερομηνία: {{date.today}}', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TL' },
);

export const SIGNOFF_STAMP_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'signoff-stamp-el',
  nameI18nKey: 'textTemplates:defaults.signoff.el',
  displayName: 'Σφραγίδα Υπευθύνου (Ελληνικά)',
  category: 'stamp',
  locale: 'el',
  content: SIGNOFF_EL_CONTENT,
});

export const SIGNOFF_STAMP_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'signoff-stamp-en',
  nameI18nKey: 'textTemplates:defaults.signoff.en',
  displayName: 'Sign-off Stamp (English)',
  category: 'stamp',
  locale: 'en',
  content: SIGNOFF_EN_CONTENT,
});

export const APPROVAL_STAMP_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'approval-stamp-el',
  nameI18nKey: 'textTemplates:defaults.approval.el',
  displayName: 'Σφραγίδα Έγκρισης (Ελληνικά)',
  category: 'stamp',
  locale: 'el',
  content: APPROVAL_EL_CONTENT,
});

export const STAMP_DEFAULTS: readonly BuiltInTextTemplate[] = [
  SIGNOFF_STAMP_EL,
  SIGNOFF_STAMP_EN,
  APPROVAL_STAMP_EL,
];
