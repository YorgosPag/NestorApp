// src/services/email.service.ts
// Placeholder email service to satisfy dependencies.
// In a real application, this would integrate with a service like SendGrid, Mailgun, or EmailJS.

interface EmailPayload {
    to: string;
    toName: string;
    subject: string;
    message: string;
    leadId?: string;
    templateType?: string;
}

const mockSend = async (payload: any) => {
    // Debug logging removed
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    // Debug logging removed
    return { success: true };
};

export const emailService = {
    sendEmail: async (payload: EmailPayload) => {
        // Here you would implement the logic to send a custom email.
        return mockSend(payload);
    },

    sendWelcomeEmail: async (lead: { fullName: string, email: string }) => {
        // Logic specific to sending a welcome email template
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: `Καλώς ήρθατε ${lead.fullName}!`,
            message: "This is a mock welcome email.",
            templateType: 'welcome'
        });
    },

    sendFollowUpEmail: async (lead: { fullName: string, email: string }, message: string) => {
        // Logic for follow-up
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Follow-up",
            message: message,
            templateType: 'followup'
        });
    },
    
    sendAppointmentEmail: async (lead: { fullName: string, email: string }, customData: Record<string, any>) => {
        // Logic for appointment email
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Appointment Confirmation",
            message: `Mock appointment details: ${JSON.stringify(customData)}`,
            templateType: 'appointment'
        });
    },
    
    sendPropertyProposal: async (lead: { fullName: string, email: string }, customData: Record<string, any>) => {
        // Logic for property proposal
        return mockSend({
            to: lead.email,
            toName: lead.fullName,
            subject: "Property Proposal",
            message: `Mock property proposal: ${JSON.stringify(customData)}`,
            templateType: 'proposal'
        });
    },
};
