'use client';

import React, { useState, useEffect } from 'react';
import '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { openContactAvatarModal, openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { UserPlus } from 'lucide-react';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  Contact,
  ContactType
} from '@/types/contacts';
import { isNonEmptyString } from '@/lib/type-guards';
import { contactImageSourceUrl, resolveContactIdentityImage } from '@/lib/contacts/contact-identity-image';
import { isIndividualContact } from '@/types/contacts';
import { getContactIcon } from '@/constants/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import { ROLE_PERSONA_TYPES } from '@/config/persona-config';
import { PersonaSelector } from '@/components/contacts/personas/PersonaSelector';
import { useContactEditFocus } from './contact-details/ContactEditFocusContext';

const logger = createModuleLogger('ContactDetailsHeader');

interface ContactDetailsHeaderProps {
  contact: Contact;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onNewContact?: () => void;
  // 🎯 NEW: Edit mode props για κουμπιά στην επικεφαλίδα
  isEditing?: boolean;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  /** ADR-332 D27 Ζ5 — τρέχει αποθήκευση: το κουμπί απενεργοποιείται και δηλώνει `aria-busy`. */
  isSaving?: boolean;
  // 🏢 ENTERPRISE: Hide edit controls on subcollection tabs (banking, files, relationships)
  hideEditControls?: boolean;
  // 🎭 ADR-121: Role persona toggle chips (SAP Business Partner pattern)
  activePersonas?: PersonaType[];
  onPersonaToggle?: (personaType: PersonaType) => void;
}

