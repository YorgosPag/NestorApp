/**
 * Α38.1δ — ADR-866 §2.10 Β1: η ζώνη ανεβάσματος **λέει την αλήθεια** για το τι δέχεται η καρτέλα.
 *
 * 🔴 Ζωντανή επαλήθευση 2026-09-19: «↑ Επιλέξτε πρώτα τον τύπο του εγγράφου» πάνω από **κενό** επιλογέα (ο
 * `UploadEntryPointSelector` επέστρεφε `null`) — αδιέξοδο χωρίς εξήγηση. Τώρα: μηδέν τύποι ⇒ ρητό μήνυμα· τύποι ⇒ ο
 * επιλογέας τους δείχνει. Ο κατάλογος και ο επιλογέας τρέχουν **αληθινά**· κόβονται μόνο τα βαριά παιδιά της λίστας.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/components/file-manager/FilePreviewPanel', () => ({ FilePreviewPanel: () => null }));
jest.mock('@/components/file-manager/BatchActionsBar', () => ({ BatchActionsBar: () => null }));
jest.mock('../FileThumbnail', () => ({ FileThumbnail: () => null }));
jest.mock('../FilesList', () => ({ FilesList: () => null }));
jest.mock('../GroupedFilesList', () => ({ GroupedFilesList: () => null }));
jest.mock('../GroupedFilesByDomainCategoryList', () => ({ GroupedFilesByDomainCategoryList: () => null }));
jest.mock('../FilePathTree', () => ({ FilePathTree: () => null }));
jest.mock('../FileUploadZone', () => ({ FileUploadZone: () => null }));
jest.mock('../TrashView', () => ({ TrashView: () => null }));
jest.mock('../ArchiveView', () => ({ ArchiveView: () => null }));
jest.mock('../media', () => ({ MediaGallery: () => null }));
jest.mock('../media/FloorplanGallery', () => ({ FloorplanGallery: () => null }));
jest.mock('../HierarchicalEntryPointSelector', () => ({ HierarchicalEntryPointSelector: () => null }));

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { EntityType } from '@/config/domain-constants';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EntityFilesContent, type EntityFilesContentProps } from '../EntityFilesContent';

function renderZone(entityType: EntityType, allowedEntryPointIds?: string[]) {
  const noop = jest.fn();
  const props = {
    activeTab: 'files', isFullscreen: false, showUploadZone: true, onCloseUploadZone: noop,
    selectedEntryPoint: null, onSelectEntryPoint: noop, customTitle: '', onCustomTitleChange: noop,
    entityType, allowedEntryPointIds, onUpload: jest.fn(), acceptedTypes: '*', maxFileSize: 1, uploading: false,
    files: [], filteredFiles: [], loading: false, error: null, searchTerm: '', onSearchTermChange: noop,
    viewMode: 'gallery', treeViewMode: 'business', displayStyle: 'media-gallery',
    onDelete: jest.fn(), onRename: noop, onDescriptionUpdate: noop, onView: noop, onDownload: jest.fn(),
    onUnlink: jest.fn(), enableBuildingLink: false, currentUserId: 'uid', selectedIds: new Set<string>(),
    toggleSelect: noop, selectedFile: null,
  } as unknown as EntityFilesContentProps;
  render(<TooltipProvider><EntityFilesContent {...props} /></TooltipProvider>);
}

describe('Α38.1δ — ζώνη ανεβάσματος: τύποι ή ρητό «δεν δέχεται»', () => {
  it('καρτέλα χωρίς τύπους ⇒ ρητό μήνυμα, ΟΧΙ «επιλέξτε πρώτα τύπο»', () => {
    renderZone('property_dossier', ['δεν-υπάρχει']);
    expect(screen.getByText('manager.noDocumentTypes')).toBeTruthy();
    expect(screen.queryByText('manager.selectDocumentType')).toBeNull();
  });

  it('φωτογραφίες φακέλου ⇒ ο επιλογέας δείχνει τους τύπους της όψης', () => {
    renderZone('property_dossier', ['unit-interior-photo', 'unit-exterior-photo']);
    expect(screen.getByText('manager.selectDocumentType')).toBeTruthy();
    expect(screen.getAllByRole('radio').length).toBe(2);
  });
});
