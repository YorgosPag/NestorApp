/**
 * ADR-651 Φάση Κ (§8 #7) — η **γλωσσική παραλλαγή** ως απόσπαση (§5.10, Δρόμος Β).
 *
 * Καρφώνει τα δύο σημεία που, αν σπάσουν, χαλάνε σιωπηλά μια κατατεθειμένη πινακίδα:
 *  1. η εναλλαγή γλώσσας βρίσκει την **εγκεκριμένη** παραλλαγή (και ΠΟΤΕ δεν μεταφράζει μόνη της),
 *  2. το «Ενημέρωση από τον γονιό» **δεν** γράφει ελληνικά πάνω στην αγγλική πινακίδα.
 */

import {
  buildDetachPayload,
  buildPullPayload,
} from '../../templates/template-inheritance';
import type { TextTemplate } from '../../templates/template.types';
import {
  findTitleBlockVariant,
  hasTitleBlockVariant,
  titleBlockTemplateLocale,
} from '../localization/title-block-variant';
import type { DxfTextNode } from '../../types/text-ast.types';

function content(text: string): DxfTextNode {
  return {
    paragraphs: [
      {
        runs: [{ text, style: { fontFamily: 'Arial', bold: false, italic: false, underline: false, overline: false, strikethrough: false, height: 2.5, widthFactor: 1, obliqueAngle: 0, tracking: 1, color: 256 } }],
        indent: 0,
        leftMargin: 0,
        rightMargin: 0,
        tabs: [],
        justification: 0,
        lineSpacingMode: 'multiple',
        lineSpacingFactor: 1,
      },
    ],
    attachment: 'BR',
    lineSpacing: { mode: 'multiple', factor: 1 },
    columns: undefined,
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

function template(overrides: Partial<TextTemplate> & { id: string }): TextTemplate {
  return {
    companyId: 'comp_1',
    name: 'Πινακίδα Γραφείου',
    category: 'title-block',
    content: content('Έργο: {{project.name}}'),
    placeholders: ['project.name'],
    isDefault: false,
    scope: 'company',
    projectId: null,
    parentId: null,
    parentSyncedAt: null,
    createdAt: new Date(1_000),
    updatedAt: new Date(1_000),
    ...overrides,
  };
}

const MASTER_EL = template({ id: 'tpl_text_el', locale: 'el', updatedAt: new Date(5_000) });
const VARIANT_EN = template({
  id: 'tpl_text_en',
  name: 'Πινακίδα Γραφείου (EN)',
  locale: 'en',
  parentId: 'tpl_text_el',
  parentSyncedAt: 5_000,
  content: content('Project: {{project.name}}'),
});

describe('ADR-651 Φάση Κ — εύρεση γλωσσικής παραλλαγής', () => {
  const library = [MASTER_EL, VARIANT_EN];

  it('από το ελληνικό master βρίσκει το αγγλικό παιδί', () => {
    expect(findTitleBlockVariant(library, MASTER_EL, 'en')).toBe(VARIANT_EN);
  });

  it('από την αγγλική παραλλαγή γυρίζει πίσω στον ελληνικό γονιό', () => {
    expect(findTitleBlockVariant(library, VARIANT_EN, 'el')).toBe(MASTER_EL);
  });

  it('ίδια γλώσσα ⇒ το ίδιο το πρότυπο (καμία περιττή αναζήτηση)', () => {
    expect(findTitleBlockVariant(library, MASTER_EL, 'el')).toBe(MASTER_EL);
  });

  it('ΔΕΝ υπάρχει παραλλαγή ⇒ null — ποτέ σιωπηλή μηχανική μετάφραση σε σχέδιο', () => {
    expect(findTitleBlockVariant([MASTER_EL], MASTER_EL, 'en')).toBeNull();
    expect(hasTitleBlockVariant([MASTER_EL], MASTER_EL, 'en')).toBe(false);
  });

  it('πρότυπο χωρίς δηλωμένη γλώσσα (πριν τη Φάση Κ) δεν προσποιείται ότι ξέρει', () => {
    const legacy = template({ id: 'tpl_text_legacy' });
    expect(titleBlockTemplateLocale(legacy)).toBeNull();
    expect(findTitleBlockVariant([legacy], legacy, 'en')).toBeNull();
  });
});

describe('ADR-651 Φάση Κ — η απόσπαση κουβαλά τη μετάφραση', () => {
  it('η παραλλαγή γεννιέται με ΤΟ ΔΙΚΟ ΤΗΣ περιεχόμενο και τη γλώσσα της', () => {
    const payload = buildDetachPayload(MASTER_EL, {
      scope: 'company',
      name: 'Πινακίδα Γραφείου (EN)',
      content: content('Project: {{project.name}}'),
      locale: 'en',
    });

    expect(payload.locale).toBe('en');
    expect(payload.parentId).toBe('tpl_text_el');
    // Γεννιέται «ενήμερη» — καμία ψεύτικη ειδοποίηση ενημέρωσης τη στιγμή που φτιάχτηκε.
    expect(payload.parentSyncedAt).toBe(5_000);
    expect(payload.content.paragraphs[0]?.runs[0]?.text).toBe('Project: {{project.name}}');
  });

  it('χωρίς override ⇒ η κλασική αυτούσια απόσπαση (Φάση Θ) μένει ανέπαφη', () => {
    const payload = buildDetachPayload(MASTER_EL, { scope: 'project', name: 'παραλλαγή' });
    expect(payload.content).toBe(MASTER_EL.content);
    expect(payload.locale).toBeUndefined();
  });
});

describe('ADR-651 Φάση Κ — το pull ΔΕΝ καταστρέφει τη μετάφραση', () => {
  it('ο γονιός φτάνει ΞΑΝΑ-ΜΕΤΑΦΡΑΣΜΕΝΟΣ στη γλώσσα του παιδιού', () => {
    const retranslated = content('Project: {{project.name}} — rev. B');
    const payload = buildPullPayload(MASTER_EL, { content: retranslated });

    expect(payload.content).toBe(retranslated);
    expect(payload.content.paragraphs[0]?.runs[0]?.text).not.toContain('Έργο');
    expect(payload.parentSyncedAt).toBe(5_000);
  });

  it('χωρίς override ⇒ αυτούσια αντιγραφή (η μη-γλωσσική παραλλαγή δεν αλλάζει συμπεριφορά)', () => {
    expect(buildPullPayload(MASTER_EL).content).toBe(MASTER_EL.content);
  });
});
