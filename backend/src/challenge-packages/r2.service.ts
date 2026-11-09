import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { PreparedPackage } from './archive.service.js';

// R2 requires bucket names of at least three characters. Database IDs 1 and 2
// therefore become "001" and "002"; both sides use this canonical mapping.
export function competitionBucket(id: number): string {
  return String(id).padStart(3, '0');
}

@Injectable()
export class R2Service {
  private client?: S3Client;

  private get s3(): S3Client {
    if (!this.client) {
      const endpoint = process.env.R2_ENDPOINT_URL;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new ServiceUnavailableException('R2 nije konfiguriran');
      }
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
        requestChecksumCalculation: 'WHEN_REQUIRED',
      });
    }
    return this.client;
  }

  async ensureCompetitionBucket(competitionId: number): Promise<string> {
    const bucket = competitionBucket(competitionId);
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      const e = error as {
        $metadata?: { httpStatusCode?: number };
        name?: string;
      };
      if (
        e.$metadata?.httpStatusCode !== 404 &&
        e.name !== 'NotFound' &&
        e.name !== 'NoSuchBucket'
      )
        throw error;
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (createError) {
        const c = createError as { name?: string };
        if (c.name !== 'BucketAlreadyOwnedByYou') throw createError;
      }
    }
    return bucket;
  }

  async upload(
    competitionId: number,
    taskId: number,
    pkg: PreparedPackage,
  ): Promise<{ bucket: string; prefix: string }> {
    const bucket = await this.ensureCompetitionBucket(competitionId);
    const prefix = `${taskId}/`;
    const uploaded: string[] = [];
    try {
      for (const [name, file, type] of [
        ['config.yaml', pkg.configPath, 'application/yaml'],
        ['public.zip', pkg.publicZip, 'application/zip'],
        ['deploy.zip', pkg.deployZip, 'application/zip'],
      ] as const) {
        if (!file) continue;
        const key = prefix + name;
        const length = (await stat(file)).size;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: createReadStream(file),
            ContentLength: length,
            ContentType: type,
          }),
        );
        uploaded.push(key);
      }
      return { bucket, prefix };
    } catch (error) {
      await this.cleanup(bucket, uploaded);
      throw error;
    }
  }

  async cleanup(bucket: string, keys: string[]): Promise<void> {
    await Promise.allSettled(
      keys.map((Key) =>
        this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })),
      ),
    );
  }
}
