import { Controller, Get } from '@nestjs/common';
import { CircuitBreaker } from '@nestjs/circuit-breaker';
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  HealthCheck,
  MemoryHealthIndicator,
  RedisHealthIndicator, // Import Redis health indicator from terminus
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private redisHealth: RedisHealthIndicator, // Inject Redis health indicator
  ) {}

  @Get()
  @HealthCheck()
  @CircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
  })
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),

      // Redis health check using the built-in RedisHealthIndicator
      () => this.redisHealth.pingCheck('redis'),

      // Memory usage check
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB

      // External API health checks (adjust URLs as needed)
      () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
      () => this.http.pingCheck('shopify-api', 'https://shopify.dev/'),

      // Add more checks as needed
    ]);
  }
}
