"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Zap } from "lucide-react"
import { useIconSizes } from '@/hooks/useIconSizes';

export function AIAssistantButton() {
  const iconSizes = useIconSizes();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Zap className={iconSizes.sm} />
            <span className={`absolute -top-1 -right-1 flex ${iconSizes.xs}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className={`relative inline-flex rounded-full ${iconSizes.xs} bg-purple-500`} />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI Assistant</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
