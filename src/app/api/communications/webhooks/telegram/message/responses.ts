/**
 * 🤖 TELEGRAM BOT RESPONSE BUILDERS
 *
 * Creates Telegram message payloads using centralized templates.
 * All user-facing text comes from i18n templates (zero hardcoded strings).
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import type { TelegramSendPayload } from '../telegram/types';
import type { ResolvedContact } from '@/services/contact-recognition/contact-linker';
import {
  getTemplateResolver,
  type TelegramLocale
} from '../templates/template-resolver';
import { getActiveTypes } from '../catalogs/type-catalog';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramResponses');

// ============================================================================
// CONFIGURATION (from environment - NO hardcoded company values)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Company config from environment variables
 * Missing values are logged server-side and display generic placeholders
 */
const getCompanyConfig = () => {
  const config = {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME,
    email: process.env.NEXT_PUBLIC_COMPANY_EMAIL,
    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE,
    hours: process.env.NEXT_PUBLIC_COMPANY_HOURS,
    city: process.env.NEXT_PUBLIC_DEFAULT_CITY,
    website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE
  };

  // Log missing config (server-side only)
  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    logger.warn('Missing company config', { missingKeys: missingKeys.join(', ') });
  }

  // Return safe defaults for missing values (no real company info exposed)
  return {
    name: config.name || '-',
    email: config.email || '-',
    phone: config.phone || '-',
    hours: config.hours || '-',
    city: config.city || '-',
    website: config.website || '-'
  };
};

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Create welcome/start response
 */
export function createStartResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const welcomeText = `${t.getText('start.welcome')} 🏠

🤖 <b>${t.getText('start.description')}</b>

🎯 <b>${t.getText('start.callToAction')}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: welcomeText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `🔍 ${t.getText('buttons.search')}`, callback_data: 'property_search' },
          { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' }
        ]
      ]
    }
  };
}

/**
 * Create search menu response with property type buttons
 */
export function createSearchMenuResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const types = getActiveTypes();

  // Build type buttons dynamically from catalog
  const residentialTypes = types.filter(type => type.category === 'residential');
  const commercialTypes = types.filter(type => type.category === 'commercial');

  const menuText = `🔍 <b>${t.getText('search.menu.title')}</b>

💬 <b>${t.getText('search.menu.description')}</b>

🎯 <b>${t.getText('help.tips.title')}</b>`;

  // Build keyboard rows
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  // Add residential types row
  if (residentialTypes.length > 0) {
    const row = residentialTypes.slice(0, 2).map(type => ({
      text: `${type.emoji} ${locale === 'el' ? type.labelEl : type.labelEn}`,
      callback_data: `search_${type.canonical}`
    }));
    keyboard.push(row);
  }

  // Add commercial types + stats row
  const commercialRow: Array<{ text: string; callback_data: string }> = [];
  if (commercialTypes.length > 0) {
    commercialRow.push({
      text: `${commercialTypes[0].emoji} ${locale === 'el' ? commercialTypes[0].labelEl : commercialTypes[0].labelEn}`,
      callback_data: `search_${commercialTypes[0].canonical}`
    });
  }
  commercialRow.push({
    text: `📊 ${t.getText('buttons.stats')}`,
    callback_data: 'property_stats'
  });
  keyboard.push(commercialRow);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: menuText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

/**
 * Create help response
 */
export function createHelpResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const helpText = `❓ <b>${t.getText('help.title')}</b>

📋 <b>${t.getText('help.commands.start')}</b>
${t.getText('help.commands.help')}
${t.getText('help.commands.search')}
${t.getText('help.commands.stats')}
${t.getText('help.commands.contact')}

💡 <b>${t.getText('help.tips.title')}</b>
${(t.getText('help.tips.examples') as unknown as string[]).map((ex: string) => `• ${ex}`).join('\n')}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: helpText,
    parse_mode: 'HTML'
  };
}

/**
 * Create contact information response
 */
export function createContactResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  const contactText = `📞 <b>${t.getText('contact.title')}</b>

🏢 <b>${t.getText('contact.company', { companyName: company.name })}</b>
📧 <b>${t.getText('contact.email', { email: company.email })}</b>
📱 <b>${t.getText('contact.phone', { phone: company.phone })}</b>
🌐 <b>${t.getText('contact.website', { website: company.website })}</b>

💬 ${t.getText('contact.callToAction')}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: contactText,
    parse_mode: 'HTML'
  };
}

/**
 * Create default/fallback response when intent is unclear
 */
export function createDefaultResponse(
  chatId: string | number,
  _text: string,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const defaultText = `🤔 ${t.getText('errors.notUnderstood')}

💡 <b>${t.getText('search.tooGeneric.suggestion')}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: defaultText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `🔍 ${t.getText('buttons.search')}`, callback_data: 'property_search' },
          { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' }
        ]
      ]
    }
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  const errorText = `😅 ${t.getText('errors.generic')}

📞 <b>${t.getText('contact.phone', { phone: company.phone })}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: errorText,
    parse_mode: 'HTML'
  };
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `⏱️ ${t.getText('errors.rateLimit')}

