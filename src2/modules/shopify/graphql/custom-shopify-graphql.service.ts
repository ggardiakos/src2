import { Injectable, Logger } from '@nestjs/common';
import { ShopifyGraphQLService } from '@nestjs-shopify/graphql'; // Shopify GraphQL base service
import { ConfigService } from '@nestjs/config';
import { tracer } from 'dd-trace';
import { retry } from 'ts-retry-promise';
import * as Sentry from '@sentry/node';

// Add any missing type imports, for example:
import { Product, Collection, CreateProductInput, UpdateProductInput, CreateCollectionInput } from '../graphql/types';

@Injectable()
export class CustomShopifyGraphQLService {
  private readonly logger = new Logger(CustomShopifyGraphQLService.name);

  constructor(
    private readonly shopifyGraphQLService: ShopifyGraphQLService, // Base Shopify service
    private readonly configService: ConfigService,
  ) {}

  async query<T>(query: string, variables: any = {}): Promise<T> {
    const span = tracer.startSpan('shopify.graphql.query');
    try {
      return await retry(() => this.shopifyGraphQLService.query(query, variables), {
        maxAttempts: 3,
        delay: 1000,
        factor: 2,
        onError: (error, attempt) => {
          this.logger.warn(`GraphQL query attempt ${attempt} failed: ${error.message}`);
          Sentry.captureException(error);
        },
      });
    } catch (error) {
      this.logger.error(`GraphQL query failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      span.finish();
    }
  }

  async mutate<T>(mutation: string, variables: any = {}): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  // Implement getProductById and other methods based on query and mutate
  async getProductById(id: string): Promise<Product> {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          description
          images(first: 1) {
            edges {
              node {
                originalSrc
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
    `;
    const variables = { id };
    const data = await this.query<{ product: Product }>(query, variables);
    return data.product;
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const mutation = `
      mutation createProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
          }
        }
      }
    `;
    const variables = { input };
    const data = await this.mutate<{ productCreate: { product: Product } }>(mutation, variables);
    return data.productCreate.product;
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const mutation = `
      mutation updateProduct($id: ID!, $input: ProductInput!) {
        productUpdate(id: $id, input: $input) {
          product {
            id
            title
            handle
          }
        }
      }
    `;
    const variables = { id, input };
    const data = await this.mutate<{ productUpdate: { product: Product } }>(mutation, variables);
    return data.productUpdate.product;
  }

  async getCollectionById(id: string): Promise<Collection> {
    const query = `
      query getCollection($id: ID!) {
        collection(id: $id) {
          id
          title
          description
        }
      }
    `;
    const variables = { id };
    const data = await this.query<{ collection: Collection }>(query, variables);
    return data.collection;
  }

  async createCollection(input: CreateCollectionInput): Promise<Collection> {
    const mutation = `
      mutation createCollection($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            title
            description
          }
        }
      }
    `;
    const variables = { input };
    const data = await this.mutate<{ collectionCreate: { collection: Collection } }>(mutation, variables);
    return data.collectionCreate.collection;
  }
}
