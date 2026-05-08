/**
 * UserSettings — pure path helpers.
 *
 * Lives in its own module so unit tests can import the helpers without
 * pulling in the repository's Firebase dependency chain (auth-context →
 * firestoreQueryService → firebase/auth, which fails to load in plain Node
 * test environments). The repository re-exports `applySliceToDoc` from here.
 *
 * @module services/user-settings/user-settings-paths
 * @enterprise ADR-XXX (UserSettings SSoT)
 */

import type {
  CursorSettingsSlice,
  DxfSettingsSlice,
  DxfViewerSlicePath,
  RulersGridSettingsSlice,
  SnapSettingsSlice,
  UserSettingsDoc,
} from './user-settings-schema';

export type SliceValueMap = {
  'dxfViewer.cursor': CursorSettingsSlice;
  'dxfViewer.rulersGrid': RulersGridSettingsSlice;
  'dxfViewer.dxfSettings': DxfSettingsSlice;
  'dxfViewer.snap': SnapSettingsSlice;
};

/** Read a slice from the in-memory doc by its `dxfViewer.<key>` path. */
export function getSliceFromDoc<P extends DxfViewerSlicePath>(
  doc: UserSettingsDoc | null,
  path: P,
): SliceValueMap[P] | undefined {
  if (!doc?.dxfViewer) return undefined;
  const segments = path.split('.');
  let cursor: unknown = doc;
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cursor as SliceValueMap[P];
}

/** Immutably merge a slice into the document. Throws on unsupported paths. */
export function applySliceToDoc<P extends DxfViewerSlicePath>(
  doc: UserSettingsDoc,
  path: P,
  value: SliceValueMap[P],
): UserSettingsDoc {
  const segments = path.split('.');
  if (segments.length !== 2 || segments[0] !== 'dxfViewer') {
    throw new Error(`applySliceToDoc: unsupported path "${path}"`);
  }
  const sliceKey = segments[1] as keyof NonNullable<UserSettingsDoc['dxfViewer']>;
  return {
    ...doc,
    dxfViewer: {
      ...(doc.dxfViewer ?? {}),
      [sliceKey]: value,
    },
  };
}
