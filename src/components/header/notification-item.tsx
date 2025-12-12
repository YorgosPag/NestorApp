"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Notification } from "@/types/header"
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects/hover-effects'

interface NotificationItemProps {
  notification: Notification
}

export function NotificationItem({ notification }: NotificationItemProps) {
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
        className={`h-8 w-8 rounded-full flex items-center justify-center mt-1 ${notification.color}`}
      >
        <notification.icon
          className={`h-4 w-4 ${notification.textColor}`}
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
