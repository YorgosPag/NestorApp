/**
 * ⚓ Ζ65 — **ένας κριτής για κουμπί ΚΑΙ πόρτα**: η λίστα αρχείων δεν υπόσχεται «Διαγραφή» σε record (ADR-916 Φ-Δ.6 · Ο14).
 * @related FilesList.tsx · lib/files/file-hold.ts (`fileTrashBlockOf`) · services/file-record/file-trash.service.ts (Ζ61)
 *
 * Purview: *Delete — Blocked* · το κουμπί που η πόρτα θα αρνιόταν **δεν** εμφανίζεται, και στη θέση της εξήγησης μπαίνει το
 * σήμα (Ζ64). Το αντίτυπο του **αγοραστή** κουβαλά το ίδιο σημάδι αλλά είναι δικό του ⇒ η διαγραφή **μένει**.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | η λίστα δεν ρωτά `fileTrashBlockOf` | record με «Διαγραφή» ⇒ 🔴 |
 * | το σημάδι μετρά και στο προσωπικό διαμέρισμα | αγοραστής χωρίς «Διαγραφή» ⇒ 🔴 |
 */

import React from 'react';
import { render } from '@testing-library/react';

import type { FileRecord } from '@/types/file-record';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/useFileDisplayName', () => ({
  useFileDisplayName: () => (file: { displayName: string }) => file.displayName,
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useUserDisplayNames', () => ({
  useUserDisplayNames: () => new Map<string, string>(),
  seedUserNameCache: () => undefined,
}));
jest.mock('../hooks/useFileListActions', () => ({ useFileListActions: () => ({ handleDeleteClick: jest.fn() }) }));
jest.mock('../hooks/useFileClassification', () => ({
  useFileClassification: () => ({ classifyFile: jest.fn(), classifyingIds: new Set<string>() }),
}));
jest.mock('../FileThumbnail', () => ({ FileThumbnail: () => null }));
jest.mock('@/components/ui/ConfirmDialog', () => ({ DeleteConfirmDialog: () => null }));
jest.mock('@/components/shared/DeletionBlockedDialog', () => ({ DeletionBlockedDialog: () => null }));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

/** Το σύνορο: μετριέται ΑΝ η γραμμή παίρνει «Διαγραφή», όχι πώς ζωγραφίζεται το μενού. */
const rowDelete = new Map<string, boolean>();
jest.mock('../FileRowActions', () => ({
  FileRowActions: (props: { fileName: string; onDelete?: () => void }) => {
    rowDelete.set(props.fileName, props.onDelete !== undefined);
    return null;
  },
}));

import { FilesList } from '../FilesList';

const MARK = { protocolId: 'phpr_1', handoverId: 'phov_1', revision: 1 };
const file = (id: string, extra: Record<string, unknown>) =>
  ({ id, displayName: id, sizeBytes: 10, status: 'ready', createdAt: '2026-10-24T10:00:00.000Z', ...extra }) as unknown as FileRecord;

describe('Ζ65 — «Διαγραφή» στη γραμμή αρχείου: ο ΙΔΙΟΣ κριτής με την πόρτα κάδου', () => {
  it('🔴 record (αντίτυπο εταιρείας) ⇒ ΚΑΜΙΑ «Διαγραφή» · απλό αρχείο και αντίτυπο αγοραστή ⇒ «Διαγραφή»', () => {
    rowDelete.clear();
    render(
      <FilesList
        files={[
          file('company-copy', { companyId: 'comp_1', hold: 'record', handoverProtocolOf: MARK }),
          file('plain', { companyId: 'comp_1' }),
          file('buyer-copy', { userId: 'uid_anna', handoverProtocolOf: MARK }),
        ]}
        onDelete={jest.fn()}
        currentUserId="uid_1"
      />,
    );

    expect(rowDelete.get('company-copy')).toBe(false);
    expect(rowDelete.get('plain')).toBe(true);
    expect(rowDelete.get('buyer-copy')).toBe(true);
  });
});
