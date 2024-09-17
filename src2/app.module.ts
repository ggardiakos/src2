import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';  // <-- Add this import

import { ShopifyCoreModule } from '@nestjs-shopify/core';
import { ShopifyGraphQLModule } from '@nestjs-shopify/graphql';
import { ShopifyAuthModule } from '@nestjs-shopify/auth';
import { ShopifyModule } from '@nestjs-shopify/core';

import configuration from './core/config/configuration';
import { ContentfulModule } from './modules/contentful/contentful.module';
import { QueueModule } from './modules/queue/queue.module';
import { UserModule } from './modules/user/user.module';
import { CommonModule } from './shared/common.module';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';

import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './shared/interceptors/timeout.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    ShopifyCoreModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        shop: configService.get<string>('SHOPIFY_SHOP'),
        accessToken: configService.get<string>('SHOPIFY_ACCESS_TOKEN'),
      }),
      inject: [ConfigService],
    }),
    ShopifyGraphQLModule,
    ShopifyAuthModule.forRoot({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecretKey: process.env.SHOPIFY_API_SECRET_KEY,
      scopes: ['read_products', 'write_products'],
      hostName: process.env.HOST_NAME,
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, ms }) => {
                return `${timestamp} [${level}] ${context ? `[${context}] ` : ''}${message} ${ms}`;
              }),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ],
        exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('redis.host'),
        port: configService.get<number>('redis.port'),
        password: configService.get<string>('redis.password'),
        ttl: configService.get<number>('cache.ttl', 300),
        max: configService.get<number>('cache.max', 100),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<boolean>('database.synchronize', false),
        logging: configService.get<boolean>('database.logging', false),
        ssl: configService.get<boolean>('database.ssl', false) ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get<number>('throttle.ttl', 60),
        limit: configService.get<number>('throttle.limit', 100),
      }),
      inject: [ConfigService],
    }),
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      path: '/metrics',
      port: 3001,
    }),
    HttpModule, // <-- Add HttpModule here
    TerminusModule,
    CommonModule,
    ShopifyModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>('SHOPIFY_API_KEY'),
        apiSecretKey: configService.get<string>('SHOPIFY_API_SECRET_KEY'),
        scopes: ['read_products', 'write_products'],
        hostName: configService.get<string>('HOST_NAME'),
      }),
      inject: [ConfigService],
    }),
    ContentfulModule,
    QueueModule,
    UserModule,
    RedisModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
      multi: true,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          transform: true,
          forbidNonWhitelisted: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
    },
  ],
})
export class AppModule {}
