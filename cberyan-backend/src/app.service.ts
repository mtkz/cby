import { Injectable } from '@nestjs/common';
import { getErrorMessage } from './common/error.util.js';
import { ElasticsearchService } from './modules/elasticsearch/elasticsearch.service.js';

@Injectable()
export class AppService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getElasticsearchStatus() {
    try {
      const client = this.elasticsearchService.getClient();
      const info = await client.info();
      return {
        status: 'connected',
        version: info.version.number,
        cluster_name: info.cluster_name,
        cluster_uuid: info.cluster_uuid,
        node_name: info.name,
      };
    } catch (error) {
      return {
        status: 'disconnected',
        error: getErrorMessage(error),
        details: error && typeof error === 'object' ? {
          type: (error as any)?.constructor?.name || 'Unknown',
          stack: (error as Error)?.stack,
        } : undefined,
      };
    }
  }
}