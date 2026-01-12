// /home/user/studio/src/app/api/communications/webhooks/telegram/shared/logging.ts

export const log = {
    info: (message: string, ...args: unknown[]) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
        console.error(`[ERROR] ${message}`, ...args);
    }
};
