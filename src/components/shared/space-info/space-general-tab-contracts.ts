/**
 * space-general-tab-contracts — the props every space general tab takes
 *
 * SSoT for the inline-editing contract shared by `ParkingGeneralTab` and
 * `StorageGeneralTab` (and any future space entity). Each tab extends this with
 * its own entity prop — the entity itself is deliberately NOT generic here:
 * ADR-588 keeps the two forms separate rather than unifying their schemas.
 *
 * @module components/shared/space-info/space-general-tab-contracts
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

import type React from 'react';

/** The editing/save contract a space detail tab receives from its parent. */
export interface SpaceGeneralTabProps {
  /** Inline editing active (from parent via globalProps) */
  isEditing?: boolean;
  /** Notify parent when editing state changes */
  onEditingChange?: (editing: boolean) => void;
  /** Ref for save delegation from header button */
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  /** Create mode: POST new entity instead of PATCH existing */
  createMode?: boolean;
  /** Callback when entity is created successfully (create mode only) */
  onCreated?: (id: string) => void;
}
