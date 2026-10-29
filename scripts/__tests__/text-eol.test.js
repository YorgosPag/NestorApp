/**
 * `scripts/lib/text-eol.js` — άγκυρα της ΜΙΑΣ κανονικοποίησης γραμμών (ADR-744 §30 · ADR-727 #2).
 */

'use strict';

const { toLf, toCanonicalText } = require('../lib/text-eol');

describe('toLf', () => {
  it('CRLF ⇒ LF', () => {
    expect(toLf('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('μοναχικό CR ⇒ LF (η παραλλαγή που περνούσε ακέραια σε 4/6 αντίγραφα)', () => {
    expect(toLf('a\rb')).toBe('a\nb');
  });

  it('LF μένει ανέγγιχτο · BOM και τελικά κενά ΔΕΝ αγγίζονται χωρίς επιλογή', () => {
    expect(toLf('﻿a\nb  \n')).toBe('﻿a\nb  \n');
  });
});

describe('toCanonicalText', () => {
  it('χωρίς επιλογές ≡ toLf', () => {
    expect(toCanonicalText('﻿a\r\n')).toBe('﻿a\n');
  });

  it('stripBom κόβει μόνο το αρχικό BOM', () => {
    expect(toCanonicalText('﻿a﻿', { stripBom: true })).toBe('a﻿');
  });

  it('trimEnd κόβει τα τελικά κενά μετά την κανονικοποίηση', () => {
    expect(toCanonicalText('﻿MIT\r\n\r\n', { stripBom: true, trimEnd: true })).toBe('MIT');
  });
});
