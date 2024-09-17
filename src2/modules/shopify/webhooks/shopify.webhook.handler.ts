import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  WebhookHandler,
  OnShopifyWebhook,
  ShopifyWebhookTypes,
} from '@nestjs-shopify/webhooks';
import { ShopifyWebhooksService } from '../services/shopify-webhooks.service';
import { Request } from 'fastify';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ShopifyWebhookHandler implements OnShopifyWebhook {
  private readonly logger = new Logger(ShopifyWebhookHandler.name);

  constructor(
    private readonly shopifyWebhooksService: ShopifyWebhooksService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates the HMAC signature of the incoming webhook.
   * @param req - The incoming request.
   * @param body - The raw body of the request.
   * @returns True if valid, false otherwise.
   */
  private verifyHmac(req: Request, body: string): boolean {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
    const secret = this.configService.get<string>('shopify.apiSecret');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    return hash === hmacHeader;
  }

  @WebhookHandler(ShopifyWebhookTypes.ProductsCreate)
  async handleProductsCreate(req: Request, payload: any, shop: string) {
    const body = (req as any).rawBody; // Access the raw body captured in main.ts
    if (!this.verifyHmac(req, body)) {
      this.logger.warn('Invalid HMAC for PRODUCTS_CREATE webhook');
      throw new BadRequestException('Invalid HMAC signature');
    }
    this.logger.log(`Received PRODUCTS_CREATE webhook from ${shop}`);
    await this.shopifyWebhooksService.handleProductCreate(payload, shop);
  }

  @WebhookHandler(ShopifyWebhookTypes.ProductsUpdate)
  async handleProductsUpdate(req: Request, payload: any, shop: string) {
    const body = (req as any).rawBody; // Access the raw body captured in main.ts
    if (!this.verifyHmac(req, body)) {
      this.logger.warn('Invalid HMAC for PRODUCTS_UPDATE webhook');
      throw new BadRequestException('Invalid HMAC signature');
    }
    this.logger.log(`Received PRODUCTS_UPDATE webhook from ${shop}`);
    await this.shopifyWebhooksService.handleProductUpdate(payload, shop);
  }

  // Add more webhook handlers with HMAC verification as needed
}
