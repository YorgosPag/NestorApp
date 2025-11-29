'use client';

import React from 'react';
import { X, Copy, Share2, ExternalLink, Mail, Users, MessageCircle, Plus, Trash2, ArrowLeft, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommonBadge } from '@/core/badges';
import { cn } from '@/lib/utils';
import { getSocialShareUrls, trackShareEvent } from '@/lib/share-utils';
import { EmailTemplatesService } from '@/services/email-templates.service';
import type { EmailTemplateType } from '@/types/email-templates';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: {
    title: string;
    text?: string;
    url: string;
  };
  onCopySuccess?: () => void;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
}

interface SharePlatform {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  hoverColor: string;
  needsEmail?: boolean;
}

// Professional SVG Icons (same as before)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.690"/>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073"/>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const SHARE_PLATFORMS: SharePlatform[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: WhatsAppIcon,
    color: 'bg-green-500',
    gradient: 'from-green-400 to-green-600',
    hoverColor: 'hover:bg-green-600'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: FacebookIcon,
    color: 'bg-blue-600',
    gradient: 'from-blue-500 to-blue-700',
    hoverColor: 'hover:bg-blue-700'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: TwitterIcon,
    color: 'bg-gray-900',
    gradient: 'from-gray-800 to-black',
    hoverColor: 'hover:bg-gray-800'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: LinkedInIcon,
    color: 'bg-blue-700',
    gradient: 'from-blue-600 to-blue-800',
    hoverColor: 'hover:bg-blue-800'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: TelegramIcon,
    color: 'bg-sky-500',
    gradient: 'from-sky-400 to-sky-600',
    hoverColor: 'hover:bg-sky-600'
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    color: 'bg-gray-600',
    gradient: 'from-gray-500 to-gray-700',
    hoverColor: 'hover:bg-gray-700',
    needsEmail: true
  }
];

