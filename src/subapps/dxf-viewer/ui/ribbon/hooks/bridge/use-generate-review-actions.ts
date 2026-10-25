/**
 * The Generate → review → accept action dispatch shared by every auto-design ribbon bridge
 * (`create-ribbon-mep-auto-bridge` · `create-electrical-auto-bridge`): routes the bridge's three
 * owned action keys to their handlers and no-ops on every other key, so the bridges compose in
 * `useRibbonCommands`. Returns a stable `{ onAction }` (re-created only when a handler changes).
 */

import { useCallback, useMemo } from 'react';

export interface GenerateReviewActionKeys {
  readonly generate: string;
  readonly accept: string;
  readonly reject: string;
}

export interface GenerateReviewHandlers {
  readonly onGenerate: () => void;
  readonly onAccept: () => void;
  readonly onReject: () => void;
}

export function useGenerateReviewActions(
  actions: GenerateReviewActionKeys,
  { onGenerate, onAccept, onReject }: GenerateReviewHandlers,
): { readonly onAction: (action: string) => void } {
  const onAction = useCallback(
    (action: string): void => {
      if (action === actions.generate) return onGenerate();
      if (action === actions.accept) return onAccept();
      if (action === actions.reject) return onReject();
    },
    [actions, onGenerate, onAccept, onReject],
  );
  return useMemo(() => ({ onAction }), [onAction]);
}
