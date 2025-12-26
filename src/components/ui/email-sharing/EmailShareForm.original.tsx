// ============================================================================
// 📧 EMAIL SHARE FORM COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΛΥΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Reusable email sharing form με template support
// 🔗 USED BY: ShareModal, PropertySharing, ContactSharing
// 🏢 STANDARDS: Enterprise form patterns, centralized email templates
//
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommonBadge } from '@/core/badges';
import { designSystem } from '@/lib/design-system';
import { INTERACTIVE_PATTERNS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// Icons
import { Mail, Users, MessageCircle, Plus, Trash2, ArrowLeft, Palette } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// Services & Types
import { EmailTemplatesService } from '@/services/email-templates.service';
import type { EmailTemplateType } from '@/types/email-templates';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ShareData {
  title: string;
  text?: string;
  url: string;
}

export interface EmailShareFormProps {
  /** Share data object */
  shareData: ShareData;

  /** Callback when email is successfully sent */
  onEmailShare: (emailData: EmailShareData) => Promise<void>;

  /** Callback to go back to main sharing view */
  onBack: () => void;

  /** Loading state from parent */
  loading?: boolean;

  /** Error state from parent */
  error?: string;

  /** Configuration options */
  config?: {
    /** Maximum message length */
    maxMessageLength?: number;
    /** Maximum recipients allowed */
    maxRecipients?: number;
    /** Default template to select */
    defaultTemplate?: EmailTemplateType;
    /** Show template selector */
    showTemplateSelector?: boolean;
    /** Custom validation function */
    validateRecipients?: (emails: string[]) => string | null;
  };
}

export interface EmailShareData {
  recipients: string[];
  personalMessage?: string;
  templateType: EmailTemplateType;
  propertyTitle: string;
  propertyDescription?: string;
  propertyUrl: string;
  senderName?: string;
}

// ============================================================================
// EMAIL SHARE FORM COMPONENT
// ============================================================================

export const EmailShareForm: React.FC<EmailShareFormProps> = ({
  shareData,
  onEmailShare,
  onBack,
  loading = false,
  error,
  config = {}
}) => {
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();

  // ============================================================================
  // CONFIGURATION με DEFAULTS
  // ============================================================================

  const finalConfig = {
    maxMessageLength: 500,
    maxRecipients: 5,
    defaultTemplate: 'residential' as EmailTemplateType,
    showTemplateSelector: true,
    ...config
  };

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [emailRecipients, setEmailRecipients] = useState<string[]>(['']);
  const [personalMessage, setPersonalMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>(finalConfig.defaultTemplate);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ============================================================================
  // RESET STATE ON MOUNT
  // ============================================================================

  useEffect(() => {
    setEmailRecipients(['']);
    setPersonalMessage('');
    setSelectedTemplate(finalConfig.defaultTemplate);
    setValidationError(null);
  }, [finalConfig.defaultTemplate]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * ➕ Add new email recipient
   */
  const addEmailRecipient = () => {
    if (emailRecipients.length < finalConfig.maxRecipients) {
      setEmailRecipients([...emailRecipients, '']);
    }
  };

  /**
   * ❌ Remove email recipient
   */
  const removeEmailRecipient = (index: number) => {
    if (emailRecipients.length > 1) {
      setEmailRecipients(emailRecipients.filter((_, i) => i !== index));
    }
  };

  /**
   * ✏️ Update email recipient
   */
  const updateEmailRecipient = (index: number, value: string) => {
    const newRecipients = [...emailRecipients];
    newRecipients[index] = value;
    setEmailRecipients(newRecipients);

    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  };

  /**
   * ✅ Validate email address
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * 🔍 Get valid emails
   */
  const getValidEmails = (): string[] => {
    return emailRecipients.filter(email => email.trim() && isValidEmail(email));
  };

  /**
   * ✅ Check if form is valid
   */
  const isFormValid = (): boolean => {
    const validEmails = getValidEmails();

    if (validEmails.length === 0) {
      return false;
    }

    // Custom validation if provided
    if (finalConfig.validateRecipients) {
      const customError = finalConfig.validateRecipients(validEmails);
      if (customError) {
        return false;
      }
    }

    return true;
  };

  /**
   * 📤 Handle form submission
   */
  const handleSubmit = async () => {
    const validEmails = getValidEmails();

    // Validation
    if (validEmails.length === 0) {
      setValidationError('Παρακαλώ εισάγετε τουλάχιστον ένα έγκυρο email');
      return;
    }

    // Custom validation
    if (finalConfig.validateRecipients) {
      const customError = finalConfig.validateRecipients(validEmails);
      if (customError) {
        setValidationError(customError);
        return;
      }
    }

    setValidationError(null);

    // Prepare email data
    const emailData: EmailShareData = {
      recipients: validEmails,
      personalMessage: personalMessage.trim() || undefined,
      templateType: selectedTemplate,
      propertyTitle: shareData.title,
      propertyDescription: shareData.text,
      propertyUrl: shareData.url,
      senderName: 'Nestor Construct'
    };

    try {
      await onEmailShare(emailData);
    } catch (err) {
      // Error handled by parent
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const messageLength = personalMessage.length;
  const remainingChars = finalConfig.maxMessageLength - messageLength;
  const validEmailCount = getValidEmails().length;
  const availableTemplates = EmailTemplatesService.getAllTemplates();
  const currentTemplate = availableTemplates.find(t => t.id === selectedTemplate);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="text-center">
        <div className={designSystem.cn(
          `mx-auto w-12 h-12 ${radius.full} flex items-center justify-center mb-3`,
          designSystem.getStatusColor('info', 'bg')
        )}>
          <Mail className={`${iconSizes.lg} text-white`} />
        </div>
        <h3 className={designSystem.cn(
          designSystem.presets.text.title,
          "mb-2"
        )}>
          Αποστολή μέσω Email
        </h3>
        <p className={designSystem.presets.text.muted}>
          Επιλέξτε template και στείλτε το ακίνητο
        </p>
      </div>

      <div className="space-y-5">
        {/* TEMPLATE SELECTOR */}
        {finalConfig.showTemplateSelector && (
          <div>
            <Label className={designSystem.cn(
              "flex items-center gap-2 mb-3",
              designSystem.getTypographyClass('sm', 'medium')
            )}>
              <Palette className={iconSizes.sm} />
              Email Template
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {availableTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template.id)}
                  className={designSystem.cn(
                    `p-3 ${quick.card} border transition-all text-center`,
                    selectedTemplate === template.id
                      ? `${getStatusBorder('info')} bg-blue-50 dark:bg-blue-900/20`
                      : `${quick.card} ${HOVER_BORDER_EFFECTS.GRAY}`
                  )}
                >
                  <div className={designSystem.getTypographyClass('lg')}>
                    {template.icon}
                  </div>
                  <div className={designSystem.cn(
                    designSystem.getTypographyClass('xs', 'medium'),
                    "mt-1"
                  )}>
                    {template.name}
                  </div>
                  <div className={designSystem.cn(
                    designSystem.getTypographyClass('xs'),
                    "text-muted-foreground mt-1"
                  )}>
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MULTIPLE RECIPIENTS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className={designSystem.cn(
              "flex items-center gap-2",
              designSystem.getTypographyClass('sm', 'medium')
            )}>
              <Users className={iconSizes.sm} />
              Παραλήπτες Email
            </Label>
            {emailRecipients.length < finalConfig.maxRecipients && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addEmailRecipient}
                className={designSystem.cn(
                  designSystem.getStatusColor('info', 'text'),
                  INTERACTIVE_PATTERNS.PRIMARY_HOVER
                )}
              >
                <Plus className={`${iconSizes.sm} mr-1`} />
                Προσθήκη
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {emailRecipients.map((email, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="email"
                  placeholder={`Email ${index + 1}`}
                  value={email}
                  onChange={(e) => updateEmailRecipient(index, e.target.value)}
                  disabled={loading}
                  className={designSystem.cn(
                    "flex-1",
                    email && !isValidEmail(email) && email.trim() !== ''
                      ? `${getStatusBorder('error')} focus:ring-red-500`
                      : ""
                  )}
                />
                {emailRecipients.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEmailRecipient(index)}
                    disabled={loading}
                    className={`text-red-500 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                  >
                    <Trash2 className={iconSizes.sm} />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className={designSystem.cn(
            designSystem.getTypographyClass('xs'),
            "text-muted-foreground mt-1"
          )}>
            {validEmailCount} έγκυρα email από {emailRecipients.length}
          </div>
        </div>

        {/* PERSONAL MESSAGE */}
        <div>
          <Label className={designSystem.cn(
            "flex items-center gap-2 mb-2",
            designSystem.getTypographyClass('sm', 'medium')
          )}>
            <MessageCircle className={iconSizes.sm} />
            Προσωπικό Μήνυμα (προαιρετικό)
          </Label>
          <Textarea
            placeholder="Προσθέστε ένα προσωπικό μήνυμα..."
            value={personalMessage}
            onChange={(e) => {
              if (e.target.value.length <= finalConfig.maxMessageLength) {
                setPersonalMessage(e.target.value);
              }
            }}
            disabled={loading}
            className="min-h-[80px] resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <div className={designSystem.cn(
              designSystem.getTypographyClass('xs'),
              "text-muted-foreground"
            )}>
              Θα εμφανιστεί στο {currentTemplate?.name} template
            </div>
            <CommonBadge
              status="company"
              customLabel={`${remainingChars} χαρακτήρες`}
              variant={remainingChars < 50 ? "destructive" : "secondary"}
              className={designSystem.getTypographyClass('xs')}
            />
          </div>
        </div>

        {/* MESSAGE PREVIEW */}
        {personalMessage.trim() && (
          <div className={`p-3 bg-blue-50 dark:bg-blue-900/20 ${quick.card} ${quick.input} ${getStatusBorder('info')}`}>
            <div className={designSystem.cn(
              designSystem.getTypographyClass('xs', 'medium'),
              "text-blue-800 dark:text-blue-300 mb-1"
            )}>
              Προεπισκόπηση μηνύματος:
            </div>
            <div className={designSystem.cn(
              designSystem.getTypographyClass('sm'),
              "text-blue-700 dark:text-blue-200 italic"
            )}>
              "{personalMessage}"
            </div>
          </div>
        )}

        {/* VALIDATION ERROR */}
        {validationError && (
          <div className={`p-3 bg-red-50 dark:bg-red-900/20 ${quick.card} ${quick.input} ${getStatusBorder('error')}`}>
            <div className={designSystem.cn(
              designSystem.getTypographyClass('sm', 'medium'),
              "text-red-800 dark:text-red-300"
            )}>
              {validationError}
            </div>
          </div>
        )}

        {/* BACKEND ERROR */}
        {error && (
          <div className={`p-3 bg-red-50 dark:bg-red-900/20 ${quick.card} ${quick.input} ${getStatusBorder('error')}`}>
            <div className={designSystem.cn(
              designSystem.getTypographyClass('sm', 'medium'),
              "text-red-800 dark:text-red-300"
            )}>
              {error}
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className={`flex gap-3 pt-4 ${quick.borderT}`}>
          <Button
            type="button"
            onClick={onBack}
            variant="outline"
            disabled={loading}
            className="flex-1"
          >
            <ArrowLeft className={`${iconSizes.sm} mr-2`} />
            Πίσω
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid() || loading}
            className="flex-1"
          >
            {loading ? 'Αποστολή...' :
              `Αποστολή (${validEmailCount})`
            }
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * 🪝 useEmailValidation Hook για advanced validation
 */
export const useEmailValidation = (options: {
  maxRecipients?: number;
  allowDuplicates?: boolean;
  domainWhitelist?: string[];
  domainBlacklist?: string[];
}) => {
  const validateEmails = (emails: string[]): string | null => {
    // Max recipients check
    if (options.maxRecipients && emails.length > options.maxRecipients) {
      return `Μέγιστος αριθμός παραληπτών: ${options.maxRecipients}`;
    }

    // Duplicates check
    if (!options.allowDuplicates) {
      const unique = [...new Set(emails)];
      if (unique.length !== emails.length) {
        return 'Βρέθηκαν διπλότυπα emails';
      }
    }

    // Domain whitelist check
    if (options.domainWhitelist) {
      const invalidDomains = emails.filter(email => {
        const domain = email.split('@')[1]?.toLowerCase();
        return !options.domainWhitelist!.includes(domain);
      });
      if (invalidDomains.length > 0) {
        return `Μη επιτρεπτά domains: ${invalidDomains.join(', ')}`;
      }
    }

    // Domain blacklist check
    if (options.domainBlacklist) {
      const blockedEmails = emails.filter(email => {
        const domain = email.split('@')[1]?.toLowerCase();
        return options.domainBlacklist!.includes(domain);
      });
      if (blockedEmails.length > 0) {
        return `Μπλοκαρισμένα emails: ${blockedEmails.join(', ')}`;
      }
    }

    return null;
  };

  return { validateEmails };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default EmailShareForm;