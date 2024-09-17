export class ShopifyAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopifyAPIError';
  }
}
