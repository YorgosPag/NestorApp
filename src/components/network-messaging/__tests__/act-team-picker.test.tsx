/**
 * @fileoverview Άγκυρα του επιλογέα της ομάδας (ADR-867 Β9(β) εύρημα Ε2) — Ο-1.
 *
 * 🔴 **Το περιστατικό (2026-09-21, ζωντανά)**: σύγκρουση `If-Match` ⇒ «Κάποιος άλλος άλλαξε την ομάδα…»,
 * η βάση **δεν** άλλαξε — αλλά το «Νέος υπεύθυνος» έδειχνε ακόμη το **απορριφθέν** πρόσωπο, σαν να είχε ισχύσει.
 * Ρίζα: `value={undefined}` ⇒ το Radix `Select` είναι **μη ελεγχόμενο** και κρατά ό,τι πατήθηκε.
 *
 * ⚠️ **Γιατί υποκατάστατο του `Select`**: portal + pointer-events που το jsdom δεν προσομοιώνει. Το
 * υποκατάστατο κρατά την τιμή της **ρίζας** ως χαρακτηριστικό — η άγκυρα ρωτά τη **δική μας** απόφαση
 * (ελεγχόμενο, κενό), όχι τη βιβλιοθήκη.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import type { ActTeamControl } from '@/hooks/network-messaging/useNetworkAwayAndTeam';
import { NETWORK_ACT_KINDS } from '@/types/network-thread';

import { ActTeamManager } from '../ActTeamManager';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const stable = jest
    .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
    .keyEchoTranslation();
  return { useTranslation: () => stable };
});

type Kids = { children?: React.ReactNode };
type RootProps = Kids & { value?: string; onValueChange?: (value: string) => void };

let pickFromLastSelect: (value: string) => void = () => undefined;

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: RootProps) => {
    pickFromLastSelect = (picked) => onValueChange?.(picked);
    return <fieldset data-testid="picker" data-controlled={value === undefined ? 'no' : 'yes'} data-value={value ?? ''}>{children}</fieldset>;
  },
  SelectTrigger: ({ children }: Kids) => <span>{children}</span>,
  SelectValue: () => null,
  SelectContent: ({ children }: Kids) => <ul>{children}</ul>,
  SelectItem: ({ value, children }: Kids & { value: string }) => <li data-value={value}>{children}</li>,
}));

const RESPONSIBLE = 'uid_resp';
const OTHER = 'uid_other';

function controlWith(change: ActTeamControl['change']): ActTeamControl {
  return {
    team: {
      state: 'ready',
      value: {
        success: true,
        canManage: true,
        team: { id: 'nteam_1', actKind: NETWORK_ACT_KINDS[0], responsibleUid: RESPONSIBLE, memberUids: [RESPONSIBLE], version: 2 },
        candidates: [
          { uid: RESPONSIBLE, name: 'Υπεύθυνος', photoUrl: null },
          { uid: OTHER, name: 'Άλλος', photoUrl: null },
        ],
      },
    },
    busy: false,
    outcome: { kind: 'conflict' },
    change,
  };
}

describe('ActTeamManager — ο επιλογέας είναι ΠΡΑΞΗ, όχι κατάσταση', () => {
  it('🔴 Ο-1 ελεγχόμενος και ΚΕΝΟΣ πριν και μετά την επιλογή — η απορριφθείσα επιλογή δεν μένει ποτέ (μετάλλαξη: `value={undefined}`)', () => {
    const change = jest.fn();
    render(<ActTeamManager control={controlWith(change)} viewerUid={RESPONSIBLE} />);

    const pickers = screen.getAllByTestId('picker');
    expect(pickers).toHaveLength(2);
    for (const picker of pickers) expect(picker).toHaveAttribute('data-value', '');

    // Ο τελευταίος που αποδόθηκε είναι το «Προσθήκη συνεργάτη».
    pickFromLastSelect(OTHER);
    expect(change).toHaveBeenCalledWith('add-collaborator', OTHER);
    for (const picker of screen.getAllByTestId('picker')) {
      expect(picker).toHaveAttribute('data-controlled', 'yes');
      expect(picker).toHaveAttribute('data-value', '');
    }
  });
});
