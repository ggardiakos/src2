import { Logger } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';

export function Measure(metricName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`${target.constructor.name}`);
    const metricsService = new MetricsService(); // Ideally, this should be injected

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const duration = Date.now() - start;
        logger.debug(`${propertyKey} took ${duration}ms`);
        metricsService.recordMethodDuration(metricName, duration);
      }
    };

    return descriptor;
  };
}
