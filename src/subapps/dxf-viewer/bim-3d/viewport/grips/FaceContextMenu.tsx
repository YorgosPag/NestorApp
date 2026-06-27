"use client";

/**
 * FaceContextMenu — 3D viewport per-face context menu για το Cinema 4D «Polygon Mode»
 * (ADR-539 Φ3f). Mirror του `Grip3DVertexContextMenu`: ένα 1×1 αόρατο anchor στις
 * συντεταγμένες του δεξιού-κλικ + Radix dropdown. Ο (non-React) pointer handler το ανοίγει
 * μέσω του `FaceContextMenuStore` όταν ο χρήστης κάνει δεξί-κλικ σε όψη (σε Polygon Mode)·
 * αυτός ο leaf σερβίρει τις ενέργειες μέσω του SHARED SSoT `applyFaceAppearance`:
 *   - «Καθαρισμός όψης»     → καθαρίζει το override (επιστροφή σε base look)
 *   - «Αντιγραφή εμφάνισης» → clipboard = η τρέχουσα εμφάνιση της όψης (Φ4 copy/paste hook)
 *   - «Επικόλληση εμφάνισης» → εφαρμόζει το clipboard (disabled όταν άδειο)
 *
 * Όλες περνούν από το global command history (undoable, scene re-sync). ADR-040: leaf
 * React component, μηδέν canvas orchestrator subscription.
 */

import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useFaceContextMenuStore } from '../../stores/FaceContextMenuStore';
import { applyFaceAppearance } from '../../ui/apply-face-appearance';
import { readFaceAppearance } from '../../ui/read-face-appearance';

export function FaceContextMenu() {
  const { t } = useTranslation('bim3d');
  const levels = useLevelsOptional();
  const open = useFaceContextMenuStore((s) => s.open);
  const screen = useFaceContextMenuStore((s) => s.screen);
  const target = useFaceContextMenuStore((s) => s.target);
  const clipboard = useFaceContextMenuStore((s) => s.clipboard);
  const hide = useFaceContextMenuStore((s) => s.hide);
  const setClipboard = useFaceContextMenuStore((s) => s.setClipboard);

  if (!open || !screen || !target) return null;

  const clear = () => {
    applyFaceAppearance(levels, target.bimId, target.faceKey, null);
    hide();
  };
  const copy = () => {
    setClipboard(readFaceAppearance(levels, target.bimId, target.faceKey));
    hide();
  };
  const paste = () => {
    if (clipboard) applyFaceAppearance(levels, target.bimId, target.faceKey, clipboard);
    hide();
  };

  return (
    <DropdownMenu open onOpenChange={(o) => { if (!o) hide(); }}>
      {/* 1×1 invisible anchor positioned at the right-click coordinates */}
      <DropdownMenuTrigger asChild>
        <span
          className="fixed w-px h-px pointer-events-none"
          style={{ left: screen.x, top: screen.y }}
          aria-label={t('polygonMode.contextMenu.aria')}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={0}
        className="z-[200] min-w-[180px]"
        onEscapeKeyDown={hide}
        onPointerDownOutside={hide}
      >
        <DropdownMenuLabel className="text-xs font-semibold">
          {t('polygonMode.contextMenu.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={clear}>{t('polygonMode.contextMenu.clear')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={copy}>{t('polygonMode.contextMenu.copy')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={paste} disabled={!clipboard}>
          {t('polygonMode.contextMenu.paste')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
