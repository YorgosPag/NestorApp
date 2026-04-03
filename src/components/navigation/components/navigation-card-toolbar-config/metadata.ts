import React from 'react';
import { NAVIGATION_ACTIONS, NAVIGATION_ENTITIES } from '../../config';
import type { NavigationLevel, TranslationFn } from './types';

export function getLevelTitle(level: NavigationLevel, t: TranslationFn): string {
  switch (level) {
    case 'companies': return t('entities.company.plural');
    case 'projects': return t('entities.project.plural');
    case 'buildings': return t('entities.building.plural');
    case 'floors': return t('entities.floor.plural');
    case 'properties': return t('entities.unit.plural');
    case 'storage': return t('entities.storage.plural');
    case 'parking': return t('entities.parking.plural');
    default: return '';
  }
}

export function getLevelIcon(level: NavigationLevel): React.ComponentType<{ className?: string }> {
  switch (level) {
    case 'companies': return NAVIGATION_ENTITIES.company.icon;
    case 'projects': return NAVIGATION_ENTITIES.project.icon;
    case 'buildings': return NAVIGATION_ENTITIES.building.icon;
    case 'floors': return NAVIGATION_ENTITIES.floor.icon;
    case 'properties': return NAVIGATION_ENTITIES.property.icon;
    case 'storage': return NAVIGATION_ENTITIES.storage.icon;
    case 'parking': return NAVIGATION_ENTITIES.parking.icon;
    default: return NAVIGATION_ENTITIES.building.icon;
  }
}

export function getDeleteIcon(level: NavigationLevel): React.ComponentType<{ className?: string }> {
  switch (level) {
    case 'companies': return NAVIGATION_ACTIONS.delete.icon;
    case 'projects':
    case 'buildings':
    case 'floors':
    case 'properties':
    case 'storage':
    case 'parking':
      return NAVIGATION_ACTIONS.unlink.icon;
    default:
      return NAVIGATION_ACTIONS.delete.icon;
  }
}

export function getNewItemIcon(level: NavigationLevel): React.ComponentType<{ className?: string }> {
  switch (level) {
    case 'companies': return NAVIGATION_ACTIONS.add.icon;
    case 'projects':
    case 'buildings':
    case 'floors':
    case 'properties':
    case 'storage':
    case 'parking':
      return NAVIGATION_ACTIONS.link.icon;
    default:
      return NAVIGATION_ACTIONS.add.icon;
  }
}

export function getLevelIconColor(level: NavigationLevel): string {
  switch (level) {
    case 'companies': return NAVIGATION_ENTITIES.company.color;
    case 'projects': return NAVIGATION_ENTITIES.project.color;
    case 'buildings': return NAVIGATION_ENTITIES.building.color;
    case 'floors': return NAVIGATION_ENTITIES.floor.color;
    case 'properties': return NAVIGATION_ENTITIES.property.color;
    case 'storage': return NAVIGATION_ENTITIES.storage.color;
    case 'parking': return NAVIGATION_ENTITIES.parking.color;
    default: return NAVIGATION_ENTITIES.company.color;
  }
}

