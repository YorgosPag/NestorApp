/**
 * ADR-344 Phase 7.A — Revision table (bilingual).
 *
 * Tabular history of drawing revisions. Each row carries
 * number / date / description / author. The defaults ship empty rows
 * for the next three revisions; the architect fills them in by
 * editing the inserted MTEXT.
 *
 * Placeholders:
 *   revision.number, revision.date, revision.description, revision.author
 *   (the bare placeholders cover row #1; rows 2-3 stay empty for manual entry)
 */

import { CAPTION_RUN_STYLE, DEFAULT_RUN_STYLE, HEADING_RUN_STYLE, makeBuiltIn, makeNode, makeParagraph, makeRun } from './template-helpers';
import type { BuiltInTextTemplate } from '../template.types';

const REVISION_TABLE_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('ΠΙΝΑΚΑΣ ΑΝΑΘΕΩΡΗΣΕΩΝ', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('Αρ.   Ημερομηνία   Περιγραφή   Συντάκτης', CAPTION_RUN_STYLE)]),
    makeParagraph([
      makeRun(
        '{{revision.number}}   {{revision.date}}   {{revision.description}}   {{revision.author}}',
        DEFAULT_RUN_STYLE,
      ),
    ]),
    makeParagraph([makeRun('—   —   —   —', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('—   —   —   —', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TR', lineSpacingFactor: 1.3 },
);

const REVISION_TABLE_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('REVISION TABLE', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('No.   Date   Description   Author', CAPTION_RUN_STYLE)]),
    makeParagraph([
      makeRun(
        '{{revision.number}}   {{revision.date}}   {{revision.description}}   {{revision.author}}',
        DEFAULT_RUN_STYLE,
      ),
    ]),
    makeParagraph([makeRun('—   —   —   —', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('—   —   —   —', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TR', lineSpacingFactor: 1.3 },
);

export const REVISION_TABLE_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'revision-table-el',
  nameI18nKey: 'textTemplates:defaults.revisionTable.el',
  displayName: 'Πίνακας Αναθεωρήσεων (Ελληνικά)',
  category: 'revision',
  locale: 'el',
  content: REVISION_TABLE_EL_CONTENT,
});

export const REVISION_TABLE_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'revision-table-en',
  nameI18nKey: 'textTemplates:defaults.revisionTable.en',
  displayName: 'Revision Table (English)',
  category: 'revision',
  locale: 'en',
  content: REVISION_TABLE_EN_CONTENT,
});

export const REVISION_DEFAULTS: readonly BuiltInTextTemplate[] = [REVISION_TABLE_EL, REVISION_TABLE_EN];
