/**
 * ADR-651 Φάση Κ (§8 #7) — auto-localization EL↔EN της πινακίδας.
 *
 * Καρφώνει τις τέσσερις υποσχέσεις που, αν σπάσουν, ταξιδεύουν μέσα σε **κατατεθειμένο** σχέδιο:
 *  1. τα `{{placeholders}}` είναι ΔΕΔΟΜΕΝΑ — δεν μεταφράζονται ΠΟΤΕ,
 *  2. άγνωστος όρος ⇒ μένει ως έχει (ποτέ κενό, ποτέ μαντεψιά, ποτέ crash),
 *  3. idempotency: el→el δεν αλλάζει τίποτα,
 *  4. το λεξικό **παράγεται** από τα δίγλωσσα presets — δεν είναι χειρόγραφο αντίγραφο.
 */

import {
  applyTitleBlockTranslation,
  collectTitleBlockTerms,
  localizeTitleBlockContent,
  localizeTitleBlockLabel,
} from '../localization/localize-title-block';
import {
  lookupTitleBlockTerm,
  titleBlockGlossarySize,
  titleBlockTermKey,
} from '../localization/title-block-glossary';
import { TITLE_BLOCK_PRESETS, TITLE_BLOCK_STAMP_LABEL } from '../title-block-presets';
import type { DxfTextNode, TextRun } from '../../types/text-ast.types';

const STYLE: TextRun['style'] = {
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  underline: false,
  overline: false,
  strikethrough: false,
  height: 2.5,
  widthFactor: 1,
  obliqueAngle: 0,
  tracking: 1,
  color: 256,
};

