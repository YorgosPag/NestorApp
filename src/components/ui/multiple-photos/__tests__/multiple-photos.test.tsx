import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { MultiplePhotosCompact } from '../../MultiplePhotosCompact';
import { MultiplePhotosFull } from '../../MultiplePhotosFull';
import type { PhotoSlot } from '../photo-slot-types';

// ---------------------------------------------------------------------------
// Mocks — απομονώνουμε το layout wiring (slot count / drop zone / profile
// selector / upload-complete callback) από το heavy EnterprisePhotoUpload core
// και τα design-system primitives. (ADR-596)
// ---------------------------------------------------------------------------

jest.mock('../../EnterprisePhotoUpload', () => ({
  // Κάθε cell εκθέτει τον index + ένα κουμπί που πυροδοτεί onUploadComplete,
  // ώστε να ελέγξουμε ότι το buildCellProps() wiring καταλήγει στο onPhotosChange.
  EnterprisePhotoUpload: (props: {
    photoIndex?: number;
    onUploadComplete?: (r: { success: boolean; url?: string }) => void;
  }) => (
    <div data-testid="cell" data-photo-index={props.photoIndex}>
      <button
        type="button"
        data-testid={`complete-${props.photoIndex}`}
        onClick={() => props.onUploadComplete?.({ success: true, url: 'http://new' })}
      />
    </div>
  ),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useCompanyId', () => ({
  useCompanyId: () => ({ companyId: 'co-1' }),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u-1' } }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4', xl: 'h-8 w-8', lg: 'h-6 w-6', xs: 'h-3 w-3' }),
}));

jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({ quick: { rounded: 'rounded', input: 'input' } }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ bg: { muted: 'bg-muted' }, text: { warning: 'text-warn' } }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

jest.mock('@/components/ui/effects', () => ({
  TRANSITION_PRESETS: { STANDARD_COLORS: 'trans' },
}));

jest.mock('@/styles/design-tokens', () => ({
  layoutUtilities: { dxf: { colors: { backgroundColor: () => ({}) } } },
}));

jest.mock('@/components/generic/config/photo-config', () => ({
  PHOTO_TEXT_COLORS: { MUTED: 'muted', LIGHT_MUTED: 'lmuted', MEDIUM: 'medium' },
  PHOTO_COLORS: { EMPTY_STATE_BACKGROUND: 'bg' },
  PHOTO_BORDERS: { EMPTY_STATE: 'border', EMPTY_HOVER: 'hover' },
  PHOTO_LAYOUTS: { INDIVIDUAL_GRID: { container: 'grid' } },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/config/file-upload-config', () => ({
  FILE_TYPE_CONFIG: { image: { maxSize: 5_000_000 } },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const filled = (url: string): PhotoSlot => ({ file: null, uploadUrl: url });
const empty = (): PhotoSlot => ({ file: null });

function slots(filledCount: number, max: number): PhotoSlot[] {
  return Array.from({ length: max }, (_, i) => (i < filledCount ? filled(`u${i}`) : empty()));
}

const noop = () => undefined;
const identityCacheBuster = (u: string | undefined) => u;

const baseProps = (max: number, photos: PhotoSlot[]) => ({
  normalizedPhotos: photos,
  maxPhotos: max,
  photosKey: 0,
  addCacheBuster: identityCacheBuster,
  onPhotosChange: noop,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MultiplePhotosCompact (ADR-596)', () => {
  it('renders one cell per slot and the bulk drop zone', () => {
    render(<MultiplePhotosCompact {...baseProps(5, slots(2, 5))} />);
    expect(screen.getAllByTestId('cell')).toHaveLength(5);
    expect(
      screen.getByRole('button', { name: 'photos.management.addMorePhotos' })
    ).toBeInTheDocument();
  });

  it('shows only filled slots when disabled without showPhotosWhenDisabled', () => {
    render(<MultiplePhotosCompact {...baseProps(5, slots(2, 5))} disabled />);
    expect(screen.getAllByTestId('cell')).toHaveLength(2);
  });

  it('renders the profile selector when enabled and slots remain', () => {
    render(
      <MultiplePhotosCompact
        {...baseProps(5, slots(1, 5))}
        showProfileSelector
      />
    );
    expect(screen.getByText('photos.management.profileSelection')).toBeInTheDocument();
  });
});

describe('MultiplePhotosFull (ADR-596)', () => {
  it('renders one cell per slot and the detailed upload zone', () => {
    render(<MultiplePhotosFull {...baseProps(5, slots(1, 5))} />);
    expect(screen.getAllByTestId('cell')).toHaveLength(5);
    expect(screen.getByText('upload.dragDropPhotos')).toBeInTheDocument();
  });

  it('renders placeholders (only filled cells) when disabled', () => {
    render(<MultiplePhotosFull {...baseProps(5, slots(1, 5))} disabled />);
    // 1 real cell (mocked EnterprisePhotoUpload); the other 4 are inert placeholders
    expect(screen.getAllByTestId('cell')).toHaveLength(1);
  });
});

describe('shared upload-state wiring (usePhotoSlotState)', () => {
  it('routes onUploadComplete through buildUploadedSlot to onPhotosChange', () => {
    const onPhotosChange = jest.fn();
    render(
      <MultiplePhotosFull
        {...baseProps(2, [empty(), empty()])}
        onPhotosChange={onPhotosChange}
      />
    );
    fireEvent.click(screen.getByTestId('complete-0'));
    expect(onPhotosChange).toHaveBeenCalledTimes(1);
    const updated = onPhotosChange.mock.calls[0][0] as PhotoSlot[];
    expect(updated).toHaveLength(2);
    expect(updated[0].uploadUrl).toBe('http://new');
    expect(updated[0].uploadProgress).toBe(100);
  });

  it('prefers handleUploadComplete when provided (no onPhotosChange call)', () => {
    const onPhotosChange = jest.fn();
    const handleUploadComplete = jest.fn();
    render(
      <MultiplePhotosFull
        {...baseProps(2, [empty(), empty()])}
        onPhotosChange={onPhotosChange}
        handleUploadComplete={handleUploadComplete}
      />
    );
    fireEvent.click(screen.getByTestId('complete-1'));
    expect(handleUploadComplete).toHaveBeenCalledWith(1, { success: true, url: 'http://new' });
    expect(onPhotosChange).not.toHaveBeenCalled();
  });
});
