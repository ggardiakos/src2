import { Injectable } from '@nestjs/common';
import { ShopifyConnector } from '@nestjs-shopify/core';
import { CustomShopifyGraphQLService } from '../graphql/custom-shopify-graphql.service';
import { RedisService } from '../../redis/redis.service';
import { Product } from '../graphql/types';  // Updated import path
import { CreateProductInput } from '../graphql/dto/create-product.input'; // Updated import path
import { UpdateProductInput, CreateCollectionInput } from '../graphql/dto/create-product.input'; // Update this based on your actual DTOs
import { ShopifyAPIError } from '../../shared/errors/shopify-api.error';
import { ProductNotFoundError } from '../../shared/errors/product-not-found.error';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable()
export class ShopifyService {
  constructor(
    private readonly shopifyConnector: ShopifyConnector,
    private readonly customShopifyGraphQLService: CustomShopifyGraphQLService,
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
  ) {}

  async invalidateProductCache(productId: string): Promise<void> {
    try {
      await this.redisService.del(`product:${productId}`);
      this.logger.debug(`Cache invalidated for product ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for product ${productId}: ${error.message}`);
    }
  }

  async getProductById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cachedProduct = await this.redisService.get(cacheKey);
    if (cachedProduct) {
      this.logger.debug(`Cache hit for product ${id}`);
      return JSON.parse(cachedProduct);
    }

    try {
      const product = await this.customShopifyGraphQLService.getProductById(id);
      if (!product) {
        throw new ProductNotFoundError(id);
      }

      await this.redisService.set(cacheKey, JSON.stringify(product), 3600); // Cache for 1 hour
      this.logger.debug(`Fetched and cached product ${id}`);
      return product;
    } catch (error) {
      this.logger.error(`Error fetching product ${id}: ${error.message}`);
      throw new ShopifyAPIError(`Failed to fetch product ${id}`);
    }
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    try {
      const product = await this.customShopifyGraphQLService.createProduct(input);
      this.logger.debug(`Created product with ID ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(`Error creating product: ${error.message}`);
      throw new ShopifyAPIError('Failed to create product');
    }
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    try {
      const product = await this.customShopifyGraphQLService.updateProduct(id, input);
      await this.invalidateProductCache(id);
      this.logger.debug(`Updated product ${id}`);
      return product;
    } catch (error) {
      this.logger.error(`Error updating product ${id}: ${error.message}`);
      throw new ShopifyAPIError(`Failed to update product ${id}`);
    }
  }

  async getCollectionById(id: string): Promise<Collection> {
    const cacheKey = `collection:${id}`;
    const cachedCollection = await this.redisService.get(cacheKey);
    if (cachedCollection) {
      this.logger.debug(`Cache hit for collection ${id}`);
      return JSON.parse(cachedCollection);
    }

    try {
      const collection = await this.customShopifyGraphQLService.getCollectionById(id);
      if (!collection) {
        throw new Error(`Collection not found: ${id}`);
      }

      await this.redisService.set(cacheKey, JSON.stringify(collection), 3600); // Cache for 1 hour
      this.logger.debug(`Fetched and cached collection ${id}`);
      return collection;
    } catch (error) {
      this.logger.error(`Error fetching collection ${id}: ${error.message}`);
      throw new ShopifyAPIError(`Failed to fetch collection ${id}`);
    }
  }

  async createCollection(input: CreateCollectionInput): Promise<Collection> {
    try {
      const collection = await this.customShopifyGraphQLService.createCollection(input);
      this.logger.debug(`Created collection with ID ${collection.id}`);
      return collection;
    } catch (error) {
      this.logger.error(`Error creating collection: ${error.message}`);
      throw new ShopifyAPIError('Failed to create collection');
    }
  }

  getShopifyProduct(productId: string): Observable<AxiosResponse<any>> {
    return this.httpService.get(`https://shopify.com/products/${productId}`).pipe(
      map((response) => response.data),
      catchError((error) => {
        this.logger.error('Failed to fetch product from Shopify');
        throw error;
      }),
    );
  }
}
