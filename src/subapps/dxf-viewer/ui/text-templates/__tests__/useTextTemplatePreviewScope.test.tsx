/**
 * ADR-344 Phase 7.D — Sample scope assembly.
 */
import { renderHook } from '@testing-library/react';
import { useTextTemplatePreviewScope } from '../hooks/useTextTemplatePreviewScope';
import { PLACEHOLDER_REGISTRY } from '@/subapps/dxf-viewer/text-engine/templates';

describe('useTextTemplatePreviewScope', () => {
  it('mirrors PLACEHOLDER_REGISTRY samples into a flat scope', () => {
    const { result } = renderHook(() => useTextTemplatePreviewScope('el'));
    expect(result.current.company?.name).toBe(PLACEHOLDER_REGISTRY['company.name'].sample);
    expect(result.current.project?.code).toBe(PLACEHOLDER_REGISTRY['project.code'].sample);
    expect(result.current.drawing?.scale).toBe(PLACEHOLDER_REGISTRY['drawing.scale'].sample);
    expect(result.current.user?.licenseNumber).toBe(PLACEHOLDER_REGISTRY['user.licenseNumber'].sample);
    expect(result.current.revision?.number).toBe(PLACEHOLDER_REGISTRY['revision.number'].sample);
  });

  it('parses the revision.date sample into a Date', () => {
    const { result } = renderHook(() => useTextTemplatePreviewScope('el'));
    expect(result.current.revision?.date).toBeInstanceOf(Date);
  });

  it('honours the locale parameter', () => {
    const { result } = renderHook(() => useTextTemplatePreviewScope('en'));
    expect(result.current.formatting?.locale).toBe('en');
  });
});
