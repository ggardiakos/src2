// src/common/common.module.ts

import { Module } from '@nestjs/common';
import { SecretManagerService } from './services/secret-manager.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [SecretManagerService],
  exports: [SecretManagerService],
})
export class CommonModule {}
