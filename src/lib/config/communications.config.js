// src/lib/config/communications.config.js

/**
 * Κεντρική διαμόρφωση για όλα τα communication channels
 * Διαχειρίζεται όλες τις εξωτερικές υπηρεσίες επικοινωνίας
 */

export const COMMUNICATION_CHANNELS = {
    email: {
      provider: 'emailjs',
      serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
      templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
      publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
      enabled: true,
      supportedTypes: ['welcome', 'follow_up', 'proposal', 'appointment', 'custom']
    },
    telegram: {
      provider: 'telegram_bot_api',
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
      enabled: true,
      supportedTypes: ['text', 'photo', 'document', 'voice', 'video']
    },
    whatsapp: {
      provider: 'whatsapp_business_api',
      phoneNumber: process.env.WHATSAPP_PHONE_NUMBER,
      apiKey: process.env.WHATSAPP_API_KEY,
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
      enabled: false, // Θα ενεργοποιηθεί όταν ρυθμιστεί
      supportedTypes: ['text', 'template', 'media', 'document']
    },
    messenger: {
      provider: 'facebook_messenger',
      pageToken: process.env.MESSENGER_PAGE_TOKEN,
      appSecret: process.env.MESSENGER_APP_SECRET,
      webhookUrl: process.env.MESSENGER_WEBHOOK_URL,
      verifyToken: process.env.MESSENGER_VERIFY_TOKEN,
      enabled: false, // Θα ενεργοποιηθεί όταν ρυθμιστεί
      supportedTypes: ['text', 'quick_reply', 'template', 'attachment']
    },
    sms: {
      provider: 'viber', // ή 'twilio'
      apiKey: process.env.SMS_API_KEY,
      senderId: process.env.SMS_SENDER_ID,
      enabled: false, // Θα ενεργοποιηθεί όταν ρυθμιστεί
      supportedTypes: ['text', 'unicode']
    }
  };
  
  // Message types που υποστηρίζονται από το σύστημα
  export const MESSAGE_TYPES = {
    EMAIL: 'email',
    SMS: 'sms',
    CALL: 'call',
    WHATSAPP: 'whatsapp',
    TELEGRAM: 'telegram',
    MESSENGER: 'messenger',
    VIBER: 'viber'
  };
  
  // Message directions
  export const MESSAGE_DIRECTIONS = {
    INBOUND: 'inbound',
    OUTBOUND: 'outbound'
  };
  
  // Message statuses
  export const MESSAGE_STATUSES = {
    PENDING: 'pending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    FAILED: 'failed',
    COMPLETED: 'completed'
  };
  
  // Πρότυπα μηνυμάτων για κάθε channel
  export const MESSAGE_TEMPLATES = {
    email: {
      welcome: {
        subject: 'Καλωσήρθατε στην {{companyName}}',
        template: 'welcome_template'
      },
      follow_up: {
        subject: 'Παρακολούθηση για {{propertyTitle}}',
        template: 'follow_up_template'
      },
      appointment: {
        subject: 'Επιβεβαίωση Ραντεβού - {{date}}',
        template: 'appointment_template'
      },
      proposal: {
        subject: 'Πρόταση για {{propertyTitle}}',
        template: 'proposal_template'
      }
    },
    telegram: {
      welcome: 'Καλωσήρθατε! Πώς μπορώ να σας βοηθήσω σήμερα;',
      property_info: 'Ενδιαφέρεστε για το ακίνητο {{propertyTitle}}. Θα θέλατε περισσότερες πληροφορίες;',
      appointment: 'Το ραντεβού σας έχει προγραμματιστεί για {{date}} στις {{time}}.'
    },
    whatsapp: {
      welcome: 'Γεια σας! 👋 Πώς μπορώ να σας βοηθήσω με τα ακίνητά μας;',
      property_info: '🏠 Ακίνητο: {{propertyTitle}}\n📍 Τοποθεσία: {{location}}\n💰 Τιμή: {{price}}',
      appointment: '📅 Ραντεβού επιβεβαιωμένο!\n🕐 {{date}} στις {{time}}\n📍 {{location}}'
    }
  };
  
  // Configuration για το unified inbox
  export const INBOX_CONFIG = {
    realTimeUpdates: true,
    autoRefreshInterval: 30000, // 30 seconds
    maxMessagesPerPage: 50,
    supportedFilters: ['channel', 'status', 'direction', 'dateRange', 'entityType'],
    defaultSortBy: 'createdAt',
    defaultSortOrder: 'desc'
  };
  
  // Webhook endpoints configuration
  export const WEBHOOK_ENDPOINTS = {
    telegram: '/api/communications/webhooks/telegram',
    whatsapp: '/api/communications/webhooks/whatsapp',
    messenger: '/api/communications/webhooks/messenger',
    sms: '/api/communications/webhooks/sms'
  };
  
  // Helper function για να ελέγξουμε αν ένα channel είναι ενεργό
  export const isChannelEnabled = (channelName) => {
    const channel = COMMUNICATION_CHANNELS[channelName];
    return channel && channel.enabled && hasRequiredConfig(channel);
  };
  
  // Helper function για να ελέγξουμε αν υπάρχει η απαραίτητη διαμόρφωση
  const hasRequiredConfig = (channel) => {
    switch (channel.provider) {
      case 'emailjs':
        return !!(channel.serviceId && channel.templateId && channel.publicKey);
      case 'telegram_bot_api':
        return !!(channel.botToken);
      case 'whatsapp_business_api':
        return !!(channel.phoneNumber && channel.apiKey);
      case 'facebook_messenger':
        return !!(channel.pageToken && channel.appSecret);
      case 'viber':
        return !!(channel.apiKey);
      default:
        return false;
    }
  };
  
  // Export της configuration
  export default {
    COMMUNICATION_CHANNELS,
    MESSAGE_TYPES,
    MESSAGE_DIRECTIONS,
    MESSAGE_STATUSES,
    MESSAGE_TEMPLATES,
    INBOX_CONFIG,
    WEBHOOK_ENDPOINTS,
    isChannelEnabled
  };
