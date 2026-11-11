import { CopyObjectCommand, CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import type { Readable } from 'stream';

/** Thin wrapper around any S3-compatible store (AWS S3, R2, Wasabi, SeaweedFS, MinIO…). */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger(StorageService.name);
  readonly bucket = process.env.S3_BUCKET || 'factory-assets';
  private readonly s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY || '', secretAccessKey: process.env.S3_SECRET_KEY || '' },
  });

  async onModuleInit() {
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
        return;
      } catch (e: any) {
        if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound' || e?.name === 'NoSuchBucket') {
          try {
            await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
            this.log.log(`Created bucket ${this.bucket}`);
            return;
          } catch (ce: any) {
            if (ce?.name === 'BucketAlreadyOwnedByYou' || ce?.name === 'BucketAlreadyExists') return;
            this.log.warn(`Bucket create failed (attempt ${attempt}): ${ce?.message}`);
          }
        } else this.log.warn(`Storage not reachable yet (attempt ${attempt}): ${e?.message ?? e?.name}`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.log.error('Object storage unavailable — uploads will fail until it is reachable.');
  }

  /** Public URL served through the API (/files/<key>), proxied by the web app at /api/files/<key>. */
  urlFor(key: string) {
    return `/api/files/${key}`;
  }

  put(key: string, body: Buffer, contentType: string) {
    return this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  copy(fromKey: string, toKey: string) {
    return this.s3.send(new CopyObjectCommand({ Bucket: this.bucket, CopySource: `${this.bucket}/${encodeURI(fromKey)}`, Key: toKey }));
  }

  async get(key: string): Promise<{ body: Readable; contentType?: string; length?: number }> {
    const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return { body: out.Body as Readable, contentType: out.ContentType, length: out.ContentLength };
  }

  delete(key: string) {
    return this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
