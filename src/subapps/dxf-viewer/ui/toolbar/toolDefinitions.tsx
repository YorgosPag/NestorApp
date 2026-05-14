'use client';
import type { ToolDefinition } from './types';

export const DXF_TOOL_GROUP_KEYS = {
  SELECTION: 'toolGroups.selection',
  DRAWING: 'toolGroups.drawing',
} as const;

// ADR-345 Fase 8: all drawing tools migrated to Ribbon Home → Draw panel.
export const toolGroups: { name: string; tools: ToolDefinition[] }[] = [];

