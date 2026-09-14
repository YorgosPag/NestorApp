/**
 * ADR-841 §7 Α21.17 — RFC 6266 / 5987: ελληνικό όνομα αρχείου χωρίς απώλειες, καμία έγχυση παραμέτρου.
 */

import { attachmentDisposition } from '../content-disposition';

describe('attachmentDisposition', () => {
  it('ελληνικό όνομα: ASCII εφεδρεία ΚΑΙ UTF-8 όνομα', () => {
    expect(attachmentDisposition('ΒΑΦΕΣ.vcf')).toBe(
      `attachment; filename="_____.vcf"; filename*=UTF-8''${encodeURIComponent('ΒΑΦΕΣ.vcf')}`,
    );
  });

  it('🔴 εισαγωγικό και ανάστροφη κάθετος ΔΕΝ κλείνουν το πεδίο της εφεδρείας', () => {
    expect(attachmentDisposition('a"b\\c.txt')).toContain('filename="a_b_c.txt";');
  });

  it("' ( ) * κωδικοποιούνται — δεν ανήκουν στο attr-char του RFC 5987", () => {
    expect(attachmentDisposition("it's (1)*.txt")).toContain("filename*=UTF-8''it%27s%20%281%29%2A.txt");
  });
});
