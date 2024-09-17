import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ShopifyService } from '@nestjs-shopify/core';
import DataLoader from 'dataloader';
import { Product, CreateProductInput, UpdateProductInput } from '@nestjs-shopify/core';
import { ShopifyAPIError, ProductNotFoundError } from '../shopify.errors';

@Injectable()
export class ShopifyProductService {
  private productLoader: DataLoader<string, Product | null>;
  private readonly logger = new Logger(ShopifyProductService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly shopifyService: ShopifyService,
    private readonly configService: ConfigService,
  ) {
    this.initializeProductLoader();
  }

  /**
   * Initialize the DataLoader for batching and caching product requests.
   */
  private initializeProductLoader() {
    this.productLoader = new DataLoader<string, Product | null>(
      async (ids: string[]) => {
        const query = `
        query($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              description
              variants(first: 5) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryQuantity
                  }
                }
              }
              images(first: 5) {
                edges {
                  node {
                    id
                    src
                    altText
                  }
                }
              }
            }
          }
        }
      `;
        const variables = { ids };

        try {
          const products = await this.shopifyService.getProductsByIds(ids);
          const productsMap = new Map(
            products.map((product) => [product.id, product] as [string, Product | null]),
          );
          return ids.map((id) => productsMap.get(id) || null);
        } catch (error) {
          this.logger.error('Failed to load products', {
            error: error.message,
            ids,
          });
          throw new ShopifyAPIError(`Failed to load products: ${error.message}`);
        }
      },
    );
  }

  /**
   * Get product by its ID with caching. Uses DataLoader to batch requests.
   * @param id Product ID
   */
  async getProductById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    try {
      const cachedProduct = await this.cacheManager.get<Product>(cacheKey);
      if (cachedProduct) {
        this.logger.debug('Cache hit for product', { productId: id });
        return cachedProduct;
      }

      this.logger.debug('Cache miss for product, fetching from Shopify', {
        productId: id,
      });
      const product = await this.shopifyService.getProduct(id);

      if (!product) {
        this.logger.warn('Product not found', { productId: id });
        throw new ProductNotFoundError(id);
      }

      await this.cacheManager.set(cacheKey, product, {
        ttl: this.configService.get<number>('PRODUCT_CACHE_TTL', 3600),
      });
      return product;
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        throw error;
      }
      this.logger.error('Failed to get product', {
        error: error.message,
        productId: id,
      });
      throw new ShopifyAPIError(`Failed to get product: ${error.message}`);
    }
  }

  /**
   * Create a new product using Shopify GraphQL mutation.
   * @param input CreateProductInput data for the new product
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    const mutation = `
      mutation($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            description
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price
                  inventoryQuantity
                }
              }
            }
            images(first: 5) {
              edges {
                node {
                  id
                  src
                  altText
                }
              }
            }
          }
        }
      }
    `;
    const variables = { input };

    try {
      this.logger.info('Creating new product', { input });
      const createdProduct = await this.shopifyService.createProduct(input);

      this.logger.info('Product created successfully', {
        productId: createdProduct.id,
      });

      await this.cacheManager.del(`product:${createdProduct.id}`);

      return createdProduct;
    } catch (error) {
      this.logger.error('Failed to create product', {
        error: error.message,
        input,
      });
      throw new ShopifyAPIError(`Failed to create product: ${error.message}`);
    }
  }

  /**
   * Update an existing product.
   * @param input UpdateProductInput data to update the product
   */
  async updateProduct(input: UpdateProductInput): Promise<Product> {
    // Implement product update logic
  }

  /**
   * Delete a product by ID.
   * @param id Product ID to delete
   */
  async deleteProduct(id: string): Promise<void> {
    // Implement product delete logic
  }

  /**
   * Compare multiple products.
   * @param ids Array of product IDs to compare
   */
  async compareProducts(ids: string[]): Promise<Product[]> {
    // Implement product comparison logic
  }
}

