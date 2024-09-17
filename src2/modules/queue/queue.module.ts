import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueProcessor } from './queue.processor';
import { QueueService } from './queue.service';
import { ConfigService, ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'my-queue',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
        },
        defaultJobOptions: {
          attempts: configService.get<number>('bull.retryAttempts'),
          backoff: {
            type: 'exponential',
            delay: configService.get<number>('bull.retryDelay'),
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [QueueProcessor, QueueService],
  exports: [QueueService],
})
export class QueueModule {}
