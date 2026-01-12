"use client";
import { Mail, Send, X } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSendEmailModal } from "./hooks/useSendEmailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HOVER_TEXT_EFFECTS, HOVER_BORDER_EFFECTS, TRANSITION_PRESETS } from "@/components/ui/effects";

interface SendEmailModalProps {
  lead: { id: string; fullName: string; email: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onEmailSent?: () => void;
}

export default function SendEmailModal({ lead, isOpen, onClose, onEmailSent }: SendEmailModalProps) {
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    formData, templates, loading,
    handleTemplateChange, handleChange, handleSubmit
  } = useSendEmailModal(lead, onClose, onEmailSent);

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${colors.bg.primary} ${radius.lg} shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 ${getStatusBorder('muted')} border-b">
          <div className="flex items-center gap-3">
            <Mail className={`${iconSizes.lg} ${colors.text.info}`} />
            <div>
              <h3 className="text-lg font-semibold">Αποστολή Email</h3>
              <p className={`text-sm ${colors.text.muted}`}>Προς: {lead.fullName} ({lead.email})</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 ${HOVER_TEXT_EFFECTS.GRAY_600_TO_800} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
            <X className={iconSizes.md} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className={`block text-sm font-medium ${colors.text.secondary} mb-3`}>Επιλέξτε Τύπο Email</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateChange(template.id)}
                  className={`p-3 border ${radius.lg} text-left ${TRANSITION_PRESETS.STANDARD_COLORS} ${
                    formData.templateType === template.id ? `${getStatusBorder('info')} ${colors.bg.infoSubtle}` : `${quick.card} ${HOVER_BORDER_EFFECTS.GRAY_400}`
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <template.icon className={iconSizes.sm} />
                    <span className="font-medium">{template.name}</span>
                  </div>
                  <p className={`text-xs ${colors.text.muted}`}>{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.secondary} mb-1`}>Θέμα Email *</label>
            <Input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              className="w-full"
              placeholder="Εισάγετε θέμα email..."
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.secondary} mb-1`}>Περιεχόμενο Email *</label>
            <Textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={12}
              className="w-full"
              placeholder="Εισάγετε το περιεχόμενο του email..."
            />
          </div>

          <div className="flex gap-3 pt-4 ${getStatusBorder('muted')} border-t">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Send className={iconSizes.sm} />
              {loading ? 'Αποστολή...' : 'Αποστολή Email'}
            </Button>
            <Button type="button" onClick={onClose} variant="outline">
              Άκυρο
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