export function ContactDetailsHeader({
  contact,
  onDeleteContact,
  onNewContact,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isSaving = false,
  hideEditControls = false,
  activePersonas,
  onPersonaToggle,
}: ContactDetailsHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships', 'common-actions']);
  const photoModal = useGlobalPhotoPreview();
  const { focus } = useContactEditFocus();
  const hasFocus = focus !== null;
  const type = contact.type as ContactType;

  // 🔥 FORCE RE-RENDER: Key-based avatar invalidation
  const [avatarKey, setAvatarKey] = useState(0);

  // Listen για force avatar re-render events
  useEffect(() => {
    const handleForceRerender = (event: CustomEvent) => {
      const { contactId } = event.detail;
      if (contactId === contact.id) {
        logger.info('Force re-rendering avatar for contact', { contactId });
        setAvatarKey(prev => prev + 1); // Force re-render με νέο key
      }
    };

    window.addEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    return () => {
      window.removeEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    };
  }, [contact.id]);
  const Icon = getContactIcon(type);

  // 🖼️ ADR-190 §Display — η εικόνα ταυτότητας από τον ΕΝΑ επιλυτή (ίδιος με πλέγμα και λίστα).
  const avatar = resolveContactIdentityImage(contact);
  const displayName = avatar.name;
  // Το ωμό URL (χωρίς παράμετρο έκδοσης) — αυτό συγκρίνεται με τα στοιχεία της συλλογής.
  const sourceUrl = contactImageSourceUrl(contact);
  const photoURL = isIndividualContact(contact) ? contact.photoURL : undefined;
  const logoURL = isIndividualContact(contact) ? undefined : contact.logoURL;
  const multiplePhotoURLs = isIndividualContact(contact) ? contact.multiplePhotoURLs : undefined;

  // Handler για άνοιγμα photo modal με smart gallery logic για όλους τους τύπους
  const handleAvatarClick = () => {
    if (!sourceUrl) return;

    // 🎯 SMART LOGIC: Gallery navigation για Individual με multiplePhotoURLs
    if (type === 'individual' && multiplePhotoURLs && multiplePhotoURLs.length > 0) {
      const validPhotos = multiplePhotoURLs.filter(isNonEmptyString);
      const currentPhotoIndex = validPhotos.findIndex((url) => url === sourceUrl);
      openGalleryPhotoModal(photoModal, contact, currentPhotoIndex >= 0 ? currentPhotoIndex : 0);

    } else if (type === 'company' || type === 'service') {
      // Πλοήγηση συλλογής για εταιρεία/υπηρεσία: [logoURL, photoURL] (ήταν δύο ταυτόσημα σκέλη, CHECK 3.28).
      const validPhotos = [logoURL, photoURL].filter(isNonEmptyString);
      if (validPhotos.length > 1) {
        const currentPhotoIndex = validPhotos.findIndex((url) => url === sourceUrl);
        const galleryContact = { ...contact, multiplePhotoURLs: validPhotos } as Contact;
        openGalleryPhotoModal(photoModal, galleryContact, currentPhotoIndex >= 0 ? currentPhotoIndex : 0);
      } else {
        openContactAvatarModal(photoModal, contact, sourceUrl === logoURL ? 'logo' : 'avatar');
      }

    } else {
      // Fallback για Individual χωρίς multiple photos ή other types
      openContactAvatarModal(photoModal, contact, 'avatar');
    }
  };


  return (
    <>
      {/* 📱 Καμία απόκρυψη σε κινητό (ADR-912 §12): στο φύλλο οι ενέργειες πάνε στην μπάρα του· οι ρόλοι μένουν ορατοί. */}
      <div>
        <EntityDetailsHeader
          key={`contact-header-${contact.id}-${avatarKey}`}
          icon={Icon}
          title={displayName}
          avatar={avatar}
          onAvatarClick={sourceUrl ? handleAvatarClick : undefined}
          avatarActivateLabel={t(
            avatar.kind === 'person' ? 'contacts-core:header.avatar.openPhoto' : 'contacts-core:header.avatar.openLogo',
            { name: displayName },
          )}
          actions={
            // ADR-317: Adaptive actions — inline sub-form focus wins over global edit mode.
            // When an inline form is active (e.g. BankAccountForm), Save/Cancel delegate to it
            // and global actions are hidden so the user cannot lose unsaved focused work.
            hasFocus && focus
              ? [
                  createEntityAction('save', t('header.actions.save'), () => { void focus.submit(); }),
                  // `discards: true`: η εστιασμένη υποφόρμα δεν δηλώνει ακόμη αν έχει αλλαγές ⇒ ο ✕ του φύλλου ρωτά πάντα (ADR-912 §12.5).
                  createEntityAction('cancel', t('header.actions.cancel'), () => focus.cancel(), { discards: true }),
                ]
              : [
                  // 🆕 New Contact button - always visible
                  ...(onNewContact ? [
                    createEntityAction('new', t('header.newContact'), () => onNewContact(), { icon: UserPlus })
                  ] : []),
                  // 🎯 Edit — only on contact-data tabs (not subcollection tabs, which own their CRUD)
                  ...(!isEditing && !hideEditControls && onStartEdit ? [
                    createEntityAction('edit', t('header.actions.edit'), () => onStartEdit())
                  ] : []),
                  // 🏢 ENTERPRISE: Save/Cancel — hidden on subcollection tabs (e.g. Relationships)
                  // These tabs have their own save mechanism; showing contact Save causes confusion
                  // ADR-332 D27 Ζ5 — όσο τρέχει η αποθήκευση το κουμπί το **λέει** και δεν ξαναπατιέται·
                  // η «Ακύρωση» επίσης κλειδώνει: ακύρωση στη μέση μιας εγγραφής δεν ακυρώνει τίποτα,
                  // απλώς μπερδεύει. Το κλειδί ετικέτας είναι το **υπάρχον** SSoT της δημιουργίας.
                  ...(isEditing && !hideEditControls ? [
                    createEntityAction('save', t('header.actions.save'), () => onSaveEdit?.(), {
                      pending: isSaving,
                      pendingLabel: t('common-actions:actions.save_loading'),
                    }),
                    createEntityAction('cancel', t('header.actions.cancel'), () => onCancelEdit?.(), {
                      disabled: isSaving,
                    })
                  ] : []),
                  // Delete — always visible
                  ...(onDeleteContact ? [
                    createEntityAction('delete', t('header.actions.delete'), () => onDeleteContact?.())
                  ] : [])
                ]
          }
          variant="detailed"
        />

        {/* 🎭 ADR-121: Role persona chips — SAP Business Partner pattern */}
        {isIndividualContact(contact) && onPersonaToggle && (
          <PersonaSelector
            activePersonas={activePersonas ?? []}
            onToggle={onPersonaToggle}
            visibleTypes={ROLE_PERSONA_TYPES}
            disabled={false}
            className="px-6 pb-3 -mt-2"
          />
        )}
      </div>

      {/* ✅ PhotoPreviewModal τώρα global - δεν χρειάζεται εδώ */}
    </>
  );
}
