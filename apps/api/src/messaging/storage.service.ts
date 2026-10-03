import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
@Injectable()
export class DocumentStorageService {
 private readonly client:S3Client; private readonly bucket:string;
 constructor(config:ConfigService){ this.bucket=config.getOrThrow<string>('S3_BUCKET'); this.client=new S3Client({region:config.getOrThrow<string>('AWS_REGION')}); }
 async createUpload(objectKey:string,mimeType:string){ const command=new PutObjectCommand({Bucket:this.bucket,Key:objectKey,ContentType:mimeType,ServerSideEncryption:'AES256'}); return getSignedUrl(this.client,command,{expiresIn:300}); }
 async createDownload(objectKey:string){ const command=new GetObjectCommand({Bucket:this.bucket,Key:objectKey}); return getSignedUrl(this.client,command,{expiresIn:300}); }
 key(userId:string,originalName:string){ const safe=originalName.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120); return `medical/${userId}/${randomUUID()}-${safe}`; }
}