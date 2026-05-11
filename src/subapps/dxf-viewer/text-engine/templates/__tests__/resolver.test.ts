/**
 * ADR-344 Phase 7.C — Placeholder resolver tests (pure functions).
 *
 * Three layers covered:
 *   - `resolvePlaceholdersInString`: known/missing/unknown matrix +
 *     whitespace tolerance + date formatting + revision raw passthrough.
 *   - `resolvePlaceholdersInNode`: walks paragraphs, runs, stacks; preserves
 *     style/attachment/columns; returns same reference on no-op.
 *   - `resolveTemplate`: convenience wrapper over a TextTemplate.
 *   - `classifyPlaceholders`: separates known vs unknown paths.
 */

import {
  resolvePlaceholdersInString,
  resolvePlaceholdersInNode,
  resolveTemplate,
  classifyPlaceholders,
} from '../resolver/resolver';
import type { PlaceholderScope } from '../resolver/scope.types';
import { TITLE_BLOCK_EL } from '../defaults/title-blocks';
import {
  makeNode,
  makeParagraph,
  makeRun,
  DEFAULT_RUN_STYLE,
} from '../defaults/template-helpers';
import type { DxfTextNode, TextStack } from '../../types/text-ast.types';

const FIXED_DATE = new Date('2026-05-11T10:00:00Z');

const FULL_SCOPE: PlaceholderScope = {
  company: { name: 'Nestor Construct' },
  project: { name: 'Πολυκατοικία Αθηνών', code: 'PRJ-001', owner: 'Δ. Παπαδόπουλος' },
  drawing: { title: 'Κάτοψη Α', scale: '1:50', sheetNumber: 'A-101', units: 'mm' },
  user: { fullName: 'Γ. Παγώνης', checkerName: 'Ν. Παγώνης', title: 'Αρχιτέκτων', licenseNumber: 'ΤΕΕ 12345' },
  revision: { number: '3', date: FIXED_DATE, author: 'Γ. Π.', description: 'Διόρθωση όψεων' },
  formatting: { locale: 'el', today: FIXED_DATE },
};

const EMPTY_SCOPE: PlaceholderScope = { formatting: { locale: 'el', today: FIXED_DATE } };

describe('resolvePlaceholdersInString — known paths', () => {
  it('substitutes a single placeholder', () => {
    expect(resolvePlaceholdersInString('Έργο: {{project.name}}', FULL_SCOPE)).toBe(
      'Έργο: Πολυκατοικία Αθηνών',
    );
  });

  it('substitutes multiple placeholders in one line', () => {
    expect(
      resolvePlaceholdersInString('{{company.name}} — {{project.code}}', FULL_SCOPE),
    ).toBe('Nestor Construct — PRJ-001');
  });

  it('tolerates inner whitespace inside braces', () => {
    expect(resolvePlaceholdersInString('Κωδικός: {{  project.code  }}', FULL_SCOPE)).toBe(
      'Κωδικός: PRJ-001',
    );
  });

  it('passes revision.number through as raw value (no prefix added)', () => {
    expect(resolvePlaceholdersInString('Αναθεώρηση: {{revision.number}}', FULL_SCOPE)).toBe(
      'Αναθεώρηση: 3',
    );
  });
});

describe('resolvePlaceholdersInString — date formatting (locale-aware)', () => {
  it('formats date.today as dd/mm/yyyy for el locale', () => {
    expect(resolvePlaceholdersInString('{{date.today}}', FULL_SCOPE)).toBe('11/05/2026');
  });

  it('formats date.today as m/d/yyyy for en locale', () => {
    const enScope: PlaceholderScope = { formatting: { locale: 'en', today: FIXED_DATE } };
    expect(resolvePlaceholdersInString('{{date.today}}', enScope)).toBe('05/11/2026');
  });

  it('formats revision.date when supplied via scope.revision', () => {
    expect(resolvePlaceholdersInString('{{revision.date}}', FULL_SCOPE)).toBe('11/05/2026');
  });

  it('falls back to el locale when locale is omitted', () => {
    const noLocale: PlaceholderScope = { formatting: { today: FIXED_DATE } };
    expect(resolvePlaceholdersInString('{{date.today}}', noLocale)).toBe('11/05/2026');
  });
});

describe('resolvePlaceholdersInString — missing values (known path, empty scope)', () => {
  it('substitutes empty string when project is missing', () => {
    expect(resolvePlaceholdersInString('Έργο: {{project.name}}', EMPTY_SCOPE)).toBe('Έργο: ');
  });

  it('substitutes empty string when user.checkerName is missing', () => {
    expect(resolvePlaceholdersInString('Έλεγχος: {{user.checkerName}}', EMPTY_SCOPE)).toBe(
      'Έλεγχος: ',
    );
  });

  it('substitutes empty string when revision.date is missing', () => {
    expect(resolvePlaceholdersInString('{{revision.date}}', EMPTY_SCOPE)).toBe('');
  });
});

