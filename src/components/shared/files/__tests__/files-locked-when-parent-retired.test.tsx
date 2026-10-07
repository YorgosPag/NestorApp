/**
 * ⚓ Ο διαχειριστής αρχείων σε **αποσυρμένη** μητρική εγγραφή (ADR-329 §3.9): προβολή, λήψη, αναζήτηση —
 * και **καμία** πράξη γραφής. Τα φύλλα **ρωτούν** `useRetiredKind()`· ο `EntityFilesManager` δεν περνά τίποτα.
 *
 * Τρία σημεία, ένα ανά φύλλο που ρωτά:
 *   Φ1 — `EntityFilesContent`: οι χειριστές γραφής ΔΕΝ φτάνουν στη λίστα (χειριστής που λείπει ⇒ κανένα κουμπί)
 *   Φ2 — `EntityFilesToolbar`: το μενού «Προσθήκη / Λήψη» δεν ζωγραφίζεται
 *   Φ3 — `LifecycleFileRow`: η γραμμή κάδου/αρχείου αρχείων μένει, η επαναφορά όχι
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `const props = rawProps` στο `EntityFilesContent` | Φ1 ⇒ 🔴 |
 * | `canAdd = true` στο `EntityFilesToolbar` | Φ2 ⇒ 🔴 |
 * | `canReinstate = true` στο `LifecycleFileRow` | Φ3 ⇒ 🔴 |
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Trash2 } from 'lucide-react';

import { RetiredRecordProvider } from '@/lib/firestore/retired-record-context';
import type { FileRecord } from '@/types/file-record';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: null }) }));
jest.mock('@/hooks/notifications/useFilesNotifications', () => ({ useFilesNotifications: () => ({}) }));
jest.mock('@/hooks/useFileDisplayName', () => ({
  useFileDisplayName: () => (file: FileRecord) => file.displayName,
}));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

// Τα παιδιά του περιεχομένου είναι σύνορα: εδώ μετριέται ΤΙ τους δίνεται, όχι πώς ζωγραφίζουν.
const listProps = jest.fn<void, [Record<string, unknown>]>();
jest.mock('../FilesList', () => ({
  FilesList: (props: Record<string, unknown>) => { listProps(props); return null; },
}));
jest.mock('../GroupedFilesList', () => ({ GroupedFilesList: () => null }));
jest.mock('../GroupedFilesByDomainCategoryList', () => ({ GroupedFilesByDomainCategoryList: () => null }));
jest.mock('../FilePathTree', () => ({ FilePathTree: () => null }));
jest.mock('../FileUploadZone', () => ({ FileUploadZone: () => <div data-testid="upload-zone" /> }));
jest.mock('../UploadEntryPointSelector', () => ({ UploadEntryPointSelector: () => <div data-testid="upload-zone" /> }));
jest.mock('../HierarchicalEntryPointSelector', () => ({ HierarchicalEntryPointSelector: () => <div data-testid="upload-zone" /> }));
jest.mock('../TrashView', () => ({ TrashView: () => null }));
jest.mock('../ArchiveView', () => ({ ArchiveView: () => null }));
jest.mock('../media', () => ({ MediaGallery: () => null }));
jest.mock('../media/FloorplanGallery', () => ({ FloorplanGallery: () => null }));
jest.mock('../FileTileSummary', () => ({ FileTileSummary: () => null }));
jest.mock('@/components/file-manager/FilePreviewPanel', () => ({ FilePreviewPanel: () => null }));
jest.mock('@/components/file-manager/BatchActionsBar', () => ({ BatchActionsBar: () => null }));
jest.mock('@/components/ui/search', () => ({ SearchInput: () => null }));
jest.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ResizableHandle: () => null,
}));
jest.mock('../AddCaptureMenu', () => ({ AddCaptureMenu: () => <div data-testid="add-capture-menu" /> }));

import { EntityFilesContent, type EntityFilesContentProps } from '../EntityFilesContent';
import { EntityFilesToolbar } from '../EntityFilesToolbar';
import { LifecycleFileRow } from '../LifecycleListFrame';

const WRITE_HANDLERS = ['onDelete', 'onRename', 'onDescriptionUpdate', 'onUnlink', 'onToggleSelect', 'onClassified'] as const;

const FILE = { id: 'file_1', displayName: 'Συμβόλαιο.pdf', sizeBytes: 10 } as unknown as FileRecord;

function contentProps(): EntityFilesContentProps {
  return {
    activeTab: 'files',
    isFullscreen: false,
    showUploadZone: true,
    onCloseUploadZone: jest.fn(),
    selectedEntryPoint: null,
    onSelectEntryPoint: jest.fn(),
    customTitle: '',
    onCustomTitleChange: jest.fn(),
    // `contact`: χωρίς ομάδες μελετών ⇒ η επίπεδη `FilesList`, το ένα παιδί που μετριέται εδώ.
    entityType: 'contact',
    onUpload: jest.fn(),
    acceptedTypes: '*',
    maxFileSize: 1,
    uploading: false,
    files: [],
    filteredFiles: [],
    loading: false,
    error: null,
    searchTerm: '',
    onSearchTermChange: jest.fn(),
    viewMode: 'list',
    treeViewMode: 'business',
    displayStyle: 'standard',
    onDelete: jest.fn(),
    onRename: jest.fn(),
    onDescriptionUpdate: jest.fn(),
    onView: jest.fn(),
    onDownload: jest.fn(),
    onUnlink: jest.fn(),
    enableBuildingLink: false,
    currentUserId: 'uid_1',
    selectedIds: new Set<string>(),
    toggleSelect: jest.fn(),
    selectedFile: null,
    onSelectFile: jest.fn(),
    batchActions: {
      selectAll: jest.fn(),
      clearSelection: jest.fn(),
      onBatchDelete: jest.fn(),
      onBatchDownload: jest.fn(),
      aiClassifying: false,
    },
    totalStorageBytes: 0,
    custody: { companyId: 'comp_1' },
    entityId: 'ent_1',
    onRestore: jest.fn(),
    onUnarchive: jest.fn(),
    onClassified: jest.fn(),
  };
}

const under = (status: string, node: React.ReactNode) =>
  render(<RetiredRecordProvider record={{ status }}>{node}</RetiredRecordProvider>);

const lastListProps = () => listProps.mock.calls[listProps.mock.calls.length - 1][0];

beforeEach(() => listProps.mockReset());

describe('Φ1 — EntityFilesContent', () => {
  it.each(['archived', 'deleted'])('🔴 `%s` ⇒ ΚΑΝΕΝΑΣ χειριστής γραφής δεν φτάνει στη λίστα, και η ζώνη ανεβάσματος δεν ανοίγει', (status) => {
    under(status, <EntityFilesContent {...contentProps()} />);

    for (const handler of WRITE_HANDLERS) expect(lastListProps()[handler]).toBeUndefined();
    expect(screen.queryByTestId('upload-zone')).toBeNull();
  });

  it('🔴 προβολή και λήψη ΜΕΝΟΥΝ — το κλείδωμα δεν είναι τύφλωση', () => {
    under('archived', <EntityFilesContent {...contentProps()} />);

    expect(lastListProps().onView).toEqual(expect.any(Function));
    expect(lastListProps().onDownload).toEqual(expect.any(Function));
  });

  it('✅ ζωντανή μητρική εγγραφή ⇒ όλοι οι χειριστές φτάνουν, και η ζώνη ανοίγει', () => {
    under('active', <EntityFilesContent {...contentProps()} />);

    for (const handler of WRITE_HANDLERS) expect(lastListProps()[handler]).toEqual(expect.any(Function));
    expect(screen.getAllByTestId('upload-zone').length).toBeGreaterThan(0);
  });
});

describe('Φ2 — EntityFilesToolbar', () => {
  const toolbar = (
    <EntityFilesToolbar
      activeTab="files"
      onTabChange={() => undefined}
      viewMode="list"
      onViewModeChange={() => undefined}
      treeViewMode="business"
      onTreeViewModeChange={() => undefined}
      displayStyle="standard"
      category="photos"
      onOpenUploadZone={() => undefined}
      onCapture={async () => undefined}
      uploading={false}
      loading={false}
      onRefresh={() => undefined}
      fullscreen={{ isFullscreen: false, toggle: () => undefined }}
      fileCount={0}
      showWorkspace={false}
    />
  );

  it('🔴 αποσυρμένη ⇒ το μενού «Προσθήκη / Λήψη» δεν ζωγραφίζεται· οι όψεις μένουν', () => {
    under('archived', toolbar);

    expect(screen.queryByTestId('add-capture-menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'manager.viewList' })).toBeInTheDocument();
  });

  it('✅ ζωντανή ⇒ το μενού υπάρχει', () => {
    under('active', toolbar);

    expect(screen.getByTestId('add-capture-menu')).toBeInTheDocument();
  });
});

describe('Φ3 — LifecycleFileRow (κάδος και αρχείο ΑΡΧΕΙΩΝ)', () => {
  const row = (
    <LifecycleFileRow
      file={FILE}
      icon={Trash2}
      tone="destructive"
      dateText="—"
      actionLabel="restore-file"
      actionText="restore"
      onAction={jest.fn()}
    />
  );

  it('🔴 αποσυρμένη ⇒ η γραμμή φαίνεται, η επαναφορά αρχείου ΟΧΙ', () => {
    under('deleted', row);

    expect(screen.getByText('Συμβόλαιο.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'restore-file' })).toBeNull();
  });

  it('✅ ζωντανή ⇒ η επαναφορά προσφέρεται', () => {
    under('active', row);

    expect(screen.getByRole('button', { name: 'restore-file' })).toBeInTheDocument();
  });
});
