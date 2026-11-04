import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import { list, paragraph, param } from '../clause-body-builders';
import { blocksOfText, textOfBlocks } from '../clause-blocks-text';

describe('clause-blocks-text — κανόνας επιμέτρησης ως απλό κείμενο (ADR-928 Φ3γ-2)', () => {
  const rules = DEFAULT_TRADE_TEMPLATES.flatMap((template) => template.lines.flatMap((line) => (line.measurementRule ? [line.measurementRule] : [])));

  it('υπάρχει τουλάχιστον ένας σπαρμένος κανόνας με λίστα (αλλιώς το test δεν αποδεικνύει τίποτα)', () => {
    expect(rules.some((rule) => rule.blocks.some((block) => block.kind === 'list'))).toBe(true);
  });

  it('στρογγυλή διαδρομή χωρίς απώλειες για κάθε σπαρμένο κανόνα', () => {
    for (const rule of rules) {
      const text = textOfBlocks(rule.blocks);
      expect(text).not.toBeNull();
      expect(blocksOfText(text ?? '')).toEqual(rule.blocks);
    }
  });

  it('παράγραφοι, λίστα με κουκκίδες, αριθμημένη λίστα', () => {
    const text = 'Πρώτη παράγραφος.\n\n- α\n- β\n\n1. ένα\n2. δύο';
    expect(blocksOfText(text)).toEqual([paragraph('Πρώτη παράγραφος.'), list(false, 'α', 'β'), list(true, 'ένα', 'δύο')]);
    expect(textOfBlocks(blocksOfText(text))).toBe(text);
  });

  it('γραμμή που δεν είναι στοιχείο λίστας ⇒ όλο το κομμάτι μένει παράγραφος (καμία μισή λίστα)', () => {
    expect(blocksOfText('- α\nκαι συνέχεια')).toEqual([paragraph('- α\nκαι συνέχεια')]);
  });

  it('κενό κείμενο ⇒ κανένα μπλοκ· CRLF γίνεται LF', () => {
    expect(blocksOfText('  \n\n ')).toEqual([]);
    expect(blocksOfText('α\r\n\r\nβ')).toEqual([paragraph('α'), paragraph('β')]);
  });

  it('μπλοκ με παράμετρο ⇒ null (η θέση παραμέτρου δεν γράφεται με το χέρι)', () => {
    expect(textOfBlocks([paragraph('Κράτηση ', param('rate'))])).toBeNull();
  });
});
