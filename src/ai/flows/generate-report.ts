
'use server';
/**
 * @fileOverview An AI agent for generating reports from natural language queries.
 * - generateReport - A function that handles the report generation process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getContacts, getProjects } from '@/lib/mock-data';
import type { AIReportOutput } from '@/types';

const reportComponentSchema = z.union([
    z.object({
        type: z.literal('table'),
        data: z.object({
            title: z.string().describe("The title of the table."),
            headers: z.array(z.string()).describe("The headers for the table columns."),
            rows: z.array(z.array(z.union([z.string(), z.number()]))).describe("The data rows for the table."),
        }),
    }),
    z.object({
        type: z.literal('chart'),
        data: z.object({
            title: z.string().describe("The title of the chart."),
            type: z.enum(['bar', 'pie']).describe("The type of chart to display."),
            data: z.array(z.object({
                name: z.string().describe("The label for the data point (e.g., x-axis label for bar chart, slice label for pie chart)."),
                value: z.number().describe("The numerical value for the data point."),
            })).describe("The data points for the chart."),
        }),
    }),
    z.object({
        type: z.literal('kpi'),
        data: z.object({
            title: z.string().describe("The main title of the Key Performance Indicator."),
            value: z.string().describe("The primary value of the KPI (e.g., '12', '€2.5M', '85%')."),
            description: z.string().describe("A brief description or context for the KPI."),
        }),
    })
]);

const reportOutputSchema = z.object({
    title: z.string().describe("The overall title for the generated report."),
    components: z.array(reportComponentSchema).describe("An array of components (tables, charts, KPIs) to be rendered in the report."),
});

const generateReportFlow = ai.defineFlow(
    {
        name: 'generateReportFlow',
        inputSchema: z.string(),
        outputSchema: reportOutputSchema,
    },
    async (query: string) => {
        // 🔥 ΦΟΡΤΩΣΗ ΠΡΑΓΜΑΤΙΚΩΝ ΔΕΔΟΜΕΝΩΝ ΑΠΟ FIREBASE
        const [projects, contacts] = await Promise.all([
            getProjects(50), // Φόρτωση 50 τελευταίων projects
            getContacts(50)  // Φόρτωση 50 τελευταίων επαφών
        ]);

        const reportPrompt = ai.definePrompt({
            name: 'reportGeneratorPrompt',
            input: { schema: z.string() },
            output: { schema: reportOutputSchema },
            prompt: `You are an expert data analyst for a project management application. Your task is to answer user queries by generating a structured report from the provided data.

            DATA CONTEXT:
            You have access to a list of projects and contacts loaded from production database.
            - Project fields: id, title, description, ownerContactId, status, progress, deadline, budget, interventions (list of {id, title, subInterventions: list of {id, code, description, approvedPrice, costOfMaterials, costOfLabor}, stages: list of {id, title, status, assigneeContactId, supervisorContactId}}).
            - Contact fields: id, personal (firstName, lastName), job (role).

            USER QUERY:
            "{{{query}}}"

            AVAILABLE PRODUCTION DATA:
            - Projects: ${JSON.stringify(projects, null, 2)}
            - Contacts: ${JSON.stringify(contacts, null, 2)}

            INSTRUCTIONS:
            1.  Analyze the user's query to understand the required information.
            2.  Process the provided JSON data to extract and calculate the necessary information.
            3.  Construct a report using a combination of tables, charts (pie or bar), and KPIs.
            4.  Choose the best visualization type for the data. For example:
                - Use a 'table' for detailed lists (e.g., "List all active projects").
                - Use a 'pie' chart for status distributions (e.g., "Show project status breakdown").
                - Use a 'bar' chart for comparisons (e.g., "Top 5 projects by budget").
                - Use a 'kpi' for single, important metrics (e.g., "Total number of projects").
            5.  Ensure all titles, headers, and labels are in Greek.
            6.  Return the final report in the specified JSON format. The 'value' in chart data must be a number.
            `,
        });

        const { output } = await reportPrompt(query);
        return output!;
    }
);

export async function generateReport(query: string): Promise<AIReportOutput> {
    return generateReportFlow(query);
}
