'use client';

/**
 * ADR-676 Phase 3 PILOT — Single frame-profile preset card, list row of
 * {@link FrameProfilesLibraryPanel}. Mirrors the `MaterialCard` sub-component
 * in `MaterialsLibraryPanel.tsx` (article + header/footer, scope badge,
 * click target = rename), adapted for inline rename instead of an editor
 * dialog (this pilot library has no editor — creation happens via the
 * ribbon "Αποθήκευση ως δικό μου" widget).
 *
 * @see ./FrameProfilesLibraryPanel.tsx
 */

import React, { useCallback, useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { handleInlineRenameKey } from '../../utils/inline-rename-keyboard';
import type { OpeningFrameProfilePresetDoc } from '../../../bim/types/opening-frame-profile';

type TFn = (key: string, opts?: Record<string, string>) => string;

export interface FrameProfileCardProps {
  readonly profile: OpeningFrameProfilePresetDoc;
  readonly onRename: (id: string, name: string) => Promise<void>;
  readonly onDelete: (profile: OpeningFrameProfilePresetDoc) => void;
  readonly t: TFn;
  readonly colors: ReturnType<typeof useSemanticColors>;
}

function scopeBadgeClass(scope: string, colors: ReturnType<typeof useSemanticColors>): string {
  switch (scope) {
    case 'user': return `bg-muted ${colors.text.muted}`;
    case 'company': return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case 'project': return `${colors.bg.successSubtle} ${colors.text.success}`;
    default: return `bg-muted ${colors.text.muted}`;
  }
}

function scopeLabelKey(scope: string): string {
  switch (scope) {
    case 'company': return 'panels.frameProfiles.scopeCompany';
    case 'project': return 'panels.frameProfiles.scopeProject';
    default: return 'panels.frameProfiles.scopeUser';
  }
}

export function FrameProfileCard({ profile, onRename, onDelete, t, colors }: FrameProfileCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [pendingName, setPendingName] = useState(profile.name);

  const startRename = useCallback(() => {
    setPendingName(profile.name);
    setRenaming(true);
  }, [profile.name]);

  const cancelRename = useCallback(() => {
    setRenaming(false);
    setPendingName(profile.name);
  }, [profile.name]);

  const confirmRename = useCallback(() => {
    const trimmed = pendingName.trim();
    if (!trimmed || trimmed === profile.name) {
      setRenaming(false);
      return;
    }
    void onRename(profile.id, trimmed);
    setRenaming(false);
  }, [pendingName, profile.id, profile.name, onRename]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) =>
      handleInlineRenameKey(event, { onConfirm: confirmRename, onCancel: cancelRename }),
    [confirmRename, cancelRename],
  );

  if (renaming) {
    return (
      <article className={`flex items-center gap-1 px-2 py-1.5 rounded ${colors.bg.secondary}`}>
        <input
          autoFocus
          type="text"
          value={pendingName}
          onChange={(e) => setPendingName(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={confirmRename}
          aria-label={t('panels.frameProfiles.save')}
          className={`p-1 rounded hover:${colors.bg.hover} ${colors.text.success}`}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={cancelRename}
          aria-label={t('panels.frameProfiles.cancel')}
          className={`p-1 rounded hover:${colors.bg.hover} ${colors.text.muted}`}
        >
          <X size={14} />
        </button>
      </article>
    );
  }

  return (
    <article
      className={`flex flex-col gap-0.5 px-2 py-1.5 rounded ${colors.bg.secondary} hover:${colors.bg.hover} transition-colors`}
      aria-label={profile.name}
    >
      <header className="flex items-center gap-1.5">
        <span className={`text-xs font-medium truncate flex-1 ${colors.text.primary}`}>
          {profile.name}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${scopeBadgeClass(profile.scope, colors)}`}>
          {t(scopeLabelKey(profile.scope))}
        </span>
      </header>
      <footer className="flex items-center gap-2 justify-between">
        <span className={`text-[10px] ${colors.text.muted} truncate`}>
          {profile.manufacturer} · {profile.series} · {profile.faceWidth}×{profile.depth}mm
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={startRename}
            aria-label={t('panels.frameProfiles.rename')}
            className={`p-1 rounded hover:${colors.bg.hover} ${colors.text.muted} hover:${colors.text.primary} transition-colors`}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(profile)}
            aria-label={t('panels.frameProfiles.delete.title')}
            className={`p-1 rounded hover:${colors.bg.hover} ${colors.text.muted} hover:text-destructive transition-colors`}
          >
            <Trash2 size={12} />
          </button>
        </span>
      </footer>
    </article>
  );
}
