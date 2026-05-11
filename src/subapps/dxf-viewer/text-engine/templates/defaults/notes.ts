/**
 * ADR-344 Phase 7.A — General notes block (Greek + English).
 *
 * Multi-line annotated paragraph anchored top-left, used for general
 * project notes that travel with every sheet.
 *
 * Placeholders:
 *   project.name, drawing.scale, drawing.units
 */

import { CAPTION_RUN_STYLE, DEFAULT_RUN_STYLE, HEADING_RUN_STYLE, makeBuiltIn, makeNode, makeParagraph, makeRun } from './template-helpers';
import type { BuiltInTextTemplate } from '../template.types';

const GENERAL_NOTES_EL_CONTENT = makeNode(
  [
    makeParagraph([makeRun('ΓΕΝΙΚΕΣ ΣΗΜΕΙΩΣΕΙΣ', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('1. Όλες οι διαστάσεις σε χιλιοστά (mm) εκτός αν αναφέρεται διαφορετικά.', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('2. Κλίμακα σχεδίου: {{drawing.scale}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('3. Μονάδες μέτρησης: {{drawing.units}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('4. Έργο: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('5. Ο εργολάβος επαληθεύει όλες τις διαστάσεις στο εργοτάξιο πριν την κατασκευή.', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('6. Τυχόν αποκλίσεις πρέπει να αναφέρονται άμεσα στον υπεύθυνο μελέτης.', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TL', lineSpacingFactor: 1.2 },
);

const GENERAL_NOTES_EN_CONTENT = makeNode(
  [
    makeParagraph([makeRun('GENERAL NOTES', HEADING_RUN_STYLE)]),
    makeParagraph([makeRun('1. All dimensions in millimetres (mm) unless otherwise stated.', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('2. Drawing scale: {{drawing.scale}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('3. Units: {{drawing.units}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('4. Project: {{project.name}}', DEFAULT_RUN_STYLE)]),
    makeParagraph([makeRun('5. The contractor shall verify all dimensions on site prior to construction.', CAPTION_RUN_STYLE)]),
    makeParagraph([makeRun('6. Any discrepancies must be reported immediately to the design engineer.', CAPTION_RUN_STYLE)]),
  ],
  { attachment: 'TL', lineSpacingFactor: 1.2 },
);

export const GENERAL_NOTES_EL: BuiltInTextTemplate = makeBuiltIn({
  slug: 'general-notes-el',
  nameI18nKey: 'textTemplates:defaults.generalNotes.el',
  displayName: 'Γενικές Σημειώσεις (Ελληνικά)',
  category: 'notes',
  locale: 'el',
  content: GENERAL_NOTES_EL_CONTENT,
});

export const GENERAL_NOTES_EN: BuiltInTextTemplate = makeBuiltIn({
  slug: 'general-notes-en',
  nameI18nKey: 'textTemplates:defaults.generalNotes.en',
  displayName: 'General Notes (English)',
  category: 'notes',
  locale: 'en',
  content: GENERAL_NOTES_EN_CONTENT,
});

export const NOTES_DEFAULTS: readonly BuiltInTextTemplate[] = [GENERAL_NOTES_EL, GENERAL_NOTES_EN];