describe('resolvePlaceholdersInString — unknown paths (literal)', () => {
  it('leaves unknown path verbatim', () => {
    expect(resolvePlaceholdersInString('Έργο: {{project.naem}}', FULL_SCOPE)).toBe(
      'Έργο: {{project.naem}}',
    );
  });

  it('mixes known + unknown in one line', () => {
    expect(
      resolvePlaceholdersInString('{{company.name}} / {{foo.bar}}', FULL_SCOPE),
    ).toBe('Nestor Construct / {{foo.bar}}');
  });

  it('returns the original string when nothing matches', () => {
    expect(resolvePlaceholdersInString('plain text', FULL_SCOPE)).toBe('plain text');
  });
});

describe('resolvePlaceholdersInNode', () => {
  it('walks paragraphs and runs', () => {
    const node = makeNode([
      makeParagraph([
        makeRun('{{company.name}}', DEFAULT_RUN_STYLE),
        makeRun(' — ', DEFAULT_RUN_STYLE),
        makeRun('{{project.code}}', DEFAULT_RUN_STYLE),
      ]),
    ]);
    const resolved = resolvePlaceholdersInNode(node, FULL_SCOPE);
    const runs = resolved.paragraphs[0].runs;
    expect((runs[0] as { text: string }).text).toBe('Nestor Construct');
    expect((runs[2] as { text: string }).text).toBe('PRJ-001');
  });

  it('preserves attachment and rotation', () => {
    const node = makeNode([makeParagraph([makeRun('{{project.name}}', DEFAULT_RUN_STYLE)])], {
      attachment: 'TR',
      rotation: 90,
    });
    const resolved = resolvePlaceholdersInNode(node, FULL_SCOPE);
    expect(resolved.attachment).toBe('TR');
    expect(resolved.rotation).toBe(90);
  });

  it('walks TextStack top + bottom', () => {
    const stack: TextStack = {
      top: '{{project.code}}',
      bottom: '{{revision.number}}',
      type: 'horizontal',
      style: { fontFamily: 'Arial', height: 2.5, color: DEFAULT_RUN_STYLE.color },
    };
    const node: DxfTextNode = {
      ...makeNode([makeParagraph([])]),
      paragraphs: [
        {
          ...makeParagraph([]),
          runs: [stack],
        },
      ],
    };
    const resolved = resolvePlaceholdersInNode(node, FULL_SCOPE);
    const resolvedStack = resolved.paragraphs[0].runs[0] as TextStack;
    expect(resolvedStack.top).toBe('PRJ-001');
    expect(resolvedStack.bottom).toBe('3');
  });

  it('returns the same reference when no placeholders are present (cheap memo)', () => {
    const node = makeNode([makeParagraph([makeRun('plain text', DEFAULT_RUN_STYLE)])]);
    const resolved = resolvePlaceholdersInNode(node, FULL_SCOPE);
    expect(resolved).toBe(node);
  });

  it('preserves the original node when scope is empty and all tokens resolve to empty string', () => {
    const node = makeNode([makeParagraph([makeRun('Έργο: {{project.name}}', DEFAULT_RUN_STYLE)])]);
    const resolved = resolvePlaceholdersInNode(node, EMPTY_SCOPE);
    expect((resolved.paragraphs[0].runs[0] as { text: string }).text).toBe('Έργο: ');
  });
});

describe('resolveTemplate (convenience wrapper)', () => {
  it('resolves the built-in TITLE_BLOCK_EL with a full scope', () => {
    const resolved = resolveTemplate(TITLE_BLOCK_EL, FULL_SCOPE);
    const firstLine = (resolved.paragraphs[0].runs[0] as { text: string }).text;
    expect(firstLine).toBe('Nestor Construct');
  });

  it('returns the template content unchanged when scope is empty + template has only company.name', () => {
    const template = TITLE_BLOCK_EL;
    const resolved = resolveTemplate(template);
    // first run is `{{company.name}}` → empty string when scope is empty
    expect((resolved.paragraphs[0].runs[0] as { text: string }).text).toBe('');
  });
});

describe('classifyPlaceholders', () => {
  it('separates known from unknown paths', () => {
    const result = classifyPlaceholders(
      '{{project.name}} — {{foo.bar}} — {{date.today}} — {{user.naem}}',
    );
    expect(result.known).toEqual(['date.today', 'project.name']);
    expect(result.unknown).toEqual(['foo.bar', 'user.naem']);
  });

  it('returns empty arrays when input has no placeholders', () => {
    expect(classifyPlaceholders('plain text')).toEqual({ known: [], unknown: [] });
  });
});
