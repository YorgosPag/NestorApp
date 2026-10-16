/**
 * Άγκυρα — **σε φόρμα που ΚΑΤΑΧΩΡΕΙ το Enter δεν υποβάλλει** (`submitOnlyExplicitly`, form-keyboard §3).
 *
 * Η implicit submission της HTML είναι η προεπιλεγμένη ενέργεια του `keydown` Enter σε μονογραμμικό πεδίο· ο
 * φύλακας την ακυρώνει (`defaultPrevented`). Γι' αυτό το test κοιτά το `keydown` και ΟΧΙ το `pressEnterToSubmit`:
 * εκείνο προσομοιώνει την HTML με κλικ στο κουμπί και δεν θα έβλεπε ποτέ την ακύρωση.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { submitOnlyExplicitly } from '../form-keyboard';

function renderForm() {
  const onSubmit = jest.fn((event: { preventDefault: () => void }) => event.preventDefault());
  render(
    <form aria-label="posting" onKeyDown={submitOnlyExplicitly} onSubmit={onSubmit}>
      <input aria-label="quantity" />
      <textarea aria-label="notes" />
      <button type="submit">save</button>
    </form>,
  );
  return onSubmit;
}

describe('submitOnlyExplicitly', () => {
  it('Enter σε πεδίο ⇒ ακύρωση της implicit submission, καμία υποβολή', () => {
    const onSubmit = renderForm();
    expect(fireEvent.keyDown(screen.getByLabelText('quantity'), { key: 'Enter' })).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])('Ctrl/⌘+Enter σε πεδίο ⇒ ρητή υποβολή (%o)', (modifier) => {
    const onSubmit = renderForm();
    fireEvent.keyDown(screen.getByLabelText('quantity'), { key: 'Enter', ...modifier });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Enter σε textarea ⇒ ανέγγιχτο (νέα γραμμή)', () => {
    renderForm();
    expect(fireEvent.keyDown(screen.getByLabelText('notes'), { key: 'Enter' })).toBe(true);
  });

  it('Enter στο κουμπί ⇒ ανέγγιχτο (το κλικ του κουμπιού ΕΙΝΑΙ ρητή πρόθεση)', () => {
    renderForm();
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'save' }), { key: 'Enter' })).toBe(true);
  });

  it('άλλο πλήκτρο σε πεδίο ⇒ ανέγγιχτο', () => {
    renderForm();
    expect(fireEvent.keyDown(screen.getByLabelText('quantity'), { key: 'a' })).toBe(true);
  });
});
