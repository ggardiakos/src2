import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface TaskData {
  type: string;
  payload: any;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('my-queue') private readonly myQueue: Queue) {}

  async addTask(data: TaskData): Promise<string> {
    try {
      const job = await this.myQueue.add('processTask', data);
      this.logger.log(`Task added to queue successfully with job ID ${job.id}`);
      return job.id;
    } catch (error) {
      this.logger.error(
        `Error adding task to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.myQueue.getWaitingCount(),
        this.myQueue.getActiveCount(),
        this.myQueue.getCompletedCount(),
        this.myQueue.getFailedCount(),
      ]);
      return { waiting, active, completed, failed };
    } catch (error) {
      this.logger.error(
        `Error fetching queue status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    name: string;
    data: any;
    opts: any;
    progress: number;
    delay: number;
    timestamp: number;
    attemptsMade: number;
    failedReason: string;
    stacktrace: string[];
    returnvalue: any;
  }> {
    try {
      const job = await this.myQueue.getJob(jobId);
      if (!job) {
        this.logger.warn(`Job not found with ID ${jobId}`);
        throw new Error(`Job not found with ID ${jobId}`);
      }
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: await job.progress(),
        delay: job.delay,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching job status for ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeJob(jobId: string): Promise<void> {
    try {
      const job = await this.myQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Job ${jobId} removed successfully`);
      } else {
        this.logger.warn(`Job ${jobId} not found for removal`);
      }
    } catch (error) {
      this.logger.error(
        `Error removing job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async retryJob(jobId: string): Promise<void> {
    try {
      const job = await this.myQueue.getJob(jobId);
      if (job) {
        await job.retry();
        this.logger.log(`Job ${jobId} retried successfully`);
      } else {
        this.logger.warn(`Job ${jobId} not found for retry`);
      }
    } catch (error) {
      this.logger.error(
        `Error retrying job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateJob(jobId: string, data: TaskData): Promise<void> {
    try {
      const job = await this.myQueue.getJob(jobId);
      if (job) {
        await job.update(data);
        this.logger.log(`Job ${jobId} updated successfully`);
      } else {
        this.logger.warn(`Job ${jobId} not found for update`);
      }
    } catch (error) {
      this.logger.error(
        `Error updating job ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async pauseQueue(): Promise<void> {
    try {
      await this.myQueue.pause();
      this.logger.log('Queue paused');
    } catch (error) {
      this.logger.error(`Error pausing queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  async resumeQueue(): Promise<void> {
    try {
      await this.myQueue.resume();
      this.logger.log('Queue resumed');
    } catch (error) {
      this.logger.error(`Error resuming queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cleanOldJobs(gracePeriod: number = 24 * 3600 * 1000): Promise<void> {
    try {
      await this.myQueue.clean(gracePeriod, 'completed');
      await this.myQueue.clean(gracePeriod, 'failed');
      this.logger.log(`Cleaned jobs older than ${gracePeriod}ms`);
    } catch (error) {
      this.logger.error(
        `Error cleaning old jobs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
