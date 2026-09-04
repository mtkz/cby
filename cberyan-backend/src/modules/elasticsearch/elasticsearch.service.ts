import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../../common/error.util.js';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(ElasticsearchService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const node =
      this.configService.get('ELASTICSEARCH_URL') || 'http://localhost:9200';

    this.logger.log(`Connecting to Elasticsearch at ${node}`);

    try {
      this.client = new Client({
        node,
        maxRetries: 3,
        requestTimeout: 60000,
        pingTimeout: 30000,
        tls: {
          rejectUnauthorized: false,
        },
        cloud: undefined,
        compression: false,
        sniffOnStart: false,
        sniffOnConnectionFault: false,
        sniffInterval: false,
      });

      const info = await this.client.info();
      this.logger.log(`✅ Connected to Elasticsearch version: ${info.version.number}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to connect to Elasticsearch: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Elasticsearch client not initialized');
    }
    return this.client;
  }
}