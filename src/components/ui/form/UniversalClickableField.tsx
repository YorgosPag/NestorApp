'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { HOVER_TEXT_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// ============================================================================
// 🏢 ENTERPRISE UNIVERSAL CLICKABLE FIELD RENDERER
// ============================================================================

/**
 * 🎯 UNIVERSAL CLICKABLE FIELD COMPONENT
 *
 * ΕΞΑΛΕΙΦΕΙ την διασπορά μεταξύ Individual, Company, Service contacts.
 *
 * ΠΡΟΒΛΗΜΑ ΔΙΑΣΠΟΡΑΣ ΠΟΥ ΛΥΝΕΙ:
 * ❌ IndividualFormRenderer - δική του clickable logic
 * ❌ ServiceFormRenderer - δική του clickable logic
 * ❌ GenericFormRenderer - δική του clickable logic
 * ❌ Διαφορετική συμπεριφορά ανάλογα με contact type
 *
 * ΛΥΣΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗΣ:
 * ✅ ΕΝΑ και ΜΟΝΑΔΙΚΟ component για clickable fields
 * ✅ ΙΔΙΑ συμπεριφορά για ΟΛΟΥΣ τους contact types
 * ✅ Centralized logic για email/phone/website links
 * ✅ Enterprise-class consistency
 */

export interface UniversalClickableFieldProps {
  /** Field unique identifier */
  id: string;
  /** Field name for form handling */
  name: string;
  /** Input type (email, tel, url, text, etc.) */
  type: string;
  /** Current field value */
  value: string;
  /** Placeholder text */
  placeholder?: string;
  /** Field is disabled (view mode) */
  disabled?: boolean;
  /** Field is required */
  required?: boolean;
  /** Field is readonly */
  readonly?: boolean;
  /** Max length */
  maxLength?: number;
  /** CSS classes */
  className?: string;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * 🎯 UNIVERSAL CLICKABLE FIELD
 *
 * Renders clickable links when disabled AND has value.
 * Renders normal input when enabled OR has no value.
 *
 * GUARANTEED CONSISTENCY across ALL contact types.
 */
export function UniversalClickableField({
  id,
  name,
  type,
  value,
  placeholder,
  disabled = false,
  required = false,
  readonly = false,
  maxLength,
  className,
  onChange
}: UniversalClickableFieldProps) {

  // 🎯 CLICKABLE LOGIC: Only when disabled AND has value
  const shouldBeClickable = disabled && value && value.trim() !== '';

  if (shouldBeClickable) {
    return renderClickableLink(type, value, id);
  }

  // 📝 NORMAL INPUT: For edit mode or empty values
  return (
    <Input
      id={id}
      name={name}
      type={getInputType(type)}
      value={value}
      onChange={onChange}
      disabled={disabled}
      readOnly={readonly}
      required={required}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  );
}

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================

/**
 * 🔗 Render clickable link based on field type
 */
function renderClickableLink(type: string, value: string, fieldId: string): React.ReactNode {
  const { t } = useTranslation('common');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // 🎨 ENTERPRISE DISABLED INPUT STYLING - Centralized pattern
  // Uses bg-muted/50 to match disabled Input/Select/Combobox across the app
  const disabledInputClasses = `min-h-10 flex items-center px-3 py-2 ${quick.input} ${colors.bg.disabled} text-sm`;
  // 📧 EMAIL LINK - Always use Gmail web interface
  if (type === 'email') {
    return (
      <div className={disabledInputClasses}>
        <a
          href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(value)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`cursor-pointer ${HOVER_TEXT_EFFECTS.BLUE_WITH_UNDERLINE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          onClick={(e) => e.stopPropagation()}
          title={t('clickableField.sendEmail', { value })}
          data-field-id={fieldId}
          data-field-type="email"
        >
          {value}
        </a>
      </div>
    );
  }

  // 📞 PHONE LINK - Use tel: protocol
  if (type === 'tel') {
    return (
      <div className={disabledInputClasses}>
        <a
          href={`tel:${value}`}
          className={`cursor-pointer ${HOVER_TEXT_EFFECTS.BLUE_WITH_UNDERLINE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          onClick={(e) => e.stopPropagation()}
          title={t('clickableField.call', { value })}
          data-field-id={fieldId}
          data-field-type="phone"
        >
          {value}
        </a>
      </div>
    );
  }

  // 🌐 WEBSITE LINK - Handle URL formatting
  if (type === 'url' || type === 'website') {
    const websiteUrl = value.startsWith('http') ? value : `https://${value}`;
    return (
      <div className={disabledInputClasses}>
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`cursor-pointer ${HOVER_TEXT_EFFECTS.BLUE_WITH_UNDERLINE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          onClick={(e) => e.stopPropagation()}
          title={t('clickableField.openWebsite', { value })}
          data-field-id={fieldId}
          data-field-type="website"
        >
          {value}
        </a>
      </div>
    );
  }

  // 📝 FALLBACK - Other field types as disabled input
  return (
    <div className={`${disabledInputClasses} text-muted-foreground`}>
      {value}
    </div>
  );
}

/**
 * 🎯 Map field type to HTML input type
 */
function getInputType(fieldType: string): string {
  switch (fieldType) {
    case 'email': return 'email';
    case 'tel': return 'tel';
    case 'url':
    case 'website': return 'url';
    case 'date': return 'date';
    case 'number': return 'number';
    case 'password': return 'password';
    default: return 'text';
  }
}

// ============================================================================
// CONVENIENCE COMPONENTS για specific use cases
// ============================================================================

export interface ClickableEmailFieldProps extends Omit<UniversalClickableFieldProps, 'type'> {}
export function ClickableEmailField(props: ClickableEmailFieldProps) {
  return <UniversalClickableField {...props} type="email" />;
}

export interface ClickablePhoneFieldProps extends Omit<UniversalClickableFieldProps, 'type'> {}
export function ClickablePhoneField(props: ClickablePhoneFieldProps) {
  return <UniversalClickableField {...props} type="tel" />;
}

export interface ClickableWebsiteFieldProps extends Omit<UniversalClickableFieldProps, 'type'> {}
export function ClickableWebsiteField(props: ClickableWebsiteFieldProps) {
  return <UniversalClickableField {...props} type="url" />;
}