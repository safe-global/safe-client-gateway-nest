import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { FetchClient } from '@/datasources/network/network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';

/**
 * A {@link INetworkService} which uses fetch as the main HTTP client
 */
@Injectable()
export class FetchNetworkService implements INetworkService {
  constructor(
    @Inject('FetchClient')
    private readonly client: FetchClient,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async get<T>(
    baseUrl: string,
    { params, ...options }: NetworkRequest = {},
  ): Promise<NetworkResponse<T>> {
    const url = this.buildUrl(baseUrl, params);
    const startTimeMs = performance.now();
    try {
      return await this.client<T>(url, {
        method: 'GET',
        ...options,
      });
    } catch (error) {
      this.logErrorResponse(error, performance.now() - startTimeMs);
      throw error;
    }
  }

  async post<T>(
    baseUrl: string,
    data: object,
    { params, headers }: NetworkRequest = {},
  ): Promise<NetworkResponse<T>> {
    const url = this.buildUrl(baseUrl, params);
    const startTimeMs = performance.now();
    try {
      return await this.client<T>(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
    } catch (error) {
      this.logErrorResponse(error, performance.now() - startTimeMs);
      throw error;
    }
  }

  async delete<T>(url: string, data?: object): Promise<NetworkResponse<T>> {
    const startTimeMs = performance.now();
    try {
      return await this.client<T>(url, {
        method: 'DELETE',
        ...(data && {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }),
      });
    } catch (error) {
      this.logErrorResponse(error, performance.now() - startTimeMs);
      throw error;
    }
  }

  private buildUrl(baseUrl: string, params = {}): string {
    const urlObject = new URL(baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') {
        urlObject.searchParams.append(key, String(value));
      }
    }

    return urlObject.toString();
  }

  private logErrorResponse(error: unknown, responseTimeMs: number): void {
    if (!(error instanceof NetworkResponseError)) {
      return;
    }

    this.loggingService.debug({
      type: 'external_request',
      protocol: error.url.protocol,
      target_host: error.url.host,
      path: error.url.pathname,
      request_status: error.response.status,
      detail: error.response.statusText,
      response_time_ms: responseTimeMs,
    });
  }
}
