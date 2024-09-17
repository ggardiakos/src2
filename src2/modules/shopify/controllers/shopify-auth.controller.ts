import { Controller, Get, Req, Res } from '@nestjs/common';
import { ShopifyAuth } from '@nestjs-shopify/auth';
import { FastifyRequest, FastifyReply } from 'fastify';

@Controller('auth/shopify')
export class ShopifyAuthController {
  constructor(private readonly shopifyAuth: ShopifyAuth) {}

  @Get('login')
  async login(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await this.shopifyAuth.beginAuth(req, res, false);
  }

  @Get('callback')
  async callback(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await this.shopifyAuth.validateAuth(req, res);
  }

  @Get('logout')
  async logout(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    await this.shopifyAuth.logout(req, res);
  }
}
