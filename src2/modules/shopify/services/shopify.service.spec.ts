import { Test, TestingModule } from '@nestjs/testing';
import { ShopifyService } from './shopify.service';
import { CustomShopifyGraphQLService } from '../graphql/custom-shopify-graphql.service';  // Use the custom service
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { ProductNotFoundError } from '../../common/errors/product-not-found.error';
import { ShopifyAPIError } from '../../common/errors/shopify-api.error';

describe('ShopifyService', () => {
  let service: ShopifyService;
  let customShopifyGraphQLService: jest.Mocked<CustomShopifyGraphQLService>;  // Updated to use the custom service
  let configService: jest.Mocked<ConfigService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyService,
        {
          provide: CustomShopifyGraphQLService,  // Use custom service in the test setup
          useFactory: () => ({
            getProductById: jest.fn(),
            mutate: jest.fn(),
          }),
        },
        {
          provide: ConfigService,
          useFactory: () => ({}),
        },
        {
          provide: RedisService,
          useFactory: () => ({
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<ShopifyService>(ShopifyService);
    customShopifyGraphQLService = module.get(CustomShopifyGraphQLService);  // Get custom service
    configService = module.get(ConfigService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateProductCache', () => {
    it('should invalidate cache for a product', async () => {
      const productId = '123';
      await service.invalidateProductCache(productId);
      expect(redisService.del).toHaveBeenCalledWith(`product:${productId}`);
    });

    it('should log error if cache invalidation fails', async () => {
      const productId = '123';
      const error = new Error('Redis error');
      redisService.del.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await service.invalidateProductCache(productId);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Failed to invalidate cache for product ${productId}: ${error.message}`,
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getProductById', () => {
    const productId = '123';
    const cacheKey = `product:${productId}`;
    const mockProduct = { id: productId, title: 'Test Product' };

    it('should return cached product if available', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(mockProduct));
      const result = await service.getProductById(productId);
      expect(result).toEqual(mockProduct);
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(customShopifyGraphQLService.getProductById).not.toHaveBeenCalled();
    });

    it('should fetch and cache product if not in cache', async () => {
      redisService.get.mockResolvedValue(null);
      customShopifyGraphQLService.getProductById.mockResolvedValue(mockProduct);

      const result = await service.getProductById(productId);

      expect(result).toEqual(mockProduct);
      expect(redisService.get).toHaveBeenCalledWith(cacheKey);
      expect(customShopifyGraphQLService.getProductById).toHaveBeenCalledWith(
        productId,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(mockProduct),
        3600,
      );
    });

    it('should throw ProductNotFoundError if product not found', async () => {
      redisService.get.mockResolvedValue(null);
      customShopifyGraphQLService.getProductById.mockResolvedValue(null);

      await expect(service.getProductById(productId)).rejects.toThrow(
        ProductNotFoundError,
      );
    });

    it('should throw ShopifyAPIError on API failure', async () => {
      redisService.get.mockResolvedValue(null);
      customShopifyGraphQLService.getProductById.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(service.getProductById(productId)).rejects.toThrow(
        ShopifyAPIError,
      );
    });
  });

  // Add more test cases for other methods as needed
});
