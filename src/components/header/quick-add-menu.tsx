"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles, Upload, Mic } from "lucide-react"
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects'
import { CommonBadge } from "@/core/badges"
import { quickActions } from "@/constants/header"
import { useIconSizes } from '@/hooks/useIconSizes'
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function QuickAddMenu() {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className={`relative text-white shadow-lg ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON}`}
              >
                <Plus className={iconSizes.sm} />
                <Sparkles className={`absolute -top-1 -right-1 ${iconSizes.xs} text-yellow-300 animate-pulse`} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('quickAdd.tooltip')}</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('quickAdd.menuTitle')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickActions.map((action) => (
            <DropdownMenuItem key={action.label} className="cursor-pointer">
              <action.icon className={`mr-2 ${iconSizes.sm}`} />
              <span>{action.label}</span>
              <DropdownMenuShortcut>⌘{action.shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <Upload className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('quickAdd.importFromFile')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Mic className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('quickAdd.voiceInput')}</span>
            <CommonBadge
              status="company"
              customLabel="AI"
              variant="secondary"
              className="ml-auto text-xs"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
