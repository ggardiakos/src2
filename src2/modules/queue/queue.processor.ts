import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';

export interface ProcessTaskData {
  type: string;
  payload: any;
}

@Injectable()
@Processor('my-queue')
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  @Process('processTask')
  async handleProcessTask(job: Job<ProcessTaskData>) {
    this.logger.log(`Processing job ${job.id} of type ${job.data.type}`);
    try {
      // Implement task processing logic based on job.data.type
      switch (job.data.type) {
        case 'send-email':
          await this.sendEmail(job.data.payload);
          break;
        case 'generate-report':
          await this.generateReport(job.data.payload);
          break;
        default:
          this.logger.warn(`Unknown task type: ${job.data.type}`);
      }
      this.logger.log(`Job ${job.id} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Error processing job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error; // Bull will handle retries based on job options
    }
  }

  private async sendEmail(payload: any) {
    // Implement email sending logic here
    this.logger.debug(`Sending email to ${payload.to}`);
    // Example: integrate with an email service like SendGrid or SES
  }

  private async generateReport(payload: any) {
    // Implement report generation logic here
    this.logger.debug(`Generating report for ${payload.userId}`);
    // Example: generate a PDF report and store it in S3
  }
}