export function ShareModal({ 
  isOpen, 
  onClose, 
  shareData, 
  onCopySuccess,
  onShareSuccess,
  onShareError
}: ShareModalProps) {
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [copiedText, setCopiedText] = React.useState(false);
  const [showEmailForm, setShowEmailForm] = React.useState(false);
  
  // Enhanced email form state
  const [emailRecipients, setEmailRecipients] = React.useState<string[]>(['']);
  const [personalMessage, setPersonalMessage] = React.useState('');
  const [selectedTemplate, setSelectedTemplate] = React.useState<EmailTemplateType>('residential');
  const [emailSending, setEmailSending] = React.useState(false);
  
  // Character limits
  const MAX_MESSAGE_LENGTH = 500;

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setShowEmailForm(false);
      setEmailRecipients(['']);
      setPersonalMessage('');
      setSelectedTemplate('residential');
      setEmailSending(false);
      setCopiedUrl(false);
      setCopiedText(false);
    }
  }, [isOpen]);

  const socialUrls = getSocialShareUrls(shareData.url, shareData.text || shareData.title);

  const handlePlatformShare = async (platformId: string) => {
    if (platformId === 'email') {
      setShowEmailForm(true);
      return;
    }

    onClose();

    try {
      const url = socialUrls[platformId as keyof typeof socialUrls];
      if (url) {
        const shareWindow = window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
        
        if (shareWindow) {
          trackShareEvent(platformId, 'property', shareData.url);
          setTimeout(() => {
            onShareSuccess?.(platformId);
          }, 1500);
        } else {
          throw new Error('Popup blocked or failed to open');
        }
      }
    } catch (error) {
      onShareError?.(platformId, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Add new email recipient
  const addEmailRecipient = () => {
    if (emailRecipients.length < 5) {
      setEmailRecipients([...emailRecipients, '']);
    }
  };

  // Remove email recipient
  const removeEmailRecipient = (index: number) => {
    if (emailRecipients.length > 1) {
      setEmailRecipients(emailRecipients.filter((_, i) => i !== index));
    }
  };

  // Update email recipient
  const updateEmailRecipient = (index: number, value: string) => {
    const newRecipients = [...emailRecipients];
    newRecipients[index] = value;
    setEmailRecipients(newRecipients);
  };

  // Validate email
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Check if form is valid
  const isFormValid = () => {
    const validEmails = emailRecipients.filter(email => email.trim() && isValidEmail(email));
    return validEmails.length > 0;
  };

  const handleEmailShare = async () => {
    const validEmails = emailRecipients.filter(email => email.trim() && isValidEmail(email));
    if (validEmails.length === 0) return;

    setEmailSending(true);
    
    try {
      // Send emails using new template-aware API
      const response = await fetch('/api/communications/email/property-share/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: validEmails,
          propertyTitle: shareData.title,
          propertyDescription: shareData.text,
          propertyUrl: shareData.url,
          personalMessage: personalMessage.trim() || undefined,
          templateType: selectedTemplate, // NEW: Template selection
          senderName: 'Nestor Construct'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Σφάλμα κατά την αποστολή');
      }

      onShareSuccess?.(`email (${validEmails.length} recipients, ${selectedTemplate} template)`);
      setShowEmailForm(false);
      setEmailRecipients(['']);
      setPersonalMessage('');
      onClose();
      
    } catch (error) {
      onShareError?.('email', error instanceof Error ? error.message : 'Email send failed');
    } finally {
      setEmailSending(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      onCopySuccess?.();
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleCopyText = async () => {
    try {
      const textToCopy = `${shareData.title}\n\n${shareData.text || ''}\n\n${shareData.url}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      onCopySuccess?.();
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const messageLength = personalMessage.length;
  const remainingChars = MAX_MESSAGE_LENGTH - messageLength;

  // Get available templates
  const availableTemplates = EmailTemplatesService.getAllTemplates();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-0 shadow-2xl">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Κοινοποίηση Ακινήτου
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {shareData.title}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!showEmailForm ? (
            <>
              {/* MAIN GRID - 6 ΚΑΡΤΕΣ */}
              <div className="grid grid-cols-3 gap-4">
                {SHARE_PLATFORMS.map((platform) => {
                  const IconComponent = platform.icon;
                  
                  return (
                    <button
                      key={platform.id}
                      onClick={() => handlePlatformShare(platform.id)}
                      className={cn(
                        'group relative overflow-hidden rounded-2xl p-4 transition-all duration-300',
                        'bg-gradient-to-br shadow-lg hover:shadow-xl transform hover:-translate-y-1',
                        'border border-white/20 hover:border-white/30',
                        platform.gradient
                      )}
                    >
                      <div className="relative z-10 flex flex-col items-center space-y-2">
                        <IconComponent className="w-8 h-8 text-white" />
                        <span className="text-xs font-medium text-white group-hover:text-white/90">
                          {platform.name}
                        </span>
                      </div>
                      
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    </button>
                  );
                })}
              </div>

              {/* COPY BUTTONS */}
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                  <Button
                    onClick={handleCopyUrl}
                    variant="outline"
                    className={cn(
                      'flex-1 h-12 rounded-xl border-2 transition-all duration-200',
                      copiedUrl 
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400'
                    )}
                  >
                    {copiedUrl ? (
                      <>
                        <span className="mr-2">✅</span>
                        Αντιγράφηκε!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Αντιγραφή Link
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleCopyText}
                    variant="outline"
                    className={cn(
                      'flex-1 h-12 rounded-xl border-2 transition-all duration-200',
                      copiedText 
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400'
                    )}
                  >
                    {copiedText ? (
                      <>
                        <span className="mr-2">✅</span>
                        Αντιγράφηκε!
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Αντιγραφή Κειμένου
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* ENHANCED EMAIL FORM WITH TEMPLATE SELECTOR */
            <div className="space-y-6">
              <div className="text-center">
                <Mail className="w-10 h-10 mx-auto text-blue-600 mb-3" />
                <h3 className="text-lg font-semibold">Αποστολή μέσω Email</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Επιλέξτε template και στείλτε το ακίνητο
                </p>
              </div>
              
              <div className="space-y-4">
                {/* TEMPLATE SELECTOR */}
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Palette className="w-4 h-4" />
                    Email Template
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        className={cn(
                          'p-3 rounded-lg border-2 transition-all text-center',
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="text-lg mb-1">{template.icon}</div>
                        <div className="text-xs font-medium">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* MULTIPLE RECIPIENTS */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Παραλήπτες Email
                    </Label>
                    {emailRecipients.length < 5 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addEmailRecipient}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
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
                          className={cn(
                            "flex-1",
                            email && !isValidEmail(email) && email.trim() !== '' 
                              ? "border-red-300 focus:border-red-500" 
                              : ""
                          )}
                        />
                        {emailRecipients.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEmailRecipient(index)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-1">
                    {emailRecipients.filter(email => email.trim() && isValidEmail(email)).length} έγκυρα email από {emailRecipients.length}
                  </div>
                </div>

                {/* PERSONAL MESSAGE */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4" />
                    Προσωπικό Μήνυμα (προαιρετικό)
                  </Label>
                  <Textarea
                    placeholder="Προσθέστε ένα προσωπικό μήνυμα..."
                    value={personalMessage}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                        setPersonalMessage(e.target.value);
                      }
                    }}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-gray-500">
                      Θα εμφανιστεί στο {availableTemplates.find(t => t.id === selectedTemplate)?.name} template
                    </div>
                    <CommonBadge
                      status="company"
                      customLabel={`${remainingChars} χαρακτήρες`}
                      variant={remainingChars < 50 ? "destructive" : "secondary"}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* MESSAGE PREVIEW */}
                {personalMessage.trim() && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                      Προεπισκόπηση μηνύματος:
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-200 italic">
                      "{personalMessage}"
                    </div>
                  </div>
                )}
                
                {/* ACTION BUTTONS */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={() => setShowEmailForm(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Πίσω
                  </Button>
                  <Button 
                    onClick={handleEmailShare}
                    disabled={!isFormValid() || emailSending}
                    className="flex-1"
                  >
                    {emailSending ? 'Αποστολή...' : 
                      `Αποστολή (${emailRecipients.filter(email => email.trim() && isValidEmail(email)).length})`
                    }
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function useShareModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return {
    isOpen,
    openModal,
    closeModal,
  };
}
