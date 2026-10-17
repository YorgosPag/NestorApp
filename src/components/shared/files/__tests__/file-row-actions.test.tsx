/**
 * Υ9 — **«⋮» ΑΝΑ ΑΡΧΕΙΟ, Ο ΚΑΔΟΣ ΜΟΝΟ ΣΤΟ ΜΕΝΟΥ** (ADR-912 §12.14).
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390px)**: ✏️ + κόκκινος 🗑️ σε κάθε γραμμή της λίστας, ένα πάτημα
 * δίπλα-δίπλα. Drive / Dropbox: «⋮» ανά γραμμή· ο κανόνας έμφασης ο ΙΔΙΟΣ με την κεφαλίδα (`presentEntityActions`).
 */

/* global describe, it, expect, jest */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/tooltip';
import { FileRowActions } from '../FileRowActions';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const noop = () => undefined;

function Row({ onOpen = noop, onDelete = noop, onRename = noop }: {
  readonly onOpen?: () => void;
  readonly onDelete?: () => void;
  readonly onRename?: () => void;
}) {
  return (
    // Το `article` της λίστας ανοίγει την προεπισκόπηση με κλικ και με Enter — όπως στο `FilesList`.
    <TooltipProvider>
      <article data-testid="row" onClick={onOpen} onKeyDown={onOpen}>
        <FileRowActions
          fileName="Συμβόλαιο.pdf"
          onRename={onRename}
          linkLabel="link"
          unlinkLabel="unlink"
          onDelete={onDelete}
        />
      </article>
    </TooltipProvider>
  );
}

const more = () => screen.getByRole('button', { name: 'list.fileActions: Συμβόλαιο.pdf' });

describe('Υ9 — ενέργειες γραμμής αρχείου', () => {
  it('🔴 ο κάδος ΔΕΝ είναι κουμπί της γραμμής — ζει ΜΟΝΟ ως menuitem, τελευταίος, με χρώμα κινδύνου', async () => {
    render(<Row />);
    expect(screen.queryByRole('button', { name: 'list.deleteFile' })).toBeNull();

    await userEvent.click(more());
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['list.renameFile', 'list.deleteFile']);
    expect(items[1].className).toContain('text-destructive');
  });

  it('🔴 κλικ στο «⋮» και σε στοιχείο του μενού ΔΕΝ ανοίγει την προεπισκόπηση (portal → bubbling)', async () => {
    const onOpen = jest.fn();
    const onDelete = jest.fn();
    render(<Row onOpen={onOpen} onDelete={onDelete} />);

    await userEvent.click(more());
    await userEvent.click(screen.getByRole('menuitem', { name: 'list.deleteFile' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('✅ το γρήγορο κουμπί μετονομασίας υπάρχει (ορατό μόνο σε συσκευή με hover) και δεν ανοίγει προεπισκόπηση', async () => {
    const onOpen = jest.fn();
    const onRename = jest.fn();
    render(<Row onOpen={onOpen} onRename={onRename} />);

    await userEvent.click(within(screen.getByTestId('row')).getByRole('button', { name: 'list.renameFile' }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('✅ καμία ενέργεια ⇒ ούτε «⋮»', () => {
    render(<FileRowActions fileName="x" linkLabel="l" unlinkLabel="u" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
