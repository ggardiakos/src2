import { Test, TestingModule } from '@nestjs/testing';
import { ShopifyService } from './shopify.service';
import { CustomShopifyGraphQLService } from '../graphql/custom-shopify-graphql.service'; // Updated import for custom service
import { RedisService } from '../../redis/redis.service';
import { ContentfulService } from '../../contentful/contentful.service';
import { QueueService } from '../../queue/queue.service';
import { ConfigService } from '@nestjs/config';
import { ProductNotFoundError } from '../../common/errors/product-not-found.error';
import { ShopifyAPIError } from '../../common/errors/shopify-api.error';

describe('ShopifyService Integration', () => {
  let service: ShopifyService;
  let customShopifyGraphQLService: CustomShopifyGraphQLService; // Updated variable name
  let redisService: RedisService;
  let contentfulService: ContentfulService;
  let queueService: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: CustomShopifyGraphQLService, // Updated to provide custom service
          useValue: {
            getProductById: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: ContentfulService,
          useValue: {
            createProduct: jest.fn(),
            updateProduct: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addTask: jest.fn(),
          },
        },
        ConfigService,
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
    customShopifyGraphQLService = module.get<CustomShopifyGraphQLService>(
      CustomShopifyGraphQLService,
    ); // Updated service name
    redisService = module.get<RedisService>(RedisService);
    contentfulService = module.get<ContentfulService>(ContentfulService);
    queueService = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProductById', () => {
    it('should return product from cache if available', async () => {
      const productId = 'prod_123';
      const cachedProduct = { id: productId, title: 'Cached Product' };
      (redisService.get as jest.Mock).mockResolvedValue(
        JSON.stringify(cachedProduct),
      );

      const result = await service.getProductById(productId);
      expect(redisService.get).toHaveBeenCalledWith(`product:${productId}`);
      expect(result).toEqual(cachedProduct);
      expect(customShopifyGraphQLService.getProductById).not.toHaveBeenCalled(); // Updated service call
    });

    it('should fetch product from Shopify if not in cache and cache it', async () => {
      const productId = 'prod_456';
      const fetchedProduct = { id: productId, title: 'Fetched Product' };
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (customShopifyGraphQLService.getProductById as jest.Mock).mockResolvedValue(
        fetchedProduct,
      );
      (redisService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getProductById(productId);
      expect(redisService.get).toHaveBeenCalledWith(`product:${productId}`);
      expect(customShopifyGraphQLService.getProductById).toHaveBeenCalledWith(
        productId,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        `product:${productId}`,
        JSON.stringify(fetchedProduct),
        3600,
      );
      expect(result).toEqual(fetchedProduct);
    });

    it('should throw ProductNotFoundError if product not found in Shopify', async () => {
      const productId = 'prod_nonexistent';
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (customShopifyGraphQLService.getProductById as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.getProductById(productId)).rejects.toThrow(
        ProductNotFoundError,
      );
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should throw ShopifyAPIError on ShopifyService failure', async () => {
      const productId = 'prod_error';
      (redisService.get as jest.Mock).mockResolvedValue(null);
      (customShopifyGraphQLService.getProductById as jest.Mock).mockRejectedValue(
        new Error('Shopify API failure'),
      );

      await expect(service.getProductById(productId)).rejects.toThrow(
        ShopifyAPIError,
      );
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });
});
