/**
 * ADR-739 Φ.Δ βήμα 6 — **η σειρά των μετασχηματισμών του ζωντανού κουτιού.**
 *
 * ## Το ρίσκο, με μία πρόταση
 * Το επεκτεταμένο κουτί ενός κελιού μπορεί να χρειάζεται να απλωθεί **αριστερά** (δεξιά
 * στοίχιση). Ένα ξεχασμένο `translate` **πριν** το `rotate` μοιάζει σωστό σε **κάθε** πίνακα
 * με γωνία μηδέν — και ξεκολλά τον επεξεργαστή από το κελί του μόλις ο πίνακας γυρίσει έστω
 * λίγο. Είναι ακριβώς η κατηγορία σφάλματος που κανένα test με `angleRad = 0` δεν πιάνει,
 * γι' αυτό εδώ ελέγχεται η **σειρά** και όχι το αποτέλεσμα.
 *
 * ## Γιατί ελέγχεται το αλφαριθμητικό και όχι η τελική θέση
 * Η σύνθεση CSS transform είναι **η σημασιολογία**: `rotate(θ) translate(g, 0)` σημαίνει
 * «μετακινήσου κατά μήκος του γυρισμένου άξονα», ενώ `translate(g, 0) rotate(θ)` σημαίνει
 * «μετακινήσου οριζόντια στην οθόνη». Οι δύο δίνουν ίδιο αποτέλεσμα **μόνο** για θ = 0. Η
 * jsdom δεν υπολογίζει matrices, άρα η σειρά είναι το μόνο πράγμα που **μπορεί** να ελεγχθεί
 * εδώ — και τυχαίνει να είναι και το μόνο που έχει σημασία.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { TextEditorAnchorLayer, type TextEditorAnchorBox } from '../TextEditorAnchorLayer';

jest.mock('../responsive', () => ({ useVisualViewport: () => ({ keyboardInset: 0 }) }));

const ANCHOR = { x: 200, y: 150 };

function renderLayer(box: Partial<TextEditorAnchorBox>) {
  const full: TextEditorAnchorBox = { widthPx: 100, heightPx: 20, rotationRad: 0, ...box };
  const view = render(
    <TextEditorAnchorLayer
      project={() => ANCHOR}
      subscribe={() => () => undefined}
      size={{ width: 100, height: 20 }}
      projectBox={() => full}
    >
      <span>κελί</span>
    </TextEditorAnchorLayer>,
  );
  const el = view.container.firstElementChild;
  if (!(el instanceof HTMLElement)) throw new Error('δεν αποδόθηκε κουτί');
  return el;
}

describe('TextEditorAnchorLayer — το ζωντανό κουτί', () => {
  it('χωρίς κλίση και χωρίς μετατόπιση: μόνο η θέση', () => {
    expect(renderLayer({}).style.transform).toBe('translate(200px, 150px)');
  });

  it('το μέγεθος γράφεται επιτακτικά πάνω στο στοιχείο', () => {
    const el = renderLayer({ widthPx: 340, heightPx: 84 });
    expect(el.style.width).toBe('340px');
    expect(el.style.height).toBe('84px');
  });

  it('🔴 η ΤΟΠΙΚΗ μετατόπιση μπαίνει ΜΕΤΑ την περιστροφή — ποτέ πριν', () => {
    const transform = renderLayer({ rotationRad: 0.5, offsetXPx: -40 }).style.transform;
    expect(transform).toBe('translate(200px, 150px) rotate(0.5rad) translate(-40px, 0px)');
    // Η σειρά είναι όλη η ουσία: αν το `translate(-40px, 0px)` έμπαινε πριν το `rotate`, το
    // κουτί θα έφευγε οριζόντια στην οθόνη αντί κατά μήκος της γραμμής του πίνακα.
    expect(transform.indexOf('rotate')).toBeLessThan(transform.lastIndexOf('translate'));
  });

  it('ADR-739 Φ.Δ βήμα 7 — η ΚΑΤΑΚΟΡΥΦΗ μετατόπιση ταξιδεύει στο ίδιο τοπικό σύστημα', () => {
    // Γεννήθηκε για τη **γραμμή τύπων**: αγκυρώνεται στη γωνία του πίνακα και κάθεται πιο
    // πάνω κατά ένα ύψος ζώνης δείκτη — απόσταση σε px οθόνης, άρα αδύνατη ως σημείο κόσμου.
    const transform = renderLayer({ offsetXPx: -28, offsetYPx: -48 }).style.transform;
    expect(transform).toBe('translate(200px, 150px) translate(-28px, -48px)');
  });

  it('🔴 ο ένας άξονας ΔΕΝ μηδενίζει σιωπηλά τον άλλο', () => {
    // Αν το `slice` εκπεμπόταν μόνο όταν το x είναι μη-μηδενικό, ένα κουτί με μόνο
    // κατακόρυφη μετατόπιση θα κολλούσε πάνω στο άγκυρό του — αόρατο σε κάθε test του x.
    expect(renderLayer({ offsetYPx: -48 }).style.transform).toBe(
      'translate(200px, 150px) translate(0px, -48px)',
    );
  });

  it('μηδενική μετατόπιση δεν μολύνει το transform', () => {
    expect(renderLayer({ rotationRad: 0.5, offsetXPx: 0, offsetYPx: 0 }).style.transform).toBe(
      'translate(200px, 150px) rotate(0.5rad)',
    );
  });

  it('οι custom properties φτάνουν στο κουτί — ο δρόμος του παιδιού προς το ζωντανό μέγεθος', () => {
    const el = renderLayer({ cssVars: { '--tce-print-w': '180px' } });
    expect(el.style.getPropertyValue('--tce-print-w')).toBe('180px');
  });
});
