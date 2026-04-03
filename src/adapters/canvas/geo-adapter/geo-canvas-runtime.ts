import type {
  CanvasCreationConfig,
  CanvasEventData,
  CanvasMiddleware,
  CanvasPlugin,
} from '../../../core/canvas/interfaces/ICanvasProvider';
import type { CanvasInstance } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';

type EventListener = Function;

type LoggerLike = {
  error: (message: string, metadata?: Record<string, unknown>) => void;
};

export const registerEventListener = (
  eventListeners: Map<string, EventListener[]>,
  event: string,
  callback: EventListener,
): void => {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, []);
  }

  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.push(callback);
  }
};

export const unregisterEventListener = (
  eventListeners: Map<string, EventListener[]>,
  event: string,
  callback: EventListener,
): void => {
  const listeners = eventListeners.get(event);
  if (!listeners) {
    return;
  }

  const index = listeners.indexOf(callback);
  if (index > -1) {
    listeners.splice(index, 1);
  }
};

export const emitCanvasEvent = (
  eventListeners: Map<string, EventListener[]>,
  event: string,
  data: CanvasEventData,
  logger: LoggerLike,
): void => {
  const listeners = eventListeners.get(event) || eventListeners.get('*') || [];

  listeners.forEach((listener) => {
    try {
      listener(event, data);
    } catch (error) {
      logger.error(`[GeoCanvasAdapter] Event listener error for '${event}'`, { error });
    }
  });
};

export const initializePlugins = (
  plugins: CanvasPlugin[],
  provider: { id: string },
): void => {
  plugins.forEach((plugin) => {
    plugin.initialize(provider as never);
  });
};

export const cleanupPlugins = (
  plugins: CanvasPlugin[],
  logger: LoggerLike,
): void => {
  for (const plugin of plugins) {
    try {
      plugin.cleanup();
    } catch (error) {
      logger.error(`[GeoCanvasAdapter] Plugin cleanup error: ${plugin.name}`, { error });
    }
  }
};

export const applyMiddlewareHooks = (
  middlewares: CanvasMiddleware[],
  hookName: keyof CanvasMiddleware,
  logger: LoggerLike,
  canvas?: CanvasInstance | null,
  data?: { event?: string; data?: unknown } | CanvasCreationConfig,
): void => {
  const sortedMiddlewares = middlewares
    .slice()
    .sort((first, second) => (second.priority || 0) - (first.priority || 0));

  for (const middleware of sortedMiddlewares) {
    try {
      const hook = middleware[hookName] as ((firstArg: unknown, secondArg?: unknown) => void) | undefined;
      if (!hook) {
        continue;
      }

      if (canvas) {
        hook.call(middleware, canvas, data);
        continue;
      }

      const eventName = data && 'event' in data ? data.event : hookName;
      hook.call(middleware, eventName, data);
    } catch (error) {
      logger.error(`[GeoCanvasAdapter] Middleware '${middleware.name}' hook '${hookName}' error`, { error });
    }
  }
};
