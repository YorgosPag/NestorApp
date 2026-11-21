/**
 * Κατάταξη ταιριασμάτων του combobox (`searchable-combobox-matching.ts`) — ADR-372 §8.5 b3 ·
 * ADR-834 §6.5.στ · ADR-ACC-013.
 *
 * 🔴 Το περιστατικό: στον επιλογέα ΚΑΔ (~10.000 επιλογές, `maxDisplayed=30`) το «4100» δεν
 * έφερνε ποτέ το `41.00`, γιατί γραμμές με το `4100` στη ΜΕΣΗ του 8ψήφιου ΓΕΜΗ ήταν πρώτες
 * στη σειρά του καταλόγου και γέμιζαν τις θέσεις πριν από το κόψιμο.
 */

import { OPTION_MATCH_RANK, filterOptions, rankOptionMatch } from '../searchable-combobox-matching';
import type { ComboboxOption } from '../searchable-combobox-types';
import { normalizeForSearch } from '@/utils/greek-text';

const kad = (code: string, gemi: string, description = 'Δραστηριότητα'): ComboboxOption => ({
  value: code,
  label: `${code} — ${description}`,
  secondaryLabel: gemi,
});

const rank = (option: ComboboxOption, query: string) => rankOptionMatch(option, normalizeForSearch(query));

describe('rankOptionMatch — οι βαθμίδες', () => {
  it('value ίσο (μετά την κανονικοποίηση: οι τελείες σβήνουν)', () => {
    expect(rank(kad('41.00', '41000000'), '4100')).toBe(OPTION_MATCH_RANK.VALUE_EQUALS);
  });

  it('label ίσο', () => {
    expect(rank({ value: 'opt_1', label: 'Αθήνα' }, 'αθηνα')).toBe(OPTION_MATCH_RANK.LABEL_EQUALS);
  });

  it('value αρχίζει', () => {
    expect(rank(kad('41.00.11', '41001100'), '4100')).toBe(OPTION_MATCH_RANK.VALUE_STARTS);
  });

  it('label αρχίζει', () => {
    expect(rank({ value: 'opt_1', label: 'Θεσσαλονίκη' }, 'θεσ')).toBe(OPTION_MATCH_RANK.LABEL_STARTS);
  });

  it('secondary αρχίζει', () => {
    expect(rank({ value: 'opt_1', label: 'Πελάτης', secondaryLabel: 'info@aries.gr' }, 'info'))
      .toBe(OPTION_MATCH_RANK.SECONDARY_STARTS);
  });

  it('λέξη του label αρχίζει', () => {
    expect(rank({ value: 'opt_1', label: 'Κατασκευή κτιρίων' }, 'κτιρ')).toBe(OPTION_MATCH_RANK.LABEL_WORD_STARTS);
  });

  it('περιέχεται οπουδήποτε', () => {
    expect(rank(kad('01.11.41', '01114100'), '4100')).toBe(OPTION_MATCH_RANK.CONTAINS);
  });

  it('δεν ταιριάζει ⇒ null', () => {
    expect(rank({ value: 'opt_1', label: 'Αθήνα' }, 'πάτρα')).toBeNull();
  });
});

describe('filterOptions', () => {
  it('🔴 «4100»: το 41.00 πρώτο, ακόμη κι αν 40 γραμμές με το 4100 στη μέση προηγούνται στον κατάλογο', () => {
    const noise = Array.from({ length: 40 }, (_, i) => {
      const n = String(i + 10);
      return kad(`01.${n}.41`, `01${n}4100`);
    });
    const options = [...noise, kad('41.00', '41000000'), kad('41.00.11', '41001100')];

    const result = filterOptions(options, '4100', 30);

    expect(result).toHaveLength(30);
    expect(result.map((o) => o.value).slice(0, 2)).toEqual(['41.00', '41.00.11']);
  });

  it('σταθερή σειρά μέσα στην ίδια βαθμίδα (η σειρά της πηγής)', () => {
    const options = [kad('41.00.12', '41001200'), kad('41.00.11', '41001100'), kad('41.00.13', '41001300')];
    expect(filterOptions(options, '41.00.1', 10).map((o) => o.value)).toEqual(['41.00.12', '41.00.11', '41.00.13']);
  });

  it('το ΣΥΝΟΛΟ των ταιριασμάτων μένει το ίδιο με το απλό substring — αλλάζει μόνο η σειρά', () => {
    const options = [
      kad('01.11.41', '01114100'),
      kad('41.00', '41000000'),
      kad('42.11', '42110000'),
      { value: 'x', label: 'Τίποτα σχετικό' },
    ];
    const values = filterOptions(options, '4100', 100).map((o) => o.value);
    expect(new Set(values)).toEqual(new Set(['01.11.41', '41.00']));
  });

  it('κενό κείμενο ⇒ τα πρώτα N, χωρίς κατάταξη', () => {
    const options = [kad('01.11.41', '01114100'), kad('41.00', '41000000'), kad('42.11', '42110000')];
    expect(filterOptions(options, '   ', 2).map((o) => o.value)).toEqual(['01.11.41', '41.00']);
  });
});
