"use client";

import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ViewCubeContextMenuProps {
  readonly anchor: { x: number; y: number } | null;
  readonly compassVisible: boolean;
  readonly onToggleCompass: () => void;
  readonly onClose: () => void;
}

export function ViewCubeContextMenu({
  anchor, compassVisible, onToggleCompass, onClose,
}: ViewCubeContextMenuProps) {
  const { t } = useTranslation('bim3d');

  if (!anchor) return null;

  return (
    <DropdownMenu open onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* 1×1 invisible anchor positioned at right-click coordinates */}
      <DropdownMenuTrigger asChild>
        <span
          className="fixed w-px h-px pointer-events-none"
          style={{ left: anchor.x, top: anchor.y }}
          aria-label={t('viewCube.contextMenu.aria')}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={0}
        className="z-[200] min-w-[160px]"
        onEscapeKeyDown={onClose}
        onPointerDownOutside={onClose}
      >
        <DropdownMenuLabel className="text-xs font-semibold">
          {t('viewCube.contextMenu.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={compassVisible}
          onCheckedChange={onToggleCompass}
        >
          {t('viewCube.contextMenu.showCompass')}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
