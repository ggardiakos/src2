export class WebhookProcessingError extends Error {
  constructor(webhookType: string, message: string) {
    super(`Error processing ${webhookType} webhook: ${message}`);
    this.name = 'WebhookProcessingError';
  }
}
