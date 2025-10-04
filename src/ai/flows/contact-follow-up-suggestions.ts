'use server';

/**
 * @fileOverview This file defines a Genkit flow to analyze contact data and suggest follow-up actions.
 *
 * - suggestFollowUpActions - A function that generates follow-up suggestions for a contact.
 * - SuggestFollowUpActionsInput - The input type for the suggestFollowUpActions function.
 * - SuggestFollowUpActionsOutput - The return type for the suggestFollowUpActions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFollowUpActionsInputSchema = z.object({
  contactNotes: z.string().describe('Notes about the contact.'),
  activityLogs: z.string().describe('Activity logs for the contact.'),
});
export type SuggestFollowUpActionsInput = z.infer<typeof SuggestFollowUpActionsInputSchema>;

const SuggestFollowUpActionsOutputSchema = z.object({
  followUpSuggestions: z.array(z.string()).describe('Suggested follow-up actions for the contact.'),
});
export type SuggestFollowUpActionsOutput = z.infer<typeof SuggestFollowUpActionsOutputSchema>;

export async function suggestFollowUpActions(input: SuggestFollowUpActionsInput): Promise<SuggestFollowUpActionsOutput> {
  return suggestFollowUpActionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFollowUpActionsPrompt',
  input: {schema: SuggestFollowUpActionsInputSchema},
  output: {schema: SuggestFollowUpActionsOutputSchema},
  prompt: `You are an AI assistant that analyzes contact notes and activity logs to suggest relevant follow-up actions, reminders, or next steps for each contact.

  Analyze the following contact information to generate follow-up suggestions:

  Contact Notes: {{{contactNotes}}}
  Activity Logs: {{{activityLogs}}}

  Provide a list of follow-up actions that are most relevant to improving contact management and relationship-building efficiency.
  The suggestions should be actionable and specific, taking into account the information provided in the contact notes and activity logs.
  Ensure that the follow-up actions are tailored to the contact's specific needs and interests, with the goal of strengthening the relationship and achieving the user's objectives.

  Follow-up Suggestions:`, // Fixed: Added colon at the end of the prompt
});

const suggestFollowUpActionsFlow = ai.defineFlow(
  {
    name: 'suggestFollowUpActionsFlow',
    inputSchema: SuggestFollowUpActionsInputSchema,
    outputSchema: SuggestFollowUpActionsOutputSchema,
  },
  async (input: SuggestFollowUpActionsInput) => {
    const {output} = await prompt(input);
    return output!;
  }
);
