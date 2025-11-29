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
import { CommonBadge } from "@/core/badges"
import { quickActions } from "@/constants/header"

export function QuickAddMenu() {
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="relative bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-300 animate-pulse" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Προσθήκη Επαφής</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Νέα Επαφή</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickActions.map((action) => (
            <DropdownMenuItem key={action.label} className="cursor-pointer">
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
              <DropdownMenuShortcut>⌘{action.shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <Upload className="mr-2 h-4 w-4" />
            <span>Εισαγωγή από αρχείο</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Mic className="mr-2 h-4 w-4" />
            <span>Φωνητική εισαγωγή</span>
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
