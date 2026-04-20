import { Logging, Entry } from '@google-cloud/logging';

/**
 * Google Cloud Operations Suite - Structured Logger
 * 
 * This logger streams structured log entries to Google Cloud Logging
 * for observability and monitoring of the Venue Copilot application.
 * Falls back to console logging in local development.
 */

let logging: Logging | null = null;

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT) {
    logging = new Logging({
      projectId: process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
} catch (error) {
  console.warn('[GCP Logger] Cloud Logging initialization bypassed for local dev.', error);
}

export type LogSeverity = 'DEFAULT' | 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface StructuredLogEntry {
  message: string;
  severity: LogSeverity;
  component?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function streamLog(entry: StructuredLogEntry): Promise<void> {
  const logName = 'venue-copilot';
  const payload = {
    message: entry.message,
    component: entry.component || 'app',
    userId: entry.userId || 'anonymous',
    timestamp: new Date().toISOString(),
    ...entry.metadata,
  };

  if (logging) {
    try {
      const log = logging.log(logName);
      const logEntry: Entry = log.entry(
        {
          resource: { type: 'global' },
          severity: entry.severity,
        },
        payload
      );
      await log.write(logEntry);
    } catch (err) {
      console.error('[GCP Logger] Failed to write to Cloud Logging:', err);
      console.log(`[${entry.severity}] ${entry.message}`, payload);
    }
  } else {
    // Fallback: structured console logging for local development
    console.log(`[${entry.severity}] [${payload.component}] ${entry.message}`, payload);
  }
}

// Convenience methods
export const logInfo = (message: string, metadata?: Record<string, unknown>) =>
  streamLog({ message, severity: 'INFO', metadata });

export const logWarning = (message: string, metadata?: Record<string, unknown>) =>
  streamLog({ message, severity: 'WARNING', metadata });

export const logError = (message: string, metadata?: Record<string, unknown>) =>
  streamLog({ message, severity: 'ERROR', metadata });
