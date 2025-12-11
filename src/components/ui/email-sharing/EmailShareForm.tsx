// ============================================================================
// 📧 EMAIL SHARE FORM COMPONENT - ENTERPRISE REFACTORED
// ============================================================================
//
// 🎯 PURPOSE: Modular email sharing form με extracted components
// 🔗 USED BY: ShareModal, PropertySharing, ContactSharing
// 🏢 STANDARDS: Enterprise architecture, modular design, reusability
//
// ============================================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommonBadge } from '@/core/badges';
import { designSystem } from '@/lib/design-system';

// Icons
import { Mail, MessageCircle, ArrowLeft } from 'lucide-react';

// Services
import { EmailTemplatesService } from '@/services/email-templates.service';

// Types
import type { ShareData, EmailShareData, EmailFormConfig } from './types';

// Components
import { TemplateSelector } from './components/TemplateSelector';
import { RecipientsList } from './components/RecipientsList';
import { MessagePreview } from './components/MessagePreview';
import { ValidationErrors } from './components/ValidationErrors';

// Hooks
import { useEmailForm } from './hooks/useEmailForm';

// ============================================================================
// INTERFACE
// ============================================================================

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
  config?: EmailFormConfig;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 📧 EmailShareForm Component - Enterprise Refactored
 *
 * Modular email sharing form με extracted components
 *
 * Features:
 * - Modular component architecture
 * - Centralized state management με hook
 * - Reusable validation logic
 * - Clean separation of concerns
 * - Enterprise-grade type safety
 */
export const EmailShareForm: React.FC<EmailShareFormProps> = ({
  shareData,
  onEmailShare,
  onBack,
  loading = false,
  error,
  config = {}
}) => {
  // ============================================================================
  // FORM STATE & LOGIC
  // ============================================================================

  const {
    state,
    actions,
    computed,
    computedExtended,
    validateForm,
    prepareEmailData,
    config: finalConfig
  } = useEmailForm(config);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * 📤 Handle form submission
   */
  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    // Prepare email data
    const emailData = prepareEmailData(shareData);
    if (!emailData) {
      return;
    }

    try {
      await onEmailShare(emailData);
    } catch (err) {
      // Error handled by parent
    }
  };

  /**
   * 💬 Handle personal message change
   */
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    actions.setPersonalMessage(e.target.value);
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const availableTemplates = EmailTemplatesService.getAllTemplates();
  const currentTemplate = availableTemplates.find(t => t.id === state.selectedTemplate);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="text-center">
        <div className={designSystem.cn(
          "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3",
          designSystem.getStatusColor('info', 'bg')
        )}>
          <Mail className="w-6 h-6 text-white" />
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
        <TemplateSelector
          selectedTemplate={state.selectedTemplate}
          onTemplateChange={actions.setSelectedTemplate}
          disabled={loading}
          show={finalConfig.showTemplateSelector}
        />

        {/* RECIPIENTS LIST */}
        <RecipientsList
          recipients={state.recipients}
          onRecipientsChange={(recipients) => {
            // Use internal action for proper state management
            actions.resetForm();
            recipients.forEach((recipient, index) => {
              if (index === 0) {
                actions.updateRecipient(0, recipient);
              } else {
                actions.addRecipient();
                actions.updateRecipient(index, recipient);
              }
            });
          }}
          maxRecipients={finalConfig.maxRecipients}
          disabled={loading}
          validateEmails={finalConfig.validateRecipients}
          showValidation={true}
        />

        {/* PERSONAL MESSAGE */}
        <div>
          <Label className={designSystem.cn(
            "flex items-center gap-2 mb-2",
            designSystem.getTypographyClass('sm', 'medium')
          )}>
            <MessageCircle className="w-4 h-4" />
            Προσωπικό Μήνυμα (προαιρετικό)
          </Label>
          <Textarea
            placeholder="Προσθέστε ένα προσωπικό μήνυμα..."
            value={state.personalMessage}
            onChange={handleMessageChange}
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
              customLabel={`${computed.remainingChars} χαρακτήρες`}
              variant={computed.remainingChars < 50 ? "destructive" : "secondary"}
              className={designSystem.getTypographyClass('xs')}
            />
          </div>
        </div>

        {/* MESSAGE PREVIEW */}
        <MessagePreview
          message={state.personalMessage}
          templateName={currentTemplate?.name}
          show={!!state.personalMessage.trim()}
        />

        {/* VALIDATION ERRORS */}
        <ValidationErrors
          error={state.validationError}
          backendError={error}
          show={!!(state.validationError || error)}
        />

        {/* ACTION BUTTONS */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            onClick={onBack}
            variant="outline"
            disabled={loading}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Πίσω
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!computed.isFormValid || loading}
            className="flex-1"
          >
            {loading ? 'Αποστολή...' :
              `Αποστολή (${computed.validEmailCount})`
            }
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * 🔄 Legacy useEmailValidation Hook Export
 * Maintains backward compatibility
 */
export { useEmailValidation } from './hooks/useEmailValidation';

// ============================================================================
// EXPORTS
// ============================================================================

export default EmailShareForm;