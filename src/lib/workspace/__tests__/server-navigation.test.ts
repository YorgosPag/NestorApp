/**
 * Άγκυρα του συνόρου πλοήγησης του ΔΙΑΚΟΜΙΣΤΗ (ADR-875 §11).
 *
 * Ερώτημα: «φτάνει στο `next/navigation` η διεύθυνση **μέσα στον ίδιο χώρο** —
 * και μόνο όταν της ανήκει;» Το `redirect` του Next πετά· εδώ το ψεύτικο πετά με
 * τη διεύθυνση που του δόθηκε, ώστε να κρίνεται **τι παραδόθηκε**, όχι τι γράφτηκε.
 */

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { redirect } from '../server-navigation';
import { withQuery } from '../route-worlds';

const delivered = (run: () => void): string => {
  try {
    run();
  } catch (error) {
    return (error as Error).message.replace('NEXT_REDIRECT:', '');
  }
  throw new Error('το redirect ΔΕΝ πέταξε — το σύνορο κατάπιε την ανακατεύθυνση');
};

describe('Σ — το σύνορο του διακομιστή', () => {
  it('Σ1: 🔴 διεύθυνση ΜΕΣΑ στον χώρο παίρνει τον χώρο της σελίδας — όχι το δίχτυ', () => {
    expect(delivered(() => redirect('/projects', 'nikos'))).toBe('/o/nikos/projects');
  });

  it('Σ2: το ερώτημα επιβιώνει αυτούσιο', () => {
    expect(
      delivered(() => redirect(withQuery('/spaces/parking', 'parkingId=park_1'), 'nikos')),
    ).toBe('/o/nikos/spaces/parking?parkingId=park_1');
  });

  it('Σ3: η ΜΟΡΦΗ του χώρου μένει όπως τη ζήτησε ο άνθρωπος (ταυτότητα, όχι ψευδώνυμο)', () => {
    expect(delivered(() => redirect('/contacts', 'comp_alpha'))).toBe('/o/comp_alpha/contacts');
  });

  it('Σ4: η ΣΥΝΔΕΣΗ μένει ωμή — επειδή το λέει ο κριτής, όχι επειδή το θυμήθηκε ο καλών', () => {
    expect(delivered(() => redirect('/login', 'nikos'))).toBe('/login');
  });
});
