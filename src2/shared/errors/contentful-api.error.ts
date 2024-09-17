export class ContentfulAPIError extends Error {
    constructor(message: string) {
      super(`Contentful API Error: ${message}`);
      this.name = 'ContentfulAPIError';
    }