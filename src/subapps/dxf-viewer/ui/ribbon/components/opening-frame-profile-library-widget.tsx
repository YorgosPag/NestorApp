'use client';

/**
 * ADR-676 Phase 3 PILOT — Opening Frame Profile user-library ribbon widget.
 *
 * Two entry points into the frame-profile user library, both against the
 * SELECTED opening's currently RESOLVED profile (`resolveOpeningFrameProfile`,
 * ADR-611 SSoT — never re-derived here):
 *   - «Αποθήκευση ως δικό μου» — save the resolved profile as a from-scratch
 *     user library entry (`origin: 'user'`).
 *   - «Αντιγραφή & επεξεργασία» — save it as a `origin: 'derived'` clone,
 *     `derivedFrom` carrying provenance to the source (builtin or user) id.
 *     Mirrors the `FamilyTypeActions` "Duplicate & edit" affordance.
 *
 * Both open the SAME inline name+scope form (mirrors `StairPresetsSection`'s
 * save flow) — default scope 'company' (ADR-676 §4 Q5), Enter/submit=save,
 * Esc=cancel via the centralized Escape Command Bus. Persists through
 * `useOpeningFrameProfileLibrary().save`, which also republishes the merged
 * store the resolver/bridge read from.
 *
 * Self-hides when no opening is selected (no resolvable profile). Chrome
 * (button row / inline form) lives in the sibling `-parts` file — this file
 * owns only state + wiring.
 *
 * @see ./opening-frame-profile-library-widget-parts.tsx — presentational chrome
 * @see ../hooks/useOpeningFrameProfileLibrary.ts — library hook (Wave 1)
 * @see ../../../bim/family-types/resolve-opening-frame-profile.ts — resolver SSoT
 * @see ../../stair-advanced-panel/sections/StairPresetsSection.tsx — mirrored save flow
 * @see ./family-type-properties-parts.tsx — mirrored "Duplicate & edit" affordance
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useOpeningFamilyTypeController } from '../hooks/useOpeningFamilyTypeController';
import { useOpeningFrameProfileLibrary } from '../hooks/useOpeningFrameProfileLibrary';
import { resolveOpeningFrameProfile } from '../../../bim/family-types/resolve-opening-frame-profile';
import type { OpeningFrameProfile } from '../../../bim/types/opening-frame-profile';
import type { SaveFrameProfileInput } from '../../../bim/family-types/opening-frame-profile-library-service';
import {
  OpeningFrameProfileLibraryActions,
  OpeningFrameProfileLibrarySaveForm,
  type FrameProfilePresetScope,
} from './opening-frame-profile-library-widget-parts';

type PendingOrigin = 'user' | 'derived' | null;

export function OpeningFrameProfileLibraryWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();
  const levels = useLevelsOptional();
  const companyId = user?.companyId ?? undefined;
  const userId = user?.uid ?? undefined;
  const projectId = levels?.saveContext?.projectId ?? undefined;

  const { opening, currentType } = useOpeningFamilyTypeController();
  // Mounting the hook here (in addition to `useFrameProfileCatalog`) keeps the
  // user-library store populated whenever this panel is visible, and is the
  // sole source of `save()` for this widget.
  const library = useOpeningFrameProfileLibrary({ companyId, userId, projectId });

  const [pendingOrigin, setPendingOrigin] = useState<PendingOrigin>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingScope, setPendingScope] = useState<FrameProfilePresetScope>('company');

  const resolved = useMemo(() => {
    if (!opening) return null;
    return resolveOpeningFrameProfile(opening.params, currentType?.typeParams ?? null);
  }, [opening, currentType]);

  const closeForm = useCallback(() => {
    setPendingOrigin(null);
    setPendingName('');
    setPendingScope('company');
  }, []);

  // ADR-364: Esc cancels the inline form via the centralized Escape Command Bus.
  useEscapeHandler({
    id: 'opening-frame-profile-library-save',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => pendingOrigin !== null,
    handle: () => {
      closeForm();
      return true;
    },
  });

  const openSaveAsMine = useCallback(() => {
    setPendingOrigin('user');
    setPendingName('');
    setPendingScope('company');
  }, []);

  const openDuplicateAndEdit = useCallback(() => {
    if (!resolved) return;
    const base = `${resolved.manufacturer} ${resolved.series}`.trim() || resolved.id;
    setPendingOrigin('derived');
    setPendingName(`${base} (copy)`);
    setPendingScope('company');
  }, [resolved]);

  const onSaveConfirm = useCallback(async () => {
    if (!resolved || !pendingOrigin) return;
    const name = pendingName.trim();
    if (!name) return;
    if (pendingScope === 'project' && !projectId) return;

    const profile: Omit<OpeningFrameProfile, 'id'> = {
      manufacturer: resolved.manufacturer,
      series: resolved.series,
      role: 'frame',
      faceWidth: resolved.faceWidth,
      depth: resolved.depth,
    };
    const input: SaveFrameProfileInput = {
      name,
      scope: pendingScope,
      origin: pendingOrigin,
      profile,
      ...(pendingOrigin === 'derived' ? { derivedFrom: resolved.id } : {}),
    };
    await library.save(input).catch(() => {
      /* error surfaced via hook state */
    });
    closeForm();
  }, [resolved, pendingOrigin, pendingName, pendingScope, projectId, library, closeForm]);

  const onNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void onSaveConfirm();
      }
    },
    [onSaveConfirm],
  );

  if (!opening || !resolved) return null;

  return (
    <section
      aria-label={t('ribbon.commands.openingEditor.frameProfile.saveAsMine')}
      className="dxf-ribbon-combobox-row flex-col items-start gap-1"
    >
      {pendingOrigin === null ? (
        <OpeningFrameProfileLibraryActions
          onSaveAsMine={openSaveAsMine}
          onDuplicateAndEdit={openDuplicateAndEdit}
        />
      ) : (
        <OpeningFrameProfileLibrarySaveForm
          name={pendingName}
          onNameChange={setPendingName}
          onNameKeyDown={onNameKeyDown}
          scope={pendingScope}
          onScopeChange={setPendingScope}
          projectAvailable={Boolean(projectId)}
          onSubmit={(event) => {
            event.preventDefault();
            void onSaveConfirm();
          }}
          onCancel={closeForm}
        />
      )}
    </section>
  );
}
