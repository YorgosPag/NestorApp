/**
 * ADR-651 Φάση Γ — βιβλιοθήκη presets + έξυπνη πρόταση χαρτιού + options store.
 *
 * Καρφώνει τις τρεις αποφάσεις του Giorgio που είναι εύκολο να «ξεφύγουν» σιωπηλά:
 *  - #3 βιβλιοθήκη: κάθε preset έχει EL ΚΑΙ EN πρότυπο + ετικέτα i18n (όχι hardcoded UI string),
 *  - #2 πρόταση χαρτιού: μικρό σχέδιο ⇒ μικρό φύλλο, μεγάλο ⇒ μεγάλο, ΠΟΤΕ κλείδωμα του χρήστη,
 *  - #8 γλώσσα: το preset αλλάζει γλώσσα, όχι δομή.
 */

// Defensive (ίδιο guard με το `resolve-tool-active-trigger-coverage.test.ts`): το barrel των
// contextual tabs τραβά τον stair bridge → firestore → firebase/auth, που αγγίζει `fetch` στο import.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import el from '@/i18n/locales/el/dxf-viewer-shell.json';
import en from '@/i18n/locales/en/dxf-viewer-shell.json';
import { useTitleBlockOptionsStore } from '../../../state/title-block-options-store';
import { CONTEXTUAL_TITLE_BLOCK_TAB } from '../../../ui/ribbon/data/contextual-title-block-tab';
import { resolveToolActiveTrigger } from '../../../app/resolve-tool-active-trigger';
import {
  DEFAULT_TITLE_BLOCK_PRESET_ID,
  TITLE_BLOCK_PRESETS,
  isTitleBlockPresetId,
  titleBlockPreset,
} from '../title-block-presets';
import { suggestPaperSpec } from '../suggest-paper';

/** Διαβάζει ένθετο i18n κλειδί («a.b.c») από ένα bundle. */
function lookup(bundle: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
    bundle,
  );
}

describe('TITLE_BLOCK_PRESETS — η βιβλιοθήκη (Απόφαση #3)', () => {
  it('περιέχει τα τρία ζητούμενα preset + το τυπικό, με μοναδικά ids', () => {
    const ids = TITLE_BLOCK_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['permit', 'simple', 'detail', 'standard']));
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_TITLE_BLOCK_PRESET_ID).toBe('standard');
  });

  it.each(TITLE_BLOCK_PRESETS)('«$id»: πρότυπο σε EL ΚΑΙ EN, ίδια κατηγορία (Απόφαση #8)', (preset) => {
    expect(preset.templates.el.locale).toBe('el');
    expect(preset.templates.en.locale).toBe('en');
    expect(preset.templates.el.category).toBe('title-block');
    expect(preset.templates.en.category).toBe('title-block');
    expect(preset.templates.el.content.paragraphs.length).toBeGreaterThan(0);
  });

  it.each(TITLE_BLOCK_PRESETS)('«$id»: η ετικέτα του ribbon είναι i18n κλειδί που υπάρχει σε EL+EN (N.11)', (preset) => {
    for (const bundle of [el, en] as const) {
      expect(lookup(bundle, preset.labelKey)).toBeTruthy();
    }
  });

  it('«Άδεια δόμησης»: φέρει κελί σφραγίδας + τα ΤΕΕ πεδία (ΑΜ ΤΕΕ / θέση / εργοδότης)', () => {
    const permit = titleBlockPreset('permit');
    expect(permit.withStampBox).toBe(true);
    expect(permit.stampLabel.el).toBeTruthy();
    expect(permit.stampLabel.en).toBeTruthy();
    expect(permit.templates.el.placeholders).toEqual(
      expect.arrayContaining(['user.licenseNumber', 'project.location', 'project.client']),
    );
  });

  it('άγνωστο id ⇒ πέφτει στο default (ποτέ crash από παλιά persisted τιμή)', () => {
    expect(titleBlockPreset('ό,τι να ναι').id).toBe(DEFAULT_TITLE_BLOCK_PRESET_ID);
    expect(isTitleBlockPresetId('permit')).toBe(true);
    expect(isTitleBlockPresetId('nope')).toBe(false);
  });
});

