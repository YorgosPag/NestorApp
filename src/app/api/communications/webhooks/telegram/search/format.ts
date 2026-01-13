/**
 * 🔍 TELEGRAM BOT SEARCH RESULT FORMATTING
 *
 * Formats search results for Telegram display.
 * Uses centralized type catalog and templates.
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import type { SearchResult, TelegramProperty } from '../shared/types';
import { getTypeEntry, type TypeCatalogEntry } from '../catalogs/type-catalog';
import {
  getTemplateResolver,
  formatCurrency,
  formatArea,
  type TelegramLocale
} from '../templates/template-resolver';

// ============================================================================
// TYPE LABEL FUNCTIONS
// ============================================================================

/**
 * Get property type label in specified locale
 * Uses centralized type catalog (no hardcoded mapping)
 */
export function getPropertyTypeLabel(
  type?: string,
  locale: TelegramLocale = 'el'
): string {
  if (!type) {
    const t = getTemplateResolver(locale);
    return t.getText('property.type');
  }

  const typeEntry = getTypeEntry(type);
  if (typeEntry) {
    return locale === 'el' ? typeEntry.labelEl : typeEntry.labelEn;
  }

  return type;
}

/**
 * Get property type emoji from catalog
 */
export function getPropertyTypeEmoji(type?: string): string {
  if (!type) return '🏠';

  const typeEntry = getTypeEntry(type);
  return typeEntry?.emoji || '🏠';
}

// ============================================================================
// RESULT FORMATTING
// ============================================================================

/**
 * Format search results for Telegram display
 */
export function formatSearchResultsForTelegram(
  searchResult: SearchResult,
  locale: TelegramLocale = 'el'
): string {
  const t = getTemplateResolver(locale);

  if (!searchResult.success || searchResult.totalCount === 0) {
    return `🔍 ${t.getText('search.noResults.title')}

💡 <b>${t.getText('search.noResults.suggestion')}</b>`;
  }

  const countText = searchResult.totalCount === 1
    ? t.getText('search.results.foundOne')
    : t.getText('search.results.found', { count: searchResult.totalCount });

  let text = `🔍 <b>${countText}</b>\n\n`;

  const displayProperties = searchResult.properties.slice(0, 3);
  displayProperties.forEach((property: TelegramProperty, index: number) => {
    const emoji = getPropertyTypeEmoji(property.type);
    text += `${index + 1}. ${emoji} <b>${property.code || `ID: ${property.id.slice(-6)}`}</b>\n`;

    if (property.type) {
      text += `${emoji} ${t.getText('property.type')}: ${getPropertyTypeLabel(property.type, locale)}\n`;
    }
    if (property.area) {
      text += `📐 ${t.getText('property.area')}: ${formatArea(property.area, locale)}\n`;
    }
    if (property.rooms) {
      text += `🚪 ${t.getText('property.rooms')}: ${property.rooms}\n`;
    }
    if (property.price) {
      text += `💰 ${t.getText('property.price')}: ${formatCurrency(property.price, locale)}\n`;
    }
    if (property.building) {
      text += `🏢 ${property.building}\n`;
    }

    text += '\n';
  });

  if (searchResult.totalCount > 3) {
    const remaining = searchResult.totalCount - 3;
    text += `📋 <i>${t.getText('search.results.showing', { shown: 3, total: searchResult.totalCount })}</i>\n\n`;
  }

  text += `💬 <b>${t.getText('contact.callToAction')}</b>`;
  return text;
}

/**
 * Format single property for display
 */
export function formatPropertyForTelegram(
  property: TelegramProperty,
  locale: TelegramLocale = 'el'
): string {
  const t = getTemplateResolver(locale);
  const emoji = getPropertyTypeEmoji(property.type);

  let text = `${emoji} <b>${property.code || `ID: ${property.id.slice(-6)}`}</b>\n\n`;

  if (property.type) {
    text += `${t.getText('property.type')}: ${getPropertyTypeLabel(property.type, locale)}\n`;
  }
  if (property.area) {
    text += `${t.getText('property.area')}: ${formatArea(property.area, locale)}\n`;
  }
  if (property.rooms) {
    text += `${t.getText('property.rooms')}: ${property.rooms}\n`;
  }
  if (property.floor !== undefined) {
    text += `${t.getText('property.floor')}: ${property.floor}\n`;
  }
  if (property.price) {
    text += `${t.getText('property.price')}: ${formatCurrency(property.price, locale)}\n`;
  }
  if (property.status) {
    text += `${t.getText('property.status')}: ${property.status}\n`;
  }

  return text;
}
