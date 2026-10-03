import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessageCryptoService } from './crypto.service';
import { DocumentStorageService } from './storage.service';
@Module({controllers:[MessagingController],providers:[MessagingService,MessageCryptoService,DocumentStorageService],exports:[MessagingService]})
export class MessagingModule {}