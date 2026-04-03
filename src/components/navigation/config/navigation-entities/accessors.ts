import type { LucideIcon } from 'lucide-react';
import { NAVIGATION_ACTIONS } from './action-config';
import { NAVIGATION_ENTITIES } from './entity-config';
import type {
  NavigationActionConfig,
  NavigationActionType,
  NavigationEntityConfig,
  NavigationEntityType,
} from './types';

export function getEntityConfig(entityType: NavigationEntityType): NavigationEntityConfig {
  return NAVIGATION_ENTITIES[entityType];
}

export function getEntityIcon(entityType: NavigationEntityType): LucideIcon {
  return NAVIGATION_ENTITIES[entityType].icon;
}

export function getEntityColor(entityType: NavigationEntityType): string {
  return NAVIGATION_ENTITIES[entityType].color;
}

export function getEntityLabel(entityType: NavigationEntityType): string {
  return NAVIGATION_ENTITIES[entityType].label;
}

export function getEntityPluralLabel(entityType: NavigationEntityType): string {
  return NAVIGATION_ENTITIES[entityType].pluralLabel;
}

export function isNavigationEntityType(value: string): value is NavigationEntityType {
  return value in NAVIGATION_ENTITIES;
}

export function getActionConfig(actionType: NavigationActionType): NavigationActionConfig {
  return NAVIGATION_ACTIONS[actionType];
}

export function getActionIcon(actionType: NavigationActionType): LucideIcon {
  return NAVIGATION_ACTIONS[actionType].icon;
}

export function getActionColor(actionType: NavigationActionType): string {
  return NAVIGATION_ACTIONS[actionType].color;
}

export function getActionLabel(actionType: NavigationActionType): string {
  return NAVIGATION_ACTIONS[actionType].label;
}

export function isNavigationActionType(value: string): value is NavigationActionType {
  return value in NAVIGATION_ACTIONS;
}
