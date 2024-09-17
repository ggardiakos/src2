import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ContentfulClientApi, Entry } from 'contentful';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { InjectCache } from '@nestjs/cache-manager';
import { retry } from 'ts-retry-promise';
import * as Sentry from '@sentry/node';
import {
  Product,
  Collection,
  Order,
  ProductComparison,
  CustomizationOption,
  CustomizedProduct,
} from '../shopify/graphql/schemas';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateCollectionInput,
  OrderItemInput,
  CustomizeProductInput,
} from '../shopify/dto/create-product.input';
import { ShopifyAPIError } from '../common/errors/shopify-api.error';
import { ProductNotFoundError } from '../common/errorrs/product-not-found.error';

@Injectable()
export class ContentfulService implements OnModuleInit {
  private readonly logger = new Logger(ContentfulService.name);
  private client: ContentfulClientApi;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit() {
    this.client = createClient({
      space: this.configService.get<string>('contentful.spaceId'),
      accessToken: this.configService.get<string>('contentful.accessToken'),
      environment: this.configService.get<string>('contentful.environment'),
    });
    this.logger.log('ContentfulService initialized');
  }

  async getProducts(): Promise<Product[]> {
    const cacheKey = 'contentful_all_products';
    const cachedProducts: Product[] = await this.cacheManager.get(cacheKey);
    if (cachedProducts) {
      this.logger.debug('Cache hit for all Contentful products');
      return cachedProducts;
    }

    try {
      const entries = await retry(
        () => this.client.getEntries<Product>({ content_type: 'product' }),
        {
          maxAttempts: 3,
          delay: 1000,
          factor: 2,
          onError: (error, attempt) => {
            this.logger.warn(
              `Contentful getProducts attempt ${attempt} failed: ${error.message}`,
            );
            Sentry.captureException(error);
          },
        },
      );
      const products = entries.items.map((item) =>
        this.mapContentfulProduct(item),
      );
      await this.cacheManager.set(cacheKey, products, {
        ttl: this.configService.get<number>('contentful.cacheTtl'),
      });
      this.logger.info(
        `Fetched and cached ${products.length} products from Contentful`,
      );
      return products;
    } catch (error) {
      this.logger.error(
        `Error fetching products from Contentful: ${error.message}`,
      );
      Sentry.captureException(error);
      throw new ShopifyAPIError('Failed to fetch products from Contentful');
    }
  }

  async getProductById(id: string): Promise<Product> {
    const cacheKey = `contentful_product:${id}`;
    const cachedProduct: Product = await this.cacheManager.get(cacheKey);
    if (cachedProduct) {
      this.logger.debug(`Cache hit for Contentful product ${id}`);
      return cachedProduct;
    }

    try {
      const entry: Entry<Product> = await retry(
        () => this.client.getEntry<Product>(id),
        {
          maxAttempts: 3,
          delay: 1000,
          factor: 2,
          onError: (error, attempt) => {
            this.logger.warn(
              `Contentful getProductById attempt ${attempt} failed: ${error.message}`,
            );
            Sentry.captureException(error);
          },
        },
      );
      const product = this.mapContentfulProduct(entry);
      await this.cacheManager.set(cacheKey, product, {
        ttl: this.configService.get<number>('contentful.cacheTtl'),
      });
      this.logger.debug(`Fetched and cached Contentful product ${id}`);
      return product;
    } catch (error) {
      this.logger.error(
        `Error fetching product ${id} from Contentful: ${error.message}`,
      );
      Sentry.captureException(error);
      throw new ProductNotFoundError(id);
    }
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    try {
      const entry = await retry(
        () =>
          this.client.createEntry<Product>('product', {
            fields: {
              title: { 'en-US': input.title },
              description: { 'en-US': input.description },
              // Add other fields as necessary
            },
          }),
        {
          maxAttempts: 3,
          delay: 1000,
          factor: 2,
          onError: (error, attempt) => {
            this.logger.warn(
              `Contentful createProduct attempt ${attempt} failed: ${error.message}`,
            );
            Sentry.captureException(error);
          },
        },
      );
      const product = this.mapContentfulProduct(entry);
      this.logger.info(`Created Contentful product ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(
        `Error creating product in Contentful: ${error.message}`,
      );
      Sentry.captureException(error);
      throw new ShopifyAPIError('Failed to create product in Contentful');
    }
  }

  async updateProduct(input: UpdateProductInput): Promise<Product> {
    try {
      const entry = await retry(
        () =>
          this.client.updateEntry<Product>(input.id, {
            fields: {
              title: { 'en-US': input.title },
              description: { 'en-US': input.description },
              // Update other fields as necessary
            },
          }),
        {
          maxAttempts: 3,
          delay: 1000,
          factor: 2,
          onError: (error, attempt) => {
            this.logger.warn(
              `Contentful updateProduct attempt ${attempt} failed: ${error.message}`,
            );
            Sentry.captureException(error);
          },
        },
      );
      const updatedProduct = this.mapContentfulProduct(entry);
      await this.cacheManager.del(`contentful_product:${updatedProduct.id}`);
      this.logger.info(`Updated Contentful product ${updatedProduct.id}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error(
        `Error updating product ${input.id} in Contentful: ${error.message}`,
      );
      Sentry.captureException(error);
      throw new ShopifyAPIError(
        `Failed to update product ${input.id} in Contentful`,
      );
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      await retry(() => this.client.deleteEntry(id), {
        maxAttempts: 3,
        delay: 1000,
        factor: 2,
        onError: (error, attempt) => {
          this.logger.warn(
            `Contentful deleteProduct attempt ${attempt} failed: ${error.message}`,
          );
          Sentry.captureException(error);
        },
      });
      await this.cacheManager.del(`contentful_product:${id}`);
      this.logger.info(`Deleted Contentful product ${id}`);
    } catch (error) {
      this.logger.error(
        `Error deleting product ${id} from Contentful: ${error.message}`,
      );
      Sentry.captureException(error);
      throw new ShopifyAPIError(
        `Failed to delete product ${id} from Contentful`,
      );
    }
  }

  // Helper method to map Contentful entry to Product interface
  private mapContentfulProduct(entry: Entry<any>): Product {
    return {
      id: entry.sys.id,
      title: entry.fields.title['en-US'],
      description: entry.fields.description['en-US'],
      // Map other fields as necessary
    };
  }
}
