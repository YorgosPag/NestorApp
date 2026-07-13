/**
 * ADR-651 Φάση Δ — tests του reconciliation (AI structured output → `TextTemplate`).
 *
 * Καρφώνει τα κρίσιμα invariants:
 *  - γνωστά paths → `{{path}}` (δένουν με ζωντανό δεδομένο),
 *  - **άγνωστα** paths πέφτουν (anti-hallucination) και καταγράφονται στο `droppedPaths`,
 *  - η δομή διαβάζεται πίσω με τη σύμβαση «επικεφαλίδα + Ετικέτα: τιμή» (ίδιος reader με render),
 *  - ντετερμινισμός (ίδιο input ⇒ ίδιο output).
 */

import { readTitleBlockContent } from '../../title-block-rows';
import { extractPlaceholders } from '../../../templates/extract-placeholders';
import {
  CAPTION_RUN_STYLE,
  DEFAULT_RUN_STYLE,
} from '../../../templates/defaults/template-helpers';
import type { TextRun } from '../../../types/text-ast.types';
import { reconcileAiTitleBlock, toAiTitleBlockResult } from '../ai-title-block-reconcile';
import type { AiTitleBlock } from '../ai-title-block-schema';

function makeAi(overrides: Partial<AiTitleBlock> = {}): AiTitleBlock {
  return {
    locale: 'el',
    heading: { placeholderPath: 'company.name', literalText: null },
    rows: [
      { label: 'Έργο', placeholderPath: 'project.name', literalValue: null, emphasis: 'default' },
      { label: 'Κλίμακα', placeholderPath: 'drawing.scale', literalValue: null, emphasis: 'caption' },
    ],
    withStampBox: false,
    confidence: 0.8,
    notes: 'ok',
    ...overrides,
  };
}

/** Το κείμενο του πρώτου run μιας παραγράφου. */
function firstRunText(runs: readonly (TextRun | { top: string })[]): string {
  const run = runs[0];
  return run && 'text' in run ? run.text : '';
}

describe('reconcileAiTitleBlock — known placeholder binding', () => {
  it('binds known paths as {{path}} and reads back heading + rows', () => {
    const { template } = reconcileAiTitleBlock(makeAi());
    const content = readTitleBlockContent(template.content);
    expect(content.heading).toBe('{{company.name}}');
    expect(content.rows).toEqual([
      { label: 'Έργο:', value: '{{project.name}}' },
      { label: 'Κλίμακα:', value: '{{drawing.scale}}' },
    ]);
    expect(template.category).toBe('title-block');
    expect(template.locale).toBe('el');
    expect(template.isDefault).toBe(false);
  });

  it('extracts only the known placeholders into template.placeholders', () => {
    const { template } = reconcileAiTitleBlock(makeAi());
    expect(extractPlaceholders(template.content)).toEqual([
      'company.name',
      'drawing.scale',
      'project.name',
    ]);
  });
});

describe('reconcileAiTitleBlock — anti-hallucination', () => {
  it('drops an unknown placeholder path and records it, keeping the labelled row', () => {
    const { template, droppedPaths } = reconcileAiTitleBlock(
      makeAi({
        rows: [
          { label: 'Έργο', placeholderPath: 'project.name', literalValue: null, emphasis: 'default' },
          { label: 'Φανταστικό', placeholderPath: 'project.madeUp', literalValue: null, emphasis: 'caption' },
        ],
      }),
    );
    expect(droppedPaths).toEqual(['project.madeUp']);
    const content = readTitleBlockContent(template.content);
    // Η γραμμή μένει (κρατά τη διάταξη) αλλά χωρίς binding.
    expect(content.rows).toContainEqual({ label: 'Φανταστικό:', value: '' });
    expect(extractPlaceholders(template.content)).not.toContain('project.madeUp');
  });

  it('falls back to literalValue when the path is unknown', () => {
    const { template } = reconcileAiTitleBlock(
      makeAi({
        rows: [
          { label: 'Υπηρεσία', placeholderPath: 'authority.name', literalValue: 'ΥΔΟΜ Αθηνών', emphasis: 'caption' },
        ],
      }),
    );
    const content = readTitleBlockContent(template.content);
    expect(content.rows).toEqual([{ label: 'Υπηρεσία:', value: 'ΥΔΟΜ Αθηνών' }]);
  });

  it('drops an unknown heading path but keeps a literal heading', () => {
    const { template, droppedPaths } = reconcileAiTitleBlock(
      makeAi({ heading: { placeholderPath: 'office.brand', literalText: 'ΤΕΧΝΙΚΟ ΓΡΑΦΕΙΟ' } }),
    );
    expect(droppedPaths).toContain('office.brand');
    expect(readTitleBlockContent(template.content).heading).toBe('ΤΕΧΝΙΚΟ ΓΡΑΦΕΙΟ');
  });
});

describe('reconcileAiTitleBlock — styling, stamp, determinism', () => {
  it('maps emphasis to the run style (default vs caption height)', () => {
    const { template } = reconcileAiTitleBlock(makeAi());
    const [, projectPara, scalePara] = template.content.paragraphs;
    expect(firstRunTextHeight(projectPara.runs)).toBe(DEFAULT_RUN_STYLE.height);
    expect(firstRunTextHeight(scalePara.runs)).toBe(CAPTION_RUN_STYLE.height);
  });

  it('passes withStampBox through', () => {
    expect(reconcileAiTitleBlock(makeAi({ withStampBox: true })).withStampBox).toBe(true);
  });

  it('skips empty rows (no label and no value)', () => {
    const { template } = reconcileAiTitleBlock(
      makeAi({ rows: [{ label: '', placeholderPath: null, literalValue: null, emphasis: 'caption' }] }),
    );
    // Μόνο η επικεφαλίδα μένει.
    expect(template.content.paragraphs).toHaveLength(1);
    expect(firstRunText(template.content.paragraphs[0].runs)).toBe('{{company.name}}');
  });

  it('is deterministic — same input, deep-equal output', () => {
    expect(reconcileAiTitleBlock(makeAi())).toEqual(reconcileAiTitleBlock(makeAi()));
  });

  it('toAiTitleBlockResult folds confidence + notes', () => {
    const result = toAiTitleBlockResult(makeAi({ confidence: 0.42, notes: 'υπόθεση' }));
    expect(result.confidence).toBe(0.42);
    expect(result.notes).toBe('υπόθεση');
    expect(result.template.category).toBe('title-block');
  });
});

/** Το ύψος του πρώτου run (για έλεγχο έμφασης). */
function firstRunTextHeight(runs: readonly unknown[]): number {
  const run = runs[0] as { style?: { height?: number } } | undefined;
  return run?.style?.height ?? -1;
}
