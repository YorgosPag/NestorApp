import { Mail, FileText, Users, Calendar } from "lucide-react";
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// Note: Components should translate these keys at render time using t()
export const emailTemplates = (fullName?: string) => ([
  { id: "welcome",    name: "email.templates.welcome.name",     icon: Users,    description: "email.templates.welcome.description", defaultSubject: "email.templates.welcome.subject" },
  { id: "followup",   name: "email.templates.followup.name",    icon: Mail,     description: "email.templates.followup.description", defaultSubject: "email.templates.followup.subject" },
  { id: "appointment",name: "email.templates.appointment.name", icon: Calendar, description: "email.templates.appointment.description", defaultSubject: "email.templates.appointment.subject" },
  { id: "proposal",   name: "email.templates.proposal.name",    icon: NAVIGATION_ENTITIES.unit.icon, description: "email.templates.proposal.description", defaultSubject: "email.templates.proposal.subject" },
  { id: "custom",     name: "email.templates.custom.name",      icon: FileText, description: "email.templates.custom.description", defaultSubject: "" },
]);

// 🌐 i18n: Template content keys - 2026-01-18
// Note: Full template bodies should be stored in translation files for each locale
// Components should call t('email.templates.welcome.body', { fullName, phone }) etc.
export const getTemplateContent = (templateId: string, fullName?: string) => {
  // Return i18n keys for template content
  // The actual content should be in translation files with interpolation support
  const map: Record<string, string> = {
    welcome: "email.templates.welcome.body",
    followup: "email.templates.followup.body",
    appointment: "email.templates.appointment.body",
    proposal: "email.templates.proposal.body",
    custom: "",
  };
  return map[templateId] ?? "";
};
