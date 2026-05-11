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

export const TITLE_BLOCK_DEFAULTS: readonly BuiltInTextTemplate[] = [TITLE_BLOCK_EL, TITLE_BLOCK_EN];
