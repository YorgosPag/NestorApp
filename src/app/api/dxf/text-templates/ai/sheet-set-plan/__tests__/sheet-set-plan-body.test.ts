/**
 * ADR-651 Φάση Μ — tests του καθαρού parsing του `sheet-set-plan` wire body.
 *
 * Καρφώνει τη σύμβαση «untrusted input ⇒ ασφαλές αποτέλεσμα, ποτέ throw»: μη-πίνακας ⇒ κενό,
 * αντικείμενα χωρίς id αγνοούνται, string πεδία κόβονται στο όριο, μη-string πεδία → `''`, και
 * ο πίνακας κόβεται στο `MAX_LEVELS`.
 */

import {
  MAX_LEVELS,
  MAX_LEVEL_FIELD_CHARS,
  readSheetSetPlanLevels,
} from '../sheet-set-plan-body';

describe('readSheetSetPlanLevels — untrusted body parsing', () => {
  it('returns [] for a non-array value', () => {
    expect(readSheetSetPlanLevels(undefined)).toEqual([]);
    expect(readSheetSetPlanLevels(null)).toEqual([]);
    expect(readSheetSetPlanLevels('lvl-1')).toEqual([]);
    expect(readSheetSetPlanLevels({ id: 'lvl-1' })).toEqual([]);
  });

  it('keeps only well-formed entries with a non-empty id', () => {
    const levels = readSheetSetPlanLevels([
      { id: 'lvl-ground', name: 'Ισόγειο', label: 'Κάτοψη Ισογείου' },
      { id: '   ', name: 'blank id' },
      { id: '', name: 'empty id' },
      { name: 'no id at all' },
      null,
      'not-an-object',
      { id: 'lvl-first', name: '1ος' },
    ]);
    expect(levels).toEqual([
      { id: 'lvl-ground', name: 'Ισόγειο', label: 'Κάτοψη Ισογείου' },
      { id: 'lvl-first', name: '1ος', label: '' },
    ]);
  });

  it('trims the id but preserves name/label as given', () => {
    const [level] = readSheetSetPlanLevels([{ id: '  lvl-x  ', name: '  Όροφος  ', label: '' }]);
    expect(level.id).toBe('lvl-x');
    expect(level.name).toBe('  Όροφος  ');
  });

  it('coerces non-string name/label to empty string', () => {
    const [level] = readSheetSetPlanLevels([{ id: 'lvl-x', name: 42, label: { junk: true } }]);
    expect(level).toEqual({ id: 'lvl-x', name: '', label: '' });
  });

  it('caps string fields at MAX_LEVEL_FIELD_CHARS', () => {
    const long = 'x'.repeat(MAX_LEVEL_FIELD_CHARS + 50);
    const [level] = readSheetSetPlanLevels([{ id: long, name: long, label: long }]);
    expect(level.id.length).toBe(MAX_LEVEL_FIELD_CHARS);
    expect(level.name.length).toBe(MAX_LEVEL_FIELD_CHARS);
    expect(level.label.length).toBe(MAX_LEVEL_FIELD_CHARS);
  });

  it('caps the number of levels at MAX_LEVELS', () => {
    const many = Array.from({ length: MAX_LEVELS + 25 }, (_, i) => ({ id: `lvl-${i}`, name: `${i}` }));
    expect(readSheetSetPlanLevels(many)).toHaveLength(MAX_LEVELS);
  });
});
