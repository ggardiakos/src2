import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ShopifyDatabaseModule } from '@nestjs-shopify/database'; // Ensure correct import

@Module({
  imports: [
    MikroOrmModule.forRoot(),
    ShopifyDatabaseModule.forRoot({
      // Your Shopify-specific database configurations
    }),
  ],
})
export class DatabaseModule {}
