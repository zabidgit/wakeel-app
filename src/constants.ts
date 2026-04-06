/** Base URL for the Wakeel provisioning/push/upload server */
export const PROVISION_API_URL = 'https://app.getwakeel.app';

/** Maximum number of retries for failed messages */
export const MAX_MESSAGE_RETRIES = 3;

/** Content dedup window in milliseconds */
export const CONTENT_DEDUP_WINDOW_MS = 30 * 1000;

/** Maximum messages to keep in storage per chat */
export const MAX_STORED_MESSAGES = 500;

/** Streaming message timeout in milliseconds (5 minutes) */
export const STREAMING_TIMEOUT_MS = 5 * 60 * 1000;
