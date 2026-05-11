'use client';

/**
 * ADR-344 Phase 6.D — Document version selector.
 *
 * Reads `$ACADVER` from the active scene model and maps it to the
 * canonical `DxfDocumentVersion` enum. Defaults to R2018 (the most
 * permissive supported version) when the scene has no version tag or
 * the value is unrecognized — matches the prior Phase 5 stub default
 * so feature gates do not regress when version data is missing.
 */

import { useMemo } from 'react';
import {
  DxfDocumentVersion,
  parseDocumentVersion,
} from '../../../text-engine/types';
import { useCurrentSceneModel } from './useCurrentSceneModel';

export function useTextPanelDocumentVersion(): DxfDocumentVersion {
  const scene = useCurrentSceneModel();
  return useMemo(() => {
    if (!scene?.version) return DxfDocumentVersion.R2018;
    return parseDocumentVersion(scene.version) ?? DxfDocumentVersion.R2018;
  }, [scene]);
}
