/**
 * Default email templates for post-award vendor notifications.
 * §5.V.3 — system defaults + placeholder interpolation.
 *
 * Two templates: 'winner' (accepted quotes) and 'rejection' (rejected quotes).
 * Placeholders: {{rfqTitle}}, {{rfqNumber}}, {{vendorName}}, {{quoteNumber}},
 *   {{senderName}}, {{companyName}}, {{date}}
 *
 * @module subapps/procurement/templates/vendorNotificationDefaults
 * @see ADR-328 §5.V.3
 */

export type NotificationTemplate = 'winner' | 'rejection';

export interface TemplateContent {
  subject: string;
  body: string;
}

export interface TemplatePlaceholders {
  rfqTitle?: string;
  rfqNumber?: string;
  vendorName?: string;
  quoteNumber?: string;
  senderName?: string;
  companyName?: string;
  date?: string;
}

// ============================================================================
// DEFAULT TEMPLATES
// ============================================================================

const WINNER_SUBJECT =
  'Συγχαρητήρια — Επιλέχθηκε η προσφορά σας για {{rfqTitle}}';

const WINNER_BODY = `Αγαπητέ {{vendorName}},

Σας ενημερώνουμε ότι η προσφορά σας ({{quoteNumber}}) για το αίτημα «{{rfqTitle}}» ({{rfqNumber}}) επιλέχθηκε.

Σύντομα θα επικοινωνήσουμε για τα επόμενα βήματα και την έκδοση εντολής αγοράς.

Με εκτίμηση,
{{senderName}}
{{companyName}}`;

const REJECTION_SUBJECT =
  'Ευχαριστούμε για την προσφορά σας στο {{rfqTitle}}';

const REJECTION_BODY = `Αγαπητέ {{vendorName}},

Σας ευχαριστούμε για την προσφορά σας ({{quoteNumber}}) για το αίτημα «{{rfqTitle}}» ({{rfqNumber}}).

Μετά από αξιολόγηση, επιλέξαμε άλλον πάροχο για αυτή τη φορά. Εκτιμούμε το ενδιαφέρον σας και ελπίζουμε σε μελλοντική συνεργασία.

Με εκτίμηση,
{{senderName}}
{{companyName}}`;

export const VENDOR_NOTIFICATION_DEFAULTS: Record<NotificationTemplate, TemplateContent> = {
  winner: { subject: WINNER_SUBJECT, body: WINNER_BODY },
  rejection: { subject: REJECTION_SUBJECT, body: REJECTION_BODY },
};

// ============================================================================
// INTERPOLATION
// ============================================================================

export function interpolatePlaceholders(
  template: string,
  values: TemplatePlaceholders,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const typedKey = key as keyof TemplatePlaceholders;
    return values[typedKey] ?? `{{${key}}}`;
  });
}

export function buildDefaultTemplate(
  templateType: NotificationTemplate,
  placeholders: TemplatePlaceholders,
): TemplateContent {
  const defaults = VENDOR_NOTIFICATION_DEFAULTS[templateType];
  return {
    subject: interpolatePlaceholders(defaults.subject, placeholders),
    body: interpolatePlaceholders(defaults.body, placeholders),
  };
}
