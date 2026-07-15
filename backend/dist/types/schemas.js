import { z } from 'zod';
export const LogLevelSchema = z.enum(['INFO', 'WARN', 'ERROR', 'DEBUG']);
export const LogEntrySchema = z.object({
    timestamp: z.string(),
    level: LogLevelSchema,
    eventType: z.string().optional(),
    patientId: z.string().optional(),
    facilityId: z.string().optional(),
    orgUuid: z.string().optional(),
    message: z.string(),
    endpoint: z.string().optional(),
    duration: z.number().optional(),
    status: z.union([z.string(), z.number()]).optional(),
    page: z.number().int().nonnegative(),
    lineNum: z.number().int().nonnegative(),
    webhookId: z.string().optional(),
    rawJson: z.string().optional(),
    rawMessage: z.string()
});
export const AnalysisSettingsSchema = z.object({
    knownFacilities: z.array(z.string()).optional(),
    slowWebhookThresholdMs: z.number().optional().default(5000),
    slowApiThresholdMs: z.number().optional().default(1000)
});
