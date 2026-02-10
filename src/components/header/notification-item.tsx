"use client"

import type { Notification } from "@/types/header"
import { useIconSizes } from '@/hooks/useIconSizes'
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects/hover-effects'

interface NotificationItemProps {
  notification: Notification
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const iconSizes = useIconSizes();
  const getAvatarFallback = (name: string) => {
    const parts = name.split(" ")
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${HOVER_BACKGROUND_EFFECTS.MUTED}`}>
      <div
        className={`${iconSizes.xl2} rounded-full flex items-center justify-center mt-1 ${notification.color}`}
      >
        <notification.icon
          className={`${iconSizes.sm} ${notification.textColor}`}
        />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="text-xs text-muted-foreground">
          {notification.description}
        </p>
      </div>
    </div>
  )
}
