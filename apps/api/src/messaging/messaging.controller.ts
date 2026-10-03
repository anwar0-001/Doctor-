import { Body,Controller,Get,Param,Post,Query,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagingService } from './messaging.service';
import { CreateConversationDto,InitDocumentDto,ReportDto,SendMessageDto } from './dto/messaging.dto';
@ApiTags('messaging') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('messaging')
export class MessagingController{
 constructor(private readonly service:MessagingService){}
 @Post('conversations') create(@Req() r:Request&{user:{id:string}},@Body() dto:CreateConversationDto){return this.service.createConversation(r.user.id,dto);}
 @Get('conversations') list(@Req() r:Request&{user:{id:string}}){return this.service.listConversations(r.user.id);}
 @Get('conversations/:id/messages') messages(@Req() r:Request&{user:{id:string}},@Param('id') id:string,@Query('cursor') cursor?:string){return this.service.messages(r.user.id,id,cursor);}
 @Post('conversations/:id/messages') send(@Req() r:Request&{user:{id:string}},@Param('id') id:string,@Body() dto:SendMessageDto){return this.service.send(r.user.id,id,dto);}
 @Post('messages/:id/read') read(@Req() r:Request&{user:{id:string}},@Param('id') id:string){return this.service.markRead(r.user.id,id);}
 @Post('documents/init') init(@Req() r:Request&{user:{id:string}},@Body() dto:InitDocumentDto){return this.service.initDocument(r.user.id,dto);}
 @Get('documents/:id') document(@Req() r:Request&{user:{id:string}},@Param('id') id:string){return this.service.document(r.user.id,id);}
 @Post('conversations/:id/report') report(@Req() r:Request&{user:{id:string}},@Param('id') id:string,@Body() dto:ReportDto){return this.service.report(r.user.id,id,dto);}
 @Post('conversations/:id/block') block(@Req() r:Request&{user:{id:string}},@Param('id') id:string){return this.service.block(r.user.id,id);}
}