import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from './redis.module';
import * as IORedis from 'ioredis';

describe('RedisService', () => {
  let service: RedisService;
  let redisClient: IORedis.Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RedisModule.forRoot()],
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
    redisClient = module.get<IORedis.Redis>('REDIS_CLIENT');
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set and get a key', async () => {
    const key = 'test_key';
    const value = 'test_value';
    await service.set(key, value, 10);
    const result = await service.get(key);
    expect(result).toBe(value);
  });

  it('should delete a key', async () => {
    const key = 'test_key_to_delete';
    const value = 'delete_me';
    await service.set(key, value);
    const deletedCount = await service.del(key);
    expect(deletedCount).toBe(1);
    const result = await service.get(key);
    expect(result).toBeNull();
  });

  it('should handle non-existent keys gracefully', async () => {
    const key = 'non_existent_key';
    const result = await service.get(key);
    expect(result).toBeNull();
  });
});
