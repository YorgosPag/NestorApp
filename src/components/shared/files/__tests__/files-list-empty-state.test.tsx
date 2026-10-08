/**
 * ⚓ Η κενή κατάσταση της λίστας αρχείων δεν υπόσχεται κουμπί που δεν υπάρχει (ADR-329 §3.9 · εύρημα Ν1).
 *
 * 🔴 Μετρημένο ζωντανά 2026-10-08: σε **αποσυρμένο** ακίνητο η καρτέλα «Έγγραφα» έγραφε «Προσθέστε αρχεία
 * χρησιμοποιώντας το κουμπί Προσθήκη Αρχείων» — ενώ το `EntityFilesToolbar` **δεν ζωγραφίζει** το κουμπί
 * (Φ2 του `files-locked-when-parent-retired.test.tsx`). Η λίστα **ρωτά** ήδη `useRetiredKind()` για την
 * επανάληψη ταξινόμησης· η κενή κατάσταση δεν ρωτούσε.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | η κενή κατάσταση γράφει πάντα `list.noFilesDescription` | Κ1 ⇒ 🔴 |
 * | η κενή κατάσταση γράφει πάντα `list.noFiles` | Κ2 ⇒ 🔴 |
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { RetiredRecordProvider } from '@/lib/firestore/retired-record-context';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/useFileDisplayName', () => ({ useFileDisplayName: () => () => '' }));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useUserDisplayNames', () => ({
  useUserDisplayNames: () => new Map<string, string>(),
  seedUserNameCache: () => undefined,
}));
jest.mock('../hooks/useFileListActions', () => ({ useFileListActions: () => ({}) }));
jest.mock('../hooks/useFileClassification', () => ({
  useFileClassification: () => ({ classifyFile: jest.fn(), classifyingIds: new Set<string>() }),
}));
jest.mock('../FileThumbnail', () => ({ FileThumbnail: () => null }));
jest.mock('@/components/ui/ConfirmDialog', () => ({ DeleteConfirmDialog: () => null }));
jest.mock('@/components/shared/DeletionBlockedDialog', () => ({ DeletionBlockedDialog: () => null }));

import { FilesList } from '../FilesList';

const PROMPT = 'list.noFilesDescription';
const PLAIN = 'list.noFiles';

const emptyListUnder = (status: string) =>
  render(
    <RetiredRecordProvider record={{ status }}>
      <FilesList files={[]} />
    </RetiredRecordProvider>,
  );

describe('κενή λίστα αρχείων — η προτροπή ακολουθεί το αν υπάρχει κουμπί', () => {
  it.each(['archived', 'deleted'])('🔴 Κ1 — `%s`: καμία προτροπή προς κουμπί που δεν ζωγραφίζεται', (status) => {
    emptyListUnder(status);

    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(screen.getByText(PLAIN)).toBeInTheDocument();
  });

  it('✅ Κ2 — ζωντανή μητρική εγγραφή: η προτροπή μένει (το κουμπί υπάρχει)', () => {
    emptyListUnder('active');

    expect(screen.getByText(PROMPT)).toBeInTheDocument();
  });

  it('✅ Κ2′ — χωρίς πάροχο (λίστα εκτός καρτέλας εγγραφής): η προτροπή μένει', () => {
    render(<FilesList files={[]} />);

    expect(screen.getByText(PROMPT)).toBeInTheDocument();
  });
});