describe('suggestPaperSpec — έξυπνη πρόταση (Απόφαση #2)', () => {
  it('κτίριο 12m × 8m στο 1:50 ⇒ 240×160mm χαρτιού ⇒ A3 πλαγιαστό', () => {
    expect(suggestPaperSpec({ widthMm: 12_000, heightMm: 8_000 }, 50)).toEqual({
      size: 'A3',
      orientation: 'landscape',
    });
  });

  it('λεπτομέρεια 0.5m × 0.3m στο 1:10 ⇒ χωράει σε A4', () => {
    expect(suggestPaperSpec({ widthMm: 500, heightMm: 300 }, 10).size).toBe('A4');
  });

  it('ψηλό-στενό σχέδιο ⇒ ΟΡΘΙΟ φύλλο (ο προσανατολισμός ακολουθεί την αναλογία)', () => {
    expect(suggestPaperSpec({ widthMm: 4_000, heightMm: 14_000 }, 50).orientation).toBe('portrait');
  });

  it('τεράστιο σχέδιο ⇒ το μεγαλύτερο φύλλο (ποτέ «καμία πρόταση»)', () => {
    expect(suggestPaperSpec({ widthMm: 500_000, heightMm: 400_000 }, 50)).toEqual({
      size: 'A0',
      orientation: 'landscape',
    });
  });

  it('άκυρη κλίμακα ⇒ ασφαλής πρόταση αντί για NaN', () => {
    expect(suggestPaperSpec({ widthMm: 1_000, heightMm: 1_000 }, 0).size).toBe('A0');
  });
});

describe('title-block options store — πρόταση χωρίς κλείδωμα', () => {
  beforeEach(() => {
    useTitleBlockOptionsStore.setState({
      presetId: DEFAULT_TITLE_BLOCK_PRESET_ID,
      paperSize: 'A3',
      orientation: 'landscape',
      withFrame: true,
      paperAutoSuggest: true,
    });
  });

  it('η πρόταση εφαρμόζεται όσο ο χρήστης δεν έχει διαλέξει χαρτί', () => {
    useTitleBlockOptionsStore.getState().applySuggestedPaper({ size: 'A1', orientation: 'portrait' });
    const s = useTitleBlockOptionsStore.getState();
    expect(s.paperSize).toBe('A1');
    expect(s.orientation).toBe('portrait');
  });

  it('μόλις ο χρήστης διαλέξει μέγεθος, καμία πρόταση δεν του το αλλάζει ξανά', () => {
    useTitleBlockOptionsStore.getState().setPaperSize('A0');
    useTitleBlockOptionsStore.getState().applySuggestedPaper({ size: 'A4', orientation: 'portrait' });
    const s = useTitleBlockOptionsStore.getState();
    expect(s.paperAutoSuggest).toBe(false);
    expect(s.paperSize).toBe('A0');
    expect(s.orientation).toBe('landscape');
  });
});

describe('title-block — contextual ribbon tab (Φάση Γ)', () => {
  it('το tab ανοίγει όταν είναι ενεργό το εργαλείο «title-block»', () => {
    expect(resolveToolActiveTrigger('title-block', null)).toBe(CONTEXTUAL_TITLE_BLOCK_TAB.contextualTrigger);
  });

  it('τα κλειδιά ετικετών του tab υπάρχουν σε EL ΚΑΙ EN (N.11)', () => {
    const labelKeys = [
      CONTEXTUAL_TITLE_BLOCK_TAB.labelKey,
      ...CONTEXTUAL_TITLE_BLOCK_TAB.panels.map((p) => p.labelKey),
      ...CONTEXTUAL_TITLE_BLOCK_TAB.panels.flatMap((p) =>
        p.rows.flatMap((r) => r.buttons.map((b) => b.command.labelKey)),
      ),
    ];
    for (const bundle of [el, en] as const) {
      for (const key of labelKeys) expect(lookup(bundle, key)).toBeTruthy();
    }
  });

  it('οι επιλογές preset του ribbon παράγονται από το registry (καμία χειρόγραφη λίστα)', () => {
    const presetCombo = CONTEXTUAL_TITLE_BLOCK_TAB.panels[0].rows[0].buttons[0].command;
    expect(presetCombo.options?.map((o) => o.value)).toEqual(TITLE_BLOCK_PRESETS.map((p) => p.id));
  });
});
