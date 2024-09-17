import { Module } from '@nestjs/common';
import { ContentfulService } from './contentful.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Logger } from 'winston';

@Module({
  imports: [ConfigModule, CacheModule],
  providers: [ContentfulService],
  exports: [ContentfulService],
})
export class ContentfulModule {}
