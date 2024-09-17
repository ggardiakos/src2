import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';
import { tracer } from 'dd-trace'; // Ensure dd-trace is initialized
import { retry } from 'ts-retry-promise';
import * as Sentry from '@sentry/node';

@Injectable()
export class ShopifyGraphQLService {
  private readonly logger = new Logger(ShopifyGraphQLService.name);
  private client: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const shopifyUrl =
      this.configService.get<string>('shopify.graphqlUrl') ||
      'https://your-shopify-store.myshopify.com/admin/api/2023-10/graphql.json';
    const accessToken = this.configService.get<string>('shopify.accessToken');

    this.client = new GraphQLClient(shopifyUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    });
  }

  setAccessToken(accessToken: string) {
    this.client.setHeader('X-Shopify-Access-Token', accessToken);
    this.logger.debug('Shopify access token updated');
  }

  async query<T>(query: string, variables: any = {}): Promise<T> {
    const span = tracer.startSpan('shopify.graphql.query');
    try {
      return await retry(() => this.client.request<T>(query, variables), {
        maxAttempts: 3,
        delay: 1000,
        factor: 2,
        onError: (error, attempt) => {
          this.logger.warn(
            `GraphQL query attempt ${attempt} failed: ${error.message}`,
          );
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

  // Product-related methods
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

  async getProducts(queryString: string): Promise<Product[]> {
    const query = `
      query getProducts($query: String!) {
        products(first: 10, query: $query) {
          edges {
            node {
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
        }
      }
    `;
    const variables = { query: queryString };
    const data = await this.query<{ products: { edges: { node: Product }[] } }>(
      query,
      variables,
    );
    return data.products.edges.map((edge) => edge.node);
  }

  async createProduct(product: ProductInput): Promise<Product> {
    const mutation = `
      mutation createProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
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
      }
    `;
    const variables = { input: product };
    const data = await this.mutate<{ productCreate: { product: Product } }>(
      mutation,
      variables,
    );
    return data.productCreate.product;
  }

  async updateProduct(id: string, product: ProductInput): Promise<Product> {
    const mutation = `
      mutation updateProduct($id: ID!, $input: ProductInput!) {
        productUpdate(input: { id: $id, product: $input }) {
          product {
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
      }
    `;
    const variables = { id, input: product };
    const data = await this.mutate<{ productUpdate: { product: Product } }>(
      mutation,
      variables,
    );
    return data.productUpdate.product;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const mutation = `
      mutation deleteProduct($id: ID!) {
        productDelete(input: { id: $id }) {
          deletedProductId
        }
      }
    `;
    const variables = { id };
    const data = await this.mutate<{
      productDelete: { deletedProductId: string };
    }>(mutation, variables);
    return !!data.productDelete.deletedProductId;
  }

  // Collection-related methods
  async getCollectionById(id: string): Promise<Collection> {
    const query = `
      query($id: ID!) {
        collection(id: $id) {
          id
          title
          description
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      }
    `;
    const variables = { id };
    const data = await this.query<{ collection: Collection }>(query, variables);
    return data.collection;
  }

  async createCollection(collection: CollectionInput): Promise<Collection> {
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
    const variables = { input: collection };
    const data = await this.mutate<{
      collectionCreate: { collection: Collection };
    }>(mutation, variables);
    return data.collectionCreate.collection;
  }

  // Order-related methods
  async getOrderById(id: string): Promise<Order> {
    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          totalPrice
          createdAt
          fulfillmentStatus
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                variant {
                  id
                  title
                  price
                }
              }
            }
          }
        }
      }
    `;
    const variables = { id };
    const data = await this.query<{ order: Order }>(query, variables);
    return data.order;
  }

  async createOrder(order: OrderInput): Promise<Order> {
    const mutation = `
      mutation createOrder($input: OrderInput!) {
        orderCreate(input: $input) {
          order {
            id
            name
            totalPrice
            createdAt
            fulfillmentStatus
          }
        }
      }
    `;
    const variables = { input: order };
    const data = await this.mutate<{ orderCreate: { order: Order } }>(
      mutation,
      variables,
    );
    return data.orderCreate.order;
  }

  // CustomizationOption-related methods
  async getCustomizationOptions(
    productId: string,
  ): Promise<CustomizationOption[]> {
    const query = `
      query getCustomizationOptions($productId: ID!) {
        product(id: $productId) {
          options {
            id
            name
            values
          }
        }
      }
    `;
    const variables = { productId };
    const data = await this.query<{
      product: { options: CustomizationOption[] };
    }>(query, variables);
    return data.product.options;
  }

  async createCustomizationOption(
    productId: string,
    option: CustomizationOptionInput,
  ): Promise<CustomizationOption> {
    const mutation = `
      mutation createCustomizationOption($productId: ID!, $input: ProductOptionInput!) {
        productOptionCreate(input: { productId: $productId, option: $input }) {
          productOption {
            id
            name
            values
          }
        }
      }
    `;
    const variables = { productId, input: option };
    const data = await this.mutate<{
      productOptionCreate: { productOption: CustomizationOption };
    }>(mutation, variables);
    return data.productOptionCreate.productOption;
  }

  async updateCustomizationOption(
    id: string,
    option: CustomizationOptionInput,
  ): Promise<CustomizationOption> {
    const mutation = `
      mutation updateCustomizationOption($id: ID!, $input: ProductOptionInput!) {
        productOptionUpdate(input: { id: $id, option: $input }) {
          productOption {
            id
            name
            values
          }
        }
      }
    `;
    const variables = { id, input: option };
    const data = await this.mutate<{
      productOptionUpdate: { productOption: CustomizationOption };
    }>(mutation, variables);
    return data.productOptionUpdate.productOption;
  }

  async deleteCustomizationOption(id: string): Promise<boolean> {
    const mutation = `
      mutation deleteCustomizationOption($id: ID!) {
        productOptionDelete(input: { id: $id }) {
          deletedProductOptionId
        }
      }
    `;
    const variables = { id };
    const data = await this.mutate<{
      productOptionDelete: { deletedProductOptionId: string };
    }>(mutation, variables);
    return !!data.productOptionDelete.deletedProductOptionId;
  }

  // Additional methods can be added similarly
}
