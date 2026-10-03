import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
@Injectable()
export class MessageCryptoService {
 constructor(private readonly config:ConfigService){}
 private key(){ const raw=this.config.getOrThrow<string>('MESSAGE_ENCRYPTION_KEY'); const b=Buffer.from(raw,'base64'); if(b.length!==32) throw new BadRequestException('MESSAGE_ENCRYPTION_KEY must decode to 32 bytes'); return b; }
 encrypt(value:string){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',this.key(),iv);const body=Buffer.concat([c.update(value,'utf8'),c.final()]);return {encryptedContent:body.toString('base64url'),nonce:iv.toString('base64url'),authTag:c.getAuthTag().toString('base64url')};}
 decrypt(encrypted:string,nonce:string,tag:string){const d=createDecipheriv('aes-256-gcm',this.key(),Buffer.from(nonce,'base64url'));d.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([d.update(Buffer.from(encrypted,'base64url')),d.final()]).toString('utf8');}
 hash(value:string){return createHash('sha256').update(value).digest('hex');}
}