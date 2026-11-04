import { diffText, hasTextChange, textSegments, type TextDiffPart } from '../text-diff';

const side = (parts: readonly TextDiffPart[], drop: 'added' | 'removed') =>
  parts.filter((part) => part.kind !== drop).map((part) => part.text).join('');

describe('text-diff — λέξη-προς-λέξη', () => {
  it('ελληνικές λέξεις μένουν ακέραιες (όχι ανά χαρακτήρα)', () => {
    expect(textSegments('Η κράτηση καλής εκτέλεσης')).toEqual(['Η', ' ', 'κράτηση', ' ', 'καλής', ' ', 'εκτέλεσης']);
  });

  it('ίδιο κείμενο ⇒ ένα τμήμα same · κενό ⇒ κανένα', () => {
    expect(diffText('Ίδιο κείμενο.', 'Ίδιο κείμενο.')).toEqual([{ kind: 'same', text: 'Ίδιο κείμενο.' }]);
    expect(diffText('', '')).toEqual([]);
    expect(hasTextChange(diffText('α β', 'α β'))).toBe(false);
  });

  it('αλλαγή μίας λέξης: μόνο αυτή σημειώνεται', () => {
    const parts = diffText('Η κράτηση είναι πέντε τοις εκατό.', 'Η κράτηση είναι δέκα τοις εκατό.');
    expect(parts.filter((part) => part.kind !== 'same')).toEqual([
      { kind: 'removed', text: 'πέντε' },
      { kind: 'added', text: 'δέκα' },
    ]);
  });

  it('τόνοι και διαλυτικά είναι διαφορά (άλλη λέξη)', () => {
    expect(hasTextChange(diffText('προϊόν', 'προιόν'))).toBe(true);
    expect(hasTextChange(diffText('εργασία', 'εργασια'))).toBe(true);
  });

  it('η σύνθεση δίνει ακριβώς το παλιό και το νέο κείμενο', () => {
    const before = 'Ο υπεργολάβος καταθέτει ενημερότητα, πριν από κάθε πληρωμή.';
    const after = 'Ο υπεργολάβος καταθέτει φορολογική και ασφαλιστική ενημερότητα πριν από την πληρωμή!';
    const parts = diffText(before, after);
    expect(side(parts, 'added')).toBe(before);
    expect(side(parts, 'removed')).toBe(after);
  });

  it('προσθήκη από το μηδέν και διαγραφή ολόκληρου', () => {
    expect(diffText('', 'Νέα ρήτρα')).toEqual([{ kind: 'added', text: 'Νέα ρήτρα' }]);
    expect(diffText('Παλιά ρήτρα', '')).toEqual([{ kind: 'removed', text: 'Παλιά ρήτρα' }]);
  });

  it('συνεχόμενα τμήματα ίδιου είδους ενώνονται σε φράση', () => {
    const parts = diffText('α', 'α β γ δ');
    expect(parts).toEqual([{ kind: 'same', text: 'α' }, { kind: 'added', text: ' β γ δ' }]);
  });
});
