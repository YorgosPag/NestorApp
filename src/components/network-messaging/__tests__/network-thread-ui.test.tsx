/**
 * @jest-environment jsdom
 *
 * ADR-867 Β7 — ΑΓΚΥΡΕΣ ΑΠΟΔΟΣΗΣ της οθόνης του νήματος — Υ-1…Υ-7.
 * Το i18n επιστρέφει το κλειδί: κρίνεται **ποιο** κείμενο διάλεξε η οθόνη, όχι η μετάφρασή του.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { NetworkMessage } from '@/types/network-thread';

import { MESSAGE_KEYS } from '../network-messaging-keys';
import { NetworkComposer } from '../NetworkComposer';
import { NetworkMessageItem } from '../NetworkMessageItem';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

function msg(extra: Partial<NetworkMessage> = {}): NetworkMessage {
  return {
    id: 'nmsg_1',
    senderUid: 'uid_me',
    text: 'τιμή 180.000',
    createdAt: '2026-09-19T10:00:00.000Z',
    editedAt: null,
    retractedAt: null,
    readBeforeRetraction: null,
    readBeforeEdit: null,
    ...extra,
  };
}

const noop = () => undefined;
const item = (message: NetworkMessage, own: boolean, retractMinutesLeft: number | null = null) => (
  <ul>
    <NetworkMessageItem
      message={message}
      own={own}
      continuation={false}
      affordances={{ retractMinutesLeft, canEdit: own && message.retractedAt === null }}
      senderName="Μαρία"
      readOnly={false}
      onRetract={noop}
      onEdit={async () => true}
    />
  </ul>
);

describe('Υ — ένα μήνυμα', () => {
  it('Υ-1 🔒 το σώμα είναι ΚΕΙΜΕΝΟ, ποτέ HTML (μετάλλαξη: dangerouslySetInnerHTML)', () => {
    const { container } = render(item(msg({ text: '<b id="x">βαρύ</b>' }), false));
    expect(container.querySelector('#x')).toBeNull();
    expect(screen.getByText('<b id="x">βαρύ</b>')).toBeTruthy();
  });

  it('Υ-2 🏆 η ταφόπλακα λέει ότι ΕΙΧΕ διαβαστεί — και δεν δείχνει ποτέ σώμα (μετάλλαξη: ίδιο κείμενο πάντα)', () => {
    render(item(msg({ text: '', retractedAt: '2026-09-19T10:05:00.000Z', readBeforeRetraction: true }), false));
    expect(screen.getByText(MESSAGE_KEYS.retractedRead)).toBeTruthy();
    expect(screen.queryByText(MESSAGE_KEYS.retractedUnread)).toBeNull();
  });

  it('Υ-3 🏆 «επεξεργάστηκε αφού διαβάστηκε» όταν ισχύει (μετάλλαξη: πάντα σκέτο «επεξεργάστηκε»)', () => {
    render(item(msg({ editedAt: '2026-09-19T11:00:00.000Z', readBeforeEdit: true }), false));
    expect(screen.getByText(`(${MESSAGE_KEYS.editedAfterRead})`)).toBeTruthy();
  });

  it('Υ-4 ξένο μήνυμα ⇒ κανένα μενού ενεργειών (μετάλλαξη: μενού σε κάθε μήνυμα)', () => {
    render(item(msg({ senderUid: 'uid_other' }), false, 30));
    expect(screen.queryByLabelText(MESSAGE_KEYS.actions)).toBeNull();
  });

  it('Υ-5 δικό μου ⇒ μενού ενεργειών (επεξεργασία χωρίς όριο χρόνου)', () => {
    render(item(msg(), true, null));
    expect(screen.getByLabelText(MESSAGE_KEYS.actions)).toBeTruthy();
  });
});

describe('Υ — το πλαίσιο γραφής', () => {
  it('Υ-6 Enter στέλνει και αδειάζει · Shift+Enter ΔΕΝ στέλνει (μετάλλαξη: αγνοείται το Shift)', () => {
    const onSend = jest.fn();
    render(<NetworkComposer disabled={false} onSend={onSend} />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(box, { target: { value: 'γεια' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('γεια');
    expect(box.value).toBe('');
  });

  it('Υ-7 πάνω από το όριο του γραφέα ⇒ δεν στέλνει (μετάλλαξη: δεύτερο, άλλο όριο)', () => {
    const onSend = jest.fn();
    render(<NetworkComposer disabled={false} onSend={onSend} />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });
});
