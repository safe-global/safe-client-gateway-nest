import { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { asError } from '@/logging/utils';
import { S3 } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import path from 'path';
import { Readable } from 'stream';

@Injectable()
export class AwsCloudStorageApiService implements ICloudStorageApiService {
  private readonly s3Client: S3;
  private readonly bucket: string;
  private readonly basePath: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.s3Client = new S3();
    this.basePath = this.configurationService.getOrThrow<string>(
      'targetedMessaging.fileStorage.aws.basePath',
    );
    this.bucket = this.configurationService.getOrThrow<string>(
      'targetedMessaging.fileStorage.aws.bucketName',
    );
  }

  async getFileContent(sourceFile: string): Promise<string> {
    try {
      const response = await this.s3Client.getObject({
        Bucket: this.bucket,
        Key: path.posix.join(this.basePath, sourceFile),
      });
      if (response.Body instanceof Readable) {
        return await this.streamToString(response.Body);
      } else {
        throw new Error('Unexpected response body type');
      }
    } catch (err) {
      throw new Error(
        `Error getting file content from S3: ${asError(err).message}`,
      );
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Array<Buffer> = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
}
