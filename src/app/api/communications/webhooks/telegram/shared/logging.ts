// /home/user/studio/src/app/api/communications/webhooks/telegram/shared/logging.ts

export const log = {
    info: (message: string, ...args: any[]) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(`[ERROR] ${message}`, ...args);
    }
};
