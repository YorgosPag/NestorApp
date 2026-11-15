/**
 * ΑΓΚΥΡΑ — **μία στίξη στο σύνορο τιμής/φράσης** στον κοινό σκελετό των email πρόσκλησης (ADR-915 §45.9 · §45.11).
 *
 * - «Ετικέτα: τιμή»: ετικέτα που λήγει ήδη σε στίξη δεν παίρνει και «:» («Δεν ήσασταν εσείς;:» ⇒ «Δεν ήσασταν εσείς;»).
 * - Φράση που κλείνει με όνομα ακινήτου «… τ.μ.» δεν γράφει «..» — σε **όλα** τα email που περνούν από τον συνθέτη.
 * - Τιμή `{ plain }` μένει χωρίς έμφαση (ο ρόλος μέσα στην πρόταση της μεταβίβασης).
 */

/* global describe, it, expect */

import { emphasizedInvitationLine, invitationDetailLine } from '../invitation-email-shared';

describe('invitationDetailLine — μία στίξη μετά την ετικέτα', () => {
  it('ετικέτα χωρίς στίξη ⇒ «Ετικέτα: τιμή»', () => {
    expect(invitationDetailLine('Λήξη', '30/11/2026')).toEqual({ html: 'Λήξη: <strong>30/11/2026</strong>', text: 'Λήξη: 30/11/2026' });
  });

  it('ετικέτα που λήγει σε ερωτηματικό (λατινικό ή ελληνικό) · τελεία · αποσιωπητικά ⇒ κανένα «:»', () => {
    expect(invitationDetailLine('Δεν ήσασταν εσείς;', 'Ενημερώστε το γραφείο').text).toBe('Δεν ήσασταν εσείς; Ενημερώστε το γραφείο');
    expect(invitationDetailLine('Was this not you?', 'Tell the office').text).toBe('Was this not you? Tell the office');
    expect(invitationDetailLine('Δεν ήσασταν εσείς;', 'Χ').text).toBe('Δεν ήσασταν εσείς; Χ');
    expect(invitationDetailLine('Σημείωση.', 'Χ').text).toBe('Σημείωση. Χ');
    expect(invitationDetailLine('Και μετά…', 'Χ').text).toBe('Και μετά… Χ');
    expect(invitationDetailLine('Δεν ήσασταν εσείς;', 'Χ').html).toBe('Δεν ήσασταν εσείς; <strong>Χ</strong>');
  });
});

describe('emphasizedInvitationLine — τιμή χωρίς έμφαση + μία τελεία', () => {
  const intro = (host: string, role: string, property: string) => `${host} σας ορίζει ${role} στη μεταβίβαση του ακινήτου ${property}.`;

  it('ο ρόλος `{ plain }` μένει χωρίς <strong>, τα άλλα τονίζονται, και «τ.μ.» δεν γίνεται «τ.μ..»', () => {
    const line = emphasizedInvitationLine(intro, ['ALFA', { plain: 'συμβολαιογράφο' }, 'Διαμέρισμα 95 τ.μ.']);
    expect(line.text).toBe('ALFA σας ορίζει συμβολαιογράφο στη μεταβίβαση του ακινήτου Διαμέρισμα 95 τ.μ.');
    expect(line.html).toBe('<strong>ALFA</strong> σας ορίζει συμβολαιογράφο στη μεταβίβαση του ακινήτου <strong>Διαμέρισμα 95 τ.μ.</strong>');
  });

  it('τιμή `{ plain }` διαφεύγει σε HTML όπως και η τονισμένη', () => {
    expect(emphasizedInvitationLine((a: string) => `ρόλος ${a}.`, [{ plain: '<x>' }]).html).toBe('ρόλος &lt;x&gt;.');
  });
});
