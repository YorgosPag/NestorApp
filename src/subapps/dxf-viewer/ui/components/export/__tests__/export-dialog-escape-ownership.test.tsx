/**
 * 🔴 ADR-739 §27.16 Ε7 / ADR-364 §10.2 — **Ο ΔΙΑΛΟΓΟΣ ΕΞΑΓΩΓΗΣ ΟΦΕΙΛΕΙ ΝΑ ΕΧΕΙ SLOT ΣΤΟΝ BUS.**
 *
 * Ζωντανά, με ανοιχτό τον διάλογο εξαγωγής, το dev audit φώναζε
 * `[EscapeBus/audit] SHADOW-OWNER` σε κάθε `Escape`: «*κανένας handler του bus δεν διεκδίκησε,
 * αλλά κάποιος άλλος το κατανάλωσε*». Ο «κάποιος άλλος» είναι το `DismissableLayer` του Radix,
 * που ακούει σε **document capture** και καλεί `preventDefault()`.
 *
 * ## Γιατί δεν είναι «αισθητικό» θέμα κονσόλας — δύο πραγματικές συνέπειες
 *  1. **Η σειρά είναι τυχαία, όχι δηλωμένη.** Ο bus τρέχει σε **window** capture και είναι
 *     πρώτος· αν κάποιος handler του διεκδικήσει (π.χ. το `canvas/fallback-deselect` στο P400,
 *     που απαντά «ναι» όποτε υπάρχει επιλεγμένη οντότητα), το Radix **δεν βλέπει ποτέ** το
 *     `Escape` — και ο διάλογος **δεν κλείνει**, ενώ ο καμβάς από κάτω αποεπιλέγεται. Αυτό
 *     ακριβώς μετρήθηκε με το μενού κεφαλίδας πίνακα (§27.7) και διορθώθηκε **με slot**.
 *  2. **Ένας συναγερμός που χτυπά σε κάθε χρήση** εκπαιδεύει στην αγνόηση του Μηχανισμού 1 —
 *     δηλαδή υπονομεύει το ίδιο το ADR-364, ακριβώς όπως το κατέγραψε το §10.15.
 *
 * ⚠️ Το test **δεν** ρωτά «τύπωσε warning;»: ρωτά αν ο **bus** διεκδίκησε το πλήκτρο —
 * αυτό είναι το συμβόλαιο. Η σιωπή της κονσόλας δεν είναι απόδειξη (§10.13).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExportDialog } from '../ExportDialog';
import { escapeBus } from '../../../../systems/escape-bus';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' }, ready: true }),
}));

/** Ένα φυσικό `Escape`, στον ίδιο κόμβο και φάση που ακούει ο bus. */
function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('🔴 §27.16 Ε7 — ιδιοκτησία του ESC με ανοιχτό τον διάλογο εξαγωγής', () => {
  it('🔴 ο διάλογος ΔΗΛΩΝΕΙ slot στον bus όσο είναι ανοιχτός', () => {
    render(<ExportDialog open onOpenChange={jest.fn()} onSubmit={jest.fn()} />);
    const ids = escapeBus.inspect().handlers.map((h) => h.id);
    expect(ids).toContain('export/dialog');
  });

  it('🔴 το `Escape` καταναλώνεται ΑΠΟ ΤΟΝ BUS — όχι από σκιώδη ιδιοκτήτη', () => {
    const onOpenChange = jest.fn();
    render(<ExportDialog open onOpenChange={onOpenChange} onSubmit={jest.fn()} />);
    pressEscape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('κλειστός διάλογος ΔΕΝ διεκδικεί το ESC — αλλιώς θα έτρωγε την ακύρωση του καμβά', () => {
    const onOpenChange = jest.fn();
    render(<ExportDialog open={false} onOpenChange={onOpenChange} onSubmit={jest.fn()} />);
    pressEscape();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('η προτεραιότητα είναι MODAL_DIALOG — ο καμβάς είναι μπλοκαρισμένος όσο ο διάλογος ζει', () => {
    render(<ExportDialog open onOpenChange={jest.fn()} onSubmit={jest.fn()} />);
    const slot = escapeBus.inspect().handlers.find((h) => h.id === 'export/dialog');
    expect(slot?.priority).toBe(1000);
  });

  it('ο διάλογος όντως αποδίδεται (θετικός έλεγχος — αλλιώς τα παραπάνω δεν λένε τίποτα)', () => {
    render(<ExportDialog open onOpenChange={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByText('export.dialogTitle')).toBeInTheDocument();
  });
});