function node(...texts: readonly string[]): DxfTextNode {
  return {
    paragraphs: texts.map((text) => ({
      runs: [{ text, style: STYLE }],
      indent: 0,
      leftMargin: 0,
      rightMargin: 0,
      tabs: [],
      justification: 0,
      lineSpacingMode: 'multiple',
      lineSpacingFactor: 1,
    })),
    attachment: 'BR',
    lineSpacing: { mode: 'multiple', factor: 1 },
    columns: undefined,
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

/** Όλα τα κείμενα του δέντρου, σε σειρά — η μόνη «όψη» που χρειάζονται τα tests. */
function texts(content: DxfTextNode): readonly string[] {
  return content.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join(''));
}

describe('ADR-651 Φάση Κ — το λεξικό παράγεται από τα presets', () => {
  it('ξέρει τους όρους ΤΕΕ και στις δύο κατευθύνσεις, χωρίς χειρόγραφη λίστα', () => {
    expect(lookupTitleBlockTerm('Έργο', 'el', 'en')).toBe('Project');
    expect(lookupTitleBlockTerm('Κλίμακα', 'el', 'en')).toBe('Scale');
    expect(lookupTitleBlockTerm('Α.Μ. ΤΕΕ', 'el', 'en')).toBe('Licence No');
    expect(lookupTitleBlockTerm('Scale', 'en', 'el')).toBe('Κλίμακα');
    expect(lookupTitleBlockTerm('Project', 'en', 'el')).toBe('Έργο');
  });

  it('το κείμενο του κελιού σφραγίδας μπαίνει στο ΙΔΙΟ λεξικό', () => {
    expect(localizeTitleBlockLabel(TITLE_BLOCK_STAMP_LABEL.el, 'el', 'en')).toBe(
      TITLE_BLOCK_STAMP_LABEL.en,
    );
    expect(localizeTitleBlockLabel(TITLE_BLOCK_STAMP_LABEL.en, 'en', 'el')).toBe(
      TITLE_BLOCK_STAMP_LABEL.el,
    );
  });

  it('ταιριάζει ανεξάρτητα από πεζά/κεφαλαία/τόνους (ΕΡΓΟ === Έργο === έργο)', () => {
    expect(titleBlockTermKey('ΕΡΓΟ')).toBe(titleBlockTermKey('Έργο'));
    expect(lookupTitleBlockTerm('ΕΡΓΟ', 'el', 'en')).toBe('Project');
    expect(lookupTitleBlockTerm('έργο', 'el', 'en')).toBe('Project');
    expect(lookupTitleBlockTerm('  ΚΛΊΜΑΚΑ  ', 'el', 'en')).toBe('Scale');
  });

  it('δεν είναι κενό — κάθε preset τροφοδοτεί το λεξικό', () => {
    expect(titleBlockGlossarySize('el', 'en')).toBeGreaterThan(15);
    expect(titleBlockGlossarySize('en', 'el')).toBeGreaterThan(15);
  });

  it('κάθε built-in ελληνικό preset μεταφράζεται ΑΚΡΙΒΩΣ στο αγγλικό του αδελφάκι', () => {
    for (const preset of TITLE_BLOCK_PRESETS) {
      const { content, unknownTerms } = localizeTitleBlockContent(
        preset.templates.el.content,
        'el',
        'en',
      );
      expect(unknownTerms).toEqual([]);
      expect(texts(content)).toEqual(texts(preset.templates.en.content));
    }
  });
});

describe('ADR-651 Φάση Κ — τι ΔΕΝ αγγίζεται', () => {
  it('τα placeholders είναι δεδομένα, όχι κείμενο — μένουν άθικτα', () => {
    const { content } = localizeTitleBlockContent(node('Έργο: {{project.name}}'), 'el', 'en');
    expect(texts(content)).toEqual(['Project: {{project.name}}']);
  });

  it('placeholder ΜΟΝΟΣ του δεν αλλάζει ποτέ', () => {
    const { content, unknownTerms } = localizeTitleBlockContent(node('{{company.name}}'), 'el', 'en');
    expect(texts(content)).toEqual(['{{company.name}}']);
    expect(unknownTerms).toEqual([]);
  });

  it('το στυλ και η γεωμετρία δεν αγγίζονται — η μετάφραση αλλάζει λέξεις, όχι σχέδιο', () => {
    const source = node('Κλίμακα: {{drawing.scale}}');
    const { content } = localizeTitleBlockContent(source, 'el', 'en');
    expect(content.attachment).toBe('BR');
    expect(content.paragraphs[0]?.runs[0]?.style).toEqual(STYLE);
  });
});

describe('ADR-651 Φάση Κ — άγνωστος όρος', () => {
  it('μένει ως έχει και αναφέρεται — ποτέ κενό, ποτέ μαντεψιά', () => {
    const { content, unknownTerms } = localizeTitleBlockContent(
      node('Έργο: {{project.name}}', 'ΑΡΜΟΔΙΑ ΥΠΗΡΕΣΙΑ: {{project.code}}'),
      'el',
      'en',
    );
    expect(texts(content)).toEqual([
      'Project: {{project.name}}',
      'ΑΡΜΟΔΙΑ ΥΠΗΡΕΣΙΑ: {{project.code}}',
    ]);
    expect(unknownTerms).toEqual(['ΑΡΜΟΔΙΑ ΥΠΗΡΕΣΙΑ']);
  });

  it('κενή/ασυνήθιστη πινακίδα δεν ρίχνει ποτέ τη μεταγλώττιση', () => {
    expect(() => localizeTitleBlockContent(node(''), 'el', 'en')).not.toThrow();
    expect(() => localizeTitleBlockContent(node('   '), 'el', 'en')).not.toThrow();
    expect(() => localizeTitleBlockContent(node('{{a}}{{b}}'), 'el', 'en')).not.toThrow();
  });
});

describe('ADR-651 Φάση Κ — idempotency', () => {
  it('ίδια γλώσσα ⇒ ταυτοτικό (καμία περιττή εγγραφή)', () => {
    const source = node('Έργο: {{project.name}}');
    const result = localizeTitleBlockContent(source, 'el', 'el');
    expect(result.content).toBe(source);
    expect(result.unknownTerms).toEqual([]);
  });

  it('δεύτερη μεταγλώττιση el→en πάνω σε ήδη αγγλικό δεν το ξαναγυρίζει', () => {
    const once = localizeTitleBlockContent(node('Έργο: {{project.name}}'), 'el', 'en').content;
    const twice = localizeTitleBlockContent(once, 'el', 'en').content;
    expect(texts(twice)).toEqual(['Project: {{project.name}}']);
  });
});

describe('ADR-651 Φάση Κ — μάζεψε / εφάρμοσε (ο πίνακας έγκρισης)', () => {
  it('μαζεύει τους μοναδικούς όρους με τη σειρά που τους διαβάζει ο χρήστης', () => {
    const terms = collectTitleBlockTerms(
      node('Έργο: {{project.name}}', 'Κλίμακα: {{drawing.scale}}', 'Έργο: {{project.code}}'),
    );
    expect(terms).toEqual(['Έργο', 'Κλίμακα']);
  });

  it('εφαρμόζει ΜΟΝΟ τις εγκεκριμένες μεταφράσεις· ό,τι λείπει μένει ως έχει', () => {
    const content = applyTitleBlockTranslation(
      node('ΘΕΩΡΗΘΗΚΕ: {{user.checkerName}}', 'Έργο: {{project.name}}'),
      new Map([['ΘΕΩΡΗΘΗΚΕ', 'APPROVED']]),
    );
    expect(texts(content)).toEqual(['APPROVED: {{user.checkerName}}', 'Έργο: {{project.name}}']);
  });

  it('κενή μετάφραση αγνοείται — ο χρήστης δεν μπορεί να σβήσει ετικέτα κατά λάθος', () => {
    const content = applyTitleBlockTranslation(
      node('Έργο: {{project.name}}'),
      new Map([['Έργο', '   ']]),
    );
    expect(texts(content)).toEqual(['Έργο: {{project.name}}']);
  });
});
