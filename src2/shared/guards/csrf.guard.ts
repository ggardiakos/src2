import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const csrfToken = request.headers['x-csrf-token'];
    if (!csrfToken || csrfToken !== process.env.CSRF_SECRET) {
      throw new UnauthorizedException('Invalid CSRF token');
    }
    return true;
  }
}
