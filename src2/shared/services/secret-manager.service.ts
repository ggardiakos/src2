import { Injectable, Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecretManagerService {
  private readonly logger = new Logger(SecretManagerService.name);
  private client: SecretsManagerClient;

  constructor(private readonly configService: ConfigService) {
    // Initialize AWS Secrets Manager Client
    this.client = new SecretsManagerClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async getSecret(secretName: string): Promise<string> {
    try {
      // Command to fetch the secret value
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);
      
      if ('SecretString' in response) {
        return response.SecretString;
      } else {
        // Convert binary secret to a string
        const buff = Buffer.from(response.SecretBinary as Uint8Array);
        return buff.toString('ascii');
      }
    } catch (error) {
      this.logger.error(`Failed to retrieve secret ${secretName}: ${error.message}`);
      throw error;
    }
  }
}
