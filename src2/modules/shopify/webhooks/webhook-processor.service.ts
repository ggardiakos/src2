import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';
import { ShopifyWebhookTypes as BaseShopifyWebhookTypes } from '@nestjs-shopify/webhooks';
type ShopifyWebhookTypes = BaseShopifyWebhookTypes;
import { ShopifyWebhooksService } from '../services/shopify-webhooks.service';
import { HttpService } from '@nestjs/axios'; // Import HttpService for HTTP requests

@Injectable()
export class ShopifyWebhookProcessorService {
  private readonly logger = new Logger(ShopifyWebhookProcessorService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly shopifyWebhooksService: ShopifyWebhooksService,
    private readonly httpService: HttpService, // Inject HttpService
  ) {}

  async queueWebhook(
    type: ShopifyWebhookTypes,
    payload: any,
    shop: string,
  ): Promise<void> {
    const jobId = await this.queueService.addJob('shopify-webhook', {
      type,
      payload,
      shop,
    });
    this.logger.log(`Queued webhook job ${jobId} for ${type} from ${shop}`);
  }

  async handleWebhookJob(job: {
    type: ShopifyWebhookTypes;
    payload: any;
    shop: string;
  }): Promise<void> {
    this.logger.log(
      `Processing queued webhook job for ${job.type} from ${job.shop}`,
    );

    try {
      switch (job.type) {
        case ShopifyWebhookTypes.ProductsCreate:
          await this.shopifyWebhooksService.handleProductCreate(
            job.payload,
            job.shop,
          );
          break;
        case ShopifyWebhookTypes.ProductsUpdate:
          await this.shopifyWebhooksService.handleProductUpdate(
            job.payload,
            job.shop,
          );
          break;
        // Add cases for other webhook types as needed
        default:
          this.logger.warn(`Unhandled webhook type: ${job.type}`);
      }

      // Example HTTP request using HttpService
      // await this.httpService.post('https://your-endpoint.com/webhook', {
      //   type: job.type,
      //   shop: job.shop,
      //   payload: job.payload,
      // }).toPromise();

    } catch (error) {
      this.logger.error(
        `Error processing webhook job: ${error.message}`,
        error.stack,
      );
      // You might want to implement retry logic or error reporting here
    }
  }
}
