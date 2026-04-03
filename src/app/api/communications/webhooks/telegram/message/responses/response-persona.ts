import type { ResolvedContact } from '@/services/contact-recognition/contact-linker';
import type { TelegramSendPayload } from '../../telegram/types';
import type { TelegramLocale } from '../../templates/template-resolver';
import { getTemplateResolver } from '../../templates/template-resolver';
import { createInlineKeyboard, getCompanyConfig } from './response-shared';
import type { PersonaMenuDefinition } from './response-types';

const PERSONA_MENUS: Record<string, PersonaMenuDefinition> = {
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
      [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
    ],
  },
  notary: {
    greeting: 'Πώς μπορώ να σε εξυπηρετήσω;',
    buttons: [
      [
        { text: '📄 Έγγραφα', callback_data: 'legal_documents' },
        { text: '📋 Συμβόλαια', callback_data: 'contracts' },
      ],
      [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
    ],
  },
  supplier: {
    greeting: 'Πώς μπορώ να σε βοηθήσω;',
    buttons: [
      [
        { text: '📦 Παραγγελίες', callback_data: 'orders' },
        { text: '🧾 Τιμολόγια', callback_data: 'invoices' },
      ],
      [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
    ],
  },
  real_estate_agent: {
    greeting: 'Πώς μπορώ να σε βοηθήσω;',
    buttons: [
      [
        { text: '🏠 Διαθέσιμα ακίνητα', callback_data: 'property_search' },
        { text: '💰 Προμήθειες', callback_data: 'commissions' },
      ],
      [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
    ],
  },
};

const DEFAULT_PERSONA_MENU: PersonaMenuDefinition = {
  greeting: 'Πώς μπορώ να σε βοηθήσω;',
  buttons: [[
    { text: '🔍 Αναζήτηση', callback_data: 'property_search' },
    { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
  ]],
};

export function createPersonaAwareResponse(
  chatId: string | number,
  contact: ResolvedContact,
  _messageText: string,
): TelegramSendPayload {
  const firstName = contact.firstName || contact.displayName;
  const persona = contact.primaryPersona;
  const menu = (persona && PERSONA_MENUS[persona]) ?? PERSONA_MENUS.client ?? DEFAULT_PERSONA_MENU;

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `👋 Γεια σου <b>${firstName}</b>!\n\n${menu.greeting}`,
    parse_mode: 'HTML',
    reply_markup: createInlineKeyboard(menu.buttons),
  };
}

export function createContactNotRecognizedResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🔒 ${t.getText('errors.contactNotRecognized')}\n\n📞 <b>${t.getText('contact.phone', { phone: company.phone })}</b>`,
    parse_mode: 'HTML',
  };
}

export function createPipelineRetryFailedResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `⚠️ ${t.getText('errors.pipelineRetryFailed')}`,
  };
}

export function createNoLinkedUnitsResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el',
): TelegramSendPayload {
  const t = getTemplateResolver(locale);
  const company = getCompanyConfig();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🏠 ${t.getText('errors.noLinkedUnits')}\n\n📞 <b>${t.getText('contact.phone', { phone: company.phone })}</b>`,
    parse_mode: 'HTML',
  };
}
