/**
 * ADR-914 §2.20 — ο επιλογέας «Από την αποθήκη» σέβεται το επίπεδο που διάλεξε ο άνθρωπος.
 *
 * Το περιστατικό (παραγωγή, 2026-10-13): επίπεδο «1ος Όροφος» μιας μεζονέτας ⇒ η λίστα έδειχνε
 * και την κάτοψη του 2ου ορόφου. Ο επιλογέας δεν διάβαζε καθόλου το `levelFloorId`.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StepStoragePicker } from '../StepStoragePicker';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: '' }, bg: { surface: '' } }),
}));

jest.mock('@/hooks/useFloorplanFiles', () => ({
  useFloorplanFiles: () => ({
    loading: false,
    files: [
      { id: 'f_lower', originalFilename: 'lower.dxf', levelFloorId: 'flr_1' },
      { id: 'f_upper', originalFilename: 'upper.dxf', levelFloorId: 'flr_2' },
    ],
  }),
}));

const config: FloorplanUploadConfig = {
  companyId: 'co_test',
  domain: FILE_DOMAINS.CONSTRUCTION,
  category: FILE_CATEGORIES.FLOORPLANS,
  userId: 'usr_test',
  entityType: ENTITY_TYPES.PROPERTY,
  entityId: 'prop_maisonette',
};

const renderPicker = (uploadConfig: FloorplanUploadConfig) =>
  render(<StepStoragePicker uploadConfig={uploadConfig} selectedFileId={null} onFileSelected={jest.fn()} />);

describe('StepStoragePicker — επίπεδο πολυεπίπεδης μονάδας', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: επίπεδο 1ου ορόφου ⇒ μόνο η δική του κάτοψη', () => {
    renderPicker({ ...config, levelFloorId: 'flr_1' });

    expect(screen.getByText('lower.dxf')).toBeTruthy();
    expect(screen.queryByText('upper.dxf')).toBeNull();
  });

  it('χωρίς επίπεδο ⇒ όλες οι κατόψεις του ακινήτου', () => {
    renderPicker(config);

    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
