import {
  createTabsConfig,
  getSortedTabs,
  getTabById,
  getTabByValue,
  getTabsStats,
  validateTabConfig,
  type UnifiedTabConfig
} from './unified-tabs-factory';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('properties-tabs-config');

export type PropertiesTabConfig = UnifiedTabConfig;

export const PROPERTIES_TABS: PropertiesTabConfig[] = createTabsConfig('properties') as PropertiesTabConfig[];

export function getSortedPropertiesTabs(): PropertiesTabConfig[] {
  return getSortedTabs('properties') as PropertiesTabConfig[];
}

export function getEnabledPropertiesTabs(): PropertiesTabConfig[] {
  return getSortedTabs('properties') as PropertiesTabConfig[];
}


export function getPropertiesTabsStats() {
  return getTabsStats('properties');
}

export function validatePropertiesTabIds(): boolean {
  const ids = PROPERTIES_TABS.map(tab => tab.id);
  return ids.length === new Set(ids).size;
}

export function validatePropertiesTabValues(): boolean {
  const values = PROPERTIES_TABS.map(tab => tab.value);
  return values.length === new Set(values).size;
}

export function validatePropertiesTabOrders(): boolean {
  const orders = PROPERTIES_TABS.map(tab => tab.order);
  return orders.length === new Set(orders).size;
}

export function validatePropertiesTabsConfiguration(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validatePropertiesTabIds()) {
    errors.push('Duplicate tab IDs found');
  }
  if (!validatePropertiesTabValues()) {
    errors.push('Duplicate tab values found');
  }
  if (!validatePropertiesTabOrders()) {
    errors.push('Duplicate tab orders found');
  }

  PROPERTIES_TABS.forEach((tab, index) => {
    if (!validateTabConfig(tab)) {
      errors.push(`Tab at index ${index} failed validation`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function debugPropertiesTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Properties Tabs Configuration Debug (Factory-based)', {
      stats: getPropertiesTabsStats(),
      validation: validatePropertiesTabsConfiguration(),
      enabledTabs: getEnabledPropertiesTabs().map(t => t.label),
      allTabsCount: PROPERTIES_TABS.length,
      factory: 'unified-tabs-factory.ts'
    });
  }
}

if (process.env.NODE_ENV === 'development') {
  debugPropertiesTabs();
}
