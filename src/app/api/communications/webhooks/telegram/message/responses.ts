// /home/user/studio/src/app/api/communications/webhooks/telegram/message/responses.ts

import type { TelegramSendPayload } from "../telegram/types";

export function createStartResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `Καλωσήρθατε στην Pagonis Real Estate! 🏠

🤖 <b>Είμαι ο έξυπνος βοηθός σας για ακίνητα!</b>

💬 <b>Στείλτε μου μηνύματα όπως:</b>
- "Θέλω διαμέρισμα 2 δωματίων"
- "Δείξε μου μεζονέτες στο κέντρο"
- "Υπάρχει κάτι με 65 τ.μ.;"

🎯 <b>Ή χρησιμοποιήστε τα buttons:</b>`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔍 Αναζήτηση Ακινήτων', callback_data: 'property_search' },
          { text: '📞 Επικοινωνία', callback_data: 'contact_agent' }
        ]
      ]
    }
  };
}

export function createSearchMenuResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🔍 <b>Έξυπνη Αναζήτηση Ακινήτων</b>

💬 <b>Μιλήστε μου φυσικά! Παραδείγματα:</b>

🏠 "Διαμέρισμα 2 δωματίων"
🏘️ "Μεζονέτα με parking"
📐 "Κάτι με 65 τετραγωνικά"

🎯 <b>Ή επιλέξτε κατηγορία:</b>`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏠 Διαμερίσματα', callback_data: 'search_apartments' },
          { text: '🏘️ Μεζονέτες', callback_data: 'search_maisonettes' }
        ],
        [
          { text: '🏪 Καταστήματα', callback_data: 'search_stores' },
          { text: '📊 Στατιστικά', callback_data: 'property_stats' }
        ]
      ]
    }
  };
}

export function createHelpResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `❓ <b>Βοήθεια - Πώς να χρησιμοποιήσετε τον Bot</b>

🗣️ <b>Φυσική Ομιλία:</b>
Μπορείτε να μου μιλάτε φυσικά! Καταλαβαίνω:
- Τύπους ακινήτων (διαμέρισμα, μεζονέτα, κατάστημα)
- Τιμές ("κάτω από 100.000€")
- Εμβαδόν ("65 τ.μ.")
- Δωμάτια ("2 δωματίων")

📋 <b>Εντολές:</b>
/start - Αρχική οθόνη
/search - Μενού αναζήτησης
/contact - Στοιχεία επικοινωνίας
/help - Αυτή η βοήθεια`,
    parse_mode: 'HTML'
  };
}

export function createContactResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `📞 <b>Στοιχεία Επικοινωνίας</b>

🏢 <b>Εταιρεία:</b> Pagonis Real Estate
📧 <b>Email:</b> info@pagonis.gr
📱 <b>Τηλέφωνο:</b> +30 231 012 3456

⏰ <b>Ωράριο:</b> Δευτέρα - Παρασκευή: 09:00 - 18:00
📍 <b>Διεύθυνση:</b> Θεσσαλονίκη, Ελλάδα

💬 Ένας εξειδικευμένος σύμβουλος θα επικοινωνήσει μαζί σας!`,
    parse_mode: 'HTML'
  };
}

export function createDefaultResponse(chatId: string | number, text: string): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🤔 Κατάλαβα ότι ενδιαφέρεστε για ακίνητα!

💡 <b>Δοκιμάστε να μου πείτε:</b>
- Τι τύπο ακινήτου ψάχνετε
- Σε ποια τιμή ή εμβαδόν

📝 <b>Παράδειγμα:</b> "Θέλω διαμέρισμα 2 δωματίων"`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔍 Παραδείγματα', callback_data: 'search_examples' },
          { text: '📞 Επικοινωνία', callback_data: 'contact_agent' }
        ]
      ]
    }
  };
}

export function createErrorResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `😅 Ουπς! Κάτι πήγε στραβά.

🔧 <b>Δοκιμάστε:</b>
- Πιο απλή αναζήτηση
- Λιγότερα κριτήρια

📞 <b>Άμεση βοήθεια:</b> +30 231 012 3456`,
    parse_mode: 'HTML'
  };
}

export function createRateLimitResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `⏱️ Πολλές ερωτήσεις σε σύντομο χρονικό διάστημα!

💡 Παρακαλώ περιμένετε λίγο και δοκιμάστε ξανά.

📞 Για άμεση εξυπηρέτηση: +30 231 012 3456`
  };
}

export function createDatabaseUnavailableResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `⚠️ Η βάση δεδομένων δεν είναι διαθέσιμη αυτή τη στιγμή.

📞 <b>Για άμεση εξυπηρέτηση επικοινωνήστε μαζί μας:</b>
- Τηλέφωνο: +30 231 012 3456
- Email: info@pagonis.gr

🔄 Δοκιμάστε ξανά σε λίγα λεπτά.`,
    parse_mode: 'HTML'
  };
}

export function createNoResultsResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🔍 Δεν βρέθηκαν ακίνητα για την αναζήτησή σας.

💡 <b>Δοκιμάστε:</b>
- "Διαμέρισμα 2 δωματίων"
- "Μεζονέτα στο κέντρο"
- "Κατάστημα για ενοικίαση"

📞 Ή επικοινωνήστε μαζί μας για προσωπική εξυπηρέτηση!`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
          { text: '🔍 Νέα Αναζήτηση', callback_data: 'new_search' }
        ]
      ]
    }
  };
}

export function createTooGenericResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🔍 Η αναζήτησή σας είναι πολύ γενική.

Παρακαλώ συγκεκριμενοποιήστε:
- Τύπο ακινήτου (διαμέρισμα, μεζονέτα)
- Περιοχή ή κτίριο
- Τιμή ή εμβαδόν

📝 Παράδειγμα: "Διαμέρισμα 2Δ κάτω από €100,000"`,
    parse_mode: 'HTML'
  };
}

export function createTooManyResultsResponse(chatId: string | number): TelegramSendPayload {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `📊 Βρέθηκαν πολλά αποτελέσματα για την αναζήτησή σας.

💡 Για καλύτερη εξυπηρέτηση, παρακαλώ:
- Προσδιορίστε περισσότερα κριτήρια
- Ή επικοινωνήστε μαζί μας για εξατομικευμένη βοήθεια

📞 Τηλέφωνο: +30 231 012 3456`,
    parse_mode: 'HTML'
  };
}
