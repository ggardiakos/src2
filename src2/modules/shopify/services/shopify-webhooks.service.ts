import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopifyService } from './shopify.service';
import { RedisService } from '../../redis/redis.service';
import { QueueService } from '../../queue/queue.service';
import { ContentfulService } from '../../contentful/contentful.service';
import * as Sentry from '@sentry/node';
import { Product } from '../graphql/schemas';
import { CreateProductInput } from '../graphql/dto/create-product.input';
import { validateWebhookPayload } from '../utils/webhook-validator';
import { WebhookProcessingError } from '../errors/webhook-processing.error';
import { retry } from 'ts-retry-promise';
import { metrics } from '../../common/metrics';

@Injectable()
export class ShopifyWebhooksService {
  private readonly logger = new Logger(ShopifyWebhooksService.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly contentfulService: ContentfulService,
    private readonly configService: ConfigService,
  ) {}

  @metrics.measure
  async handleProductCreate(payload: any, shop: string): Promise<void> {
    const startTime = Date.now();
    try {
      validateWebhookPayload(payload);
      const productId = payload.id;
      this.logger.log(
        `Processing PRODUCTS_CREATE for Product ID: ${productId} from shop: ${shop}`,
      );

      await this.redisService.del(`product:${productId}`);

      const product: Product = await retry(
        () => this.shopifyService.getProductById(productId),
        { retries: 3 },
      );
      if (!product) {
        throw new WebhookProcessingError(
          `Product with ID ${productId} not found.`,
        );
      }

      const contentfulProductInput: CreateProductInput = {
        title: product.title,
        description: product.description,
        // Map other necessary fields
      };
      await this.contentfulService.createProduct(contentfulProductInput);

      await this.queueService.addTask({
        type: 'send-email',
        payload: {
          to: this.configService.get<string>('ADMIN_EMAIL'),
          subject: 'New Product Created',
          body: `A new product "${product.title}" has been created.`,
        },
      });

      this.logger.log(
        `Successfully processed PRODUCTS_CREATE for Product ID: ${productId}`,
      );
    } catch (error) {
      this.logger.error('Error processing PRODUCTS_CREATE webhook', error);
      Sentry.captureException(error);
      throw new WebhookProcessingError(
        'Failed to process PRODUCTS_CREATE webhook',
        error,
      );
    } finally {
      metrics.record('webhook_processing_time', Date.now() - startTime);
    }
  }

  // Other methods...
}
