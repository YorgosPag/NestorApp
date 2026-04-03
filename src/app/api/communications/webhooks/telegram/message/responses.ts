/**
 * 🤖 TELEGRAM BOT RESPONSE BUILDERS
 *
 * Facade over Telegram response modules.
 */

export {
  createContactResponse,
  createDatabaseUnavailableResponse,
  createDefaultResponse,
  createErrorResponse,
  createHelpResponse,
  createNoResultsResponse,
  createRateLimitResponse,
  createSearchMenuResponse,
  createStartResponse,
  createTooGenericResponse,
  createTooManyResultsResponse,
} from './responses/response-builders';

export {
  createContactNotRecognizedResponse,
  createNoLinkedUnitsResponse,
  createPersonaAwareResponse,
  createPipelineRetryFailedResponse,
} from './responses/response-persona';
