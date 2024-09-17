import { Injectable, Logger } from '@nestjs/common';
import { ShopifyAuthService as BaseShopifyAuthService } from '@nestjs-shopify/auth';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { ShopifyService } from './shopify.service';
import { HttpService } from '@nestjs/axios'; // Add HttpService import

@Injectable()
export class ShopifyAuthService extends BaseShopifyAuthService {
  private readonly logger = new Logger(ShopifyAuthService.name);

  constructor(
    configService: ConfigService,
    private readonly shopifyService: ShopifyService,
    private readonly httpService: HttpService, // Inject HttpService if needed for HTTP calls
  ) {
    super(configService);
  }

  async handleAuthCallback(req: FastifyRequest, res: FastifyReply) {
    try {
      const session = await this.authenticate(req, res);
      if (session) {
        await this.shopifyService.setShopAccessToken(
          session.shop,
          session.accessToken,
        );
        this.logger.log(
          `Authenticated and set access token for shop: ${session.shop}`,
        );
        res.redirect('/dashboard'); // Redirect to your dashboard or desired route
      }
    } catch (error) {
      this.logger.error('Error during Shopify auth callback', error);
      res.status(500).send('Authentication failed');
    }
  }

  // Add any method making HTTP calls here
}