📞 ${t.getText('contact.phone', { phone: company.phone })}`
  };
}

/**
 * Create database unavailable response
 */
export function createDatabaseUnavailableResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  const dbErrorText = `⚠️ ${t.getText('errors.database')}

📞 <b>${t.getText('contact.phone', { phone: company.phone })}</b>
📧 <b>${t.getText('contact.email', { email: company.email })}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: dbErrorText,
    parse_mode: 'HTML'
  };
}

/**
 * Create no results response
 */
export function createNoResultsResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const noResultsText = `🔍 ${t.getText('search.noResults.title')}

💡 <b>${t.getText('search.noResults.suggestion')}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: noResultsText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' },
          { text: `🔍 ${t.getText('buttons.newSearch')}`, callback_data: 'new_search' }
        ]
      ]
    }
  };
}

/**
 * Create too generic search response
 */
export function createTooGenericResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const tooGenericText = `🔍 ${t.getText('search.tooGeneric.title')}

💡 ${t.getText('search.tooGeneric.suggestion')}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: tooGenericText,
    parse_mode: 'HTML'
  };
}

/**
 * Create too many results response
 */
export function createTooManyResultsResponse(
  chatId: string | number,
  count: number = 0,
  locale: TelegramLocale = 'el'
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const tooManyText = `📊 ${t.getText('search.tooManyResults.title', { count })}

💡 ${t.getText('search.tooManyResults.suggestion')}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: tooManyText,
    parse_mode: 'HTML'
  };
}

// ============================================================================
// PERSONA-AWARE RESPONSE
// ============================================================================

/** Persona menu config — SSoT for per-role buttons */
const PERSONA_MENUS: Record<string, {
  greeting: string;
  buttons: Array<Array<{ text: string; callback_data: string }>>;
}> = {
  client: {
    greeting: 'Πώς μπορώ να σε βοηθήσω σήμερα;',
    buttons: [
      [
        { text: '🏠 Τα ακίνητά μου', callback_data: 'property_search' },
        { text: '💰 Πληρωμές', callback_data: 'my_payments' },
      ],
      [
        { text: '📅 Ραντεβού', callback_data: 'my_appointments' },
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  },
  engineer: {
    greeting: 'Πώς μπορώ να σε βοηθήσω;',
    buttons: [
      [
        { text: '🏗️ Φάσεις κατασκευής', callback_data: 'construction_phases' },
        { text: '📐 Μετρήσεις', callback_data: 'measurements' },
      ],
      [
        { text: '📁 Αρχεία', callback_data: 'project_files' },
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  },
  lawyer: {
    greeting: 'Πώς μπορώ να σε εξυπηρετήσω;',
    buttons: [
      [
        { text: '📄 Έγγραφα', callback_data: 'legal_documents' },
        { text: '📋 Συμβόλαια', callback_data: 'contracts' },
      ],
      [
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  },
  notary: {
    greeting: 'Πώς μπορώ να σε εξυπηρετήσω;',
    buttons: [
      [
        { text: '📄 Έγγραφα', callback_data: 'legal_documents' },
        { text: '📋 Συμβόλαια', callback_data: 'contracts' },
      ],
      [
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  },
  supplier: {
    greeting: 'Πώς μπορώ να σε βοηθήσω;',
    buttons: [
      [
        { text: '📦 Παραγγελίες', callback_data: 'orders' },
        { text: '🧾 Τιμολόγια', callback_data: 'invoices' },
      ],
      [
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  },
  real_estate_agent: {
    greeting: 'Πώς μπορώ να σε βοηθήσω;',
    buttons: [
      [
        { text: '🏠 Διαθέσιμα ακίνητα', callback_data: 'property_search' },
        { text: '💰 Προμήθειες', callback_data: 'commissions' },
      ],
      [
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  },
};

/**
 * Create persona-aware response for known contacts.
 * Uses first name + informal tone (ενικός) for recognized contacts.
 */
export function createPersonaAwareResponse(
  chatId: string | number,
  contact: ResolvedContact,
  _messageText: string,
): TelegramSendPayload {
  const firstName = contact.firstName || contact.displayName;
  const persona = contact.primaryPersona;

  // Get menu config (fallback to client for unknown personas)
  const menu = (persona && PERSONA_MENUS[persona]) ?? PERSONA_MENUS.client ?? {
    greeting: 'Πώς μπορώ να σε βοηθήσω;',
    buttons: [
      [
        { text: '🔍 Αναζήτηση', callback_data: 'property_search' },
        { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
      ],
    ],
  };

  const text = `👋 Γεια σου <b>${firstName}</b>!\n\n${menu.greeting}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: menu.buttons,
    },
  };
}
