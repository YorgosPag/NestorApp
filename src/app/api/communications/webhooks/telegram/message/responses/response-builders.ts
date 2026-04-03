import type { TelegramSendPayload } from '../../telegram/types';
import type { TelegramLocale } from '../../templates/template-resolver';
import { getTemplateResolver } from '../../templates/template-resolver';
import { getActiveTypes } from '../../catalogs/type-catalog';
import { createInlineKeyboard, getCompanyConfig } from './response-shared';

export function createStartResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const welcomeText = `${t.getText('start.welcome')} 🏠\n\n🤖 <b>${t.getText('start.description')}</b>\n\n🎯 <b>${t.getText('start.callToAction')}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: welcomeText,
    parse_mode: 'HTML',
    reply_markup: createInlineKeyboard([
      [
        { text: `🔍 ${t.getText('buttons.search')}`, callback_data: 'property_search' },
        { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' },
      ],
    ]),
  };
}

export function createSearchMenuResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const types = getActiveTypes();
  const residentialTypes = types.filter((type) => type.category === 'residential');
  const commercialTypes = types.filter((type) => type.category === 'commercial');

  const menuText = `🔍 <b>${t.getText('search.menu.title')}</b>\n\n💬 <b>${t.getText('search.menu.description')}</b>\n\n🎯 <b>${t.getText('help.tips.title')}</b>`;
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  if (residentialTypes.length > 0) {
    keyboard.push(
      residentialTypes.slice(0, 2).map((type) => ({
        text: `${type.emoji} ${locale === 'el' ? type.labelEl : type.labelEn}`,
        callback_data: `search_${type.canonical}`,
      })),
    );
  }

  const commercialRow: Array<{ text: string; callback_data: string }> = [];
  if (commercialTypes.length > 0) {
    commercialRow.push({
      text: `${commercialTypes[0].emoji} ${locale === 'el' ? commercialTypes[0].labelEl : commercialTypes[0].labelEn}`,
      callback_data: `search_${commercialTypes[0].canonical}`,
    });
  }
  commercialRow.push({
    text: `📊 ${t.getText('buttons.stats')}`,
    callback_data: 'property_stats',
  });
  keyboard.push(commercialRow);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: menuText,
    parse_mode: 'HTML',
    reply_markup: createInlineKeyboard(keyboard),
  };
}

export function createHelpResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const examples = t.getText('help.tips.examples') as unknown as string[];

  const helpText = `❓ <b>${t.getText('help.title')}</b>\n\n📋 <b>${t.getText('help.commands.start')}</b>\n${t.getText('help.commands.help')}\n${t.getText('help.commands.search')}\n${t.getText('help.commands.stats')}\n${t.getText('help.commands.contact')}\n\n💡 <b>${t.getText('help.tips.title')}</b>\n${examples.map((example) => `• ${example}`).join('\n')}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: helpText,
    parse_mode: 'HTML',
  };
}

export function createContactResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  const contactText = `📞 <b>${t.getText('contact.title')}</b>\n\n🏢 <b>${t.getText('contact.company', { companyName: company.name })}</b>\n📧 <b>${t.getText('contact.email', { email: company.email })}</b>\n📱 <b>${t.getText('contact.phone', { phone: company.phone })}</b>\n🌐 <b>${t.getText('contact.website', { website: company.website })}</b>\n\n💬 ${t.getText('contact.callToAction')}`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: contactText,
    parse_mode: 'HTML',
  };
}

export function createDefaultResponse(
  chatId: string | number,
  _text: string,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  const defaultText = `🤔 ${t.getText('errors.notUnderstood')}\n\n💡 <b>${t.getText('search.tooGeneric.suggestion')}</b>`;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: defaultText,
    parse_mode: 'HTML',
    reply_markup: createInlineKeyboard([
      [
        { text: `🔍 ${t.getText('buttons.search')}`, callback_data: 'property_search' },
        { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' },
      ],
    ]),
  };
}

export function createErrorResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `😅 ${t.getText('errors.generic')}\n\n📞 <b>${t.getText('contact.phone', { phone: company.phone })}</b>`,
    parse_mode: 'HTML',
  };
}

export function createRateLimitResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `⏱️ ${t.getText('errors.rateLimit')}\n\n📞 ${t.getText('contact.phone', { phone: company.phone })}`,
  };
}

export function createDatabaseUnavailableResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `⚠️ ${t.getText('errors.database')}\n\n📞 <b>${t.getText('contact.phone', { phone: company.phone })}</b>\n📧 <b>${t.getText('contact.email', { email: company.email })}</b>`,
    parse_mode: 'HTML',
  };
}

export function createNoResultsResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🔍 ${t.getText('search.noResults.title')}\n\n💡 <b>${t.getText('search.noResults.suggestion')}</b>`,
    parse_mode: 'HTML',
    reply_markup: createInlineKeyboard([
      [
        { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' },
        { text: `🔍 ${t.getText('buttons.newSearch')}`, callback_data: 'new_search' },
      ],
    ]),
  };
}

export function createTooGenericResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🔍 ${t.getText('search.tooGeneric.title')}\n\n💡 ${t.getText('search.tooGeneric.suggestion')}`,
    parse_mode: 'HTML',
  };
}

export function createTooManyResultsResponse(
  chatId: string | number,
  count: number = 0,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `📊 ${t.getText('search.tooManyResults.title', { count })}\n\n💡 ${t.getText('search.tooManyResults.suggestion')}`,
    parse_mode: 'HTML',
  };
}
