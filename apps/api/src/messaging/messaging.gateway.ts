import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/messaging.dto';

type SocketUser = { id: string; email: string };
@WebSocketGateway({ namespace: '/realtime', cors: { origin: process.env.WEB_ORIGIN?.split(',').map((x) => x.trim()).filter(Boolean) ?? [], credentials: true } })
@Injectable()
export class MessagingGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MessagingGateway.name);
  constructor(private readonly jwt: JwtService, private readonly messaging: MessagingService) {}

  private async authenticate(socket: Socket): Promise<SocketUser> {
    const raw = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!raw) throw new ForbiddenException('Authentication required');
    const payload = await this.jwt.verifyAsync<{ sub: string; email: string; type: string }>(raw);
    if (payload.type !== 'access' || !payload.sub) throw new ForbiddenException('Invalid access token');
    return { id: payload.sub, email: payload.email };
  }

  async handleConnection(socket: Socket) {
    try {
      const user = await this.authenticate(socket);
      socket.data.user = user;
      socket.join('user:' + user.id);
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const user = socket.data.user as SocketUser | undefined;
    if (user) this.server.to('user:' + user.id).emit('presence', { userId: user.id, online: false });
  }

  @SubscribeMessage('conversation:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversationId: string }) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user || !body?.conversationId) return { ok: false };
    await this.messaging.messages(user.id, body.conversationId, undefined);
    socket.join('conversation:' + body.conversationId);
    return { ok: true, conversationId: body.conversationId };
  }

  @SubscribeMessage('message:send')
  async send(@ConnectedSocket() socket: Socket, @MessageBody() body: SendMessageDto & { conversationId: string }) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user) throw new ForbiddenException('Authentication required');
    const { conversationId, ...dto } = body;
    const message = await this.messaging.send(user.id, conversationId, dto);
    this.server.to('conversation:' + conversationId).emit('message:new', message);
    return message;
  }

  @SubscribeMessage('message:read')
  async read(@ConnectedSocket() socket: Socket, @MessageBody() body: { messageId: string; conversationId: string }) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user) throw new ForbiddenException('Authentication required');
    const result = await this.messaging.markRead(user.id, body.messageId);
    this.server.to('conversation:' + body.conversationId).emit('message:read', { messageId: body.messageId, userId: user.id });
    return result;
  }

  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversationId: string; active: boolean }) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user || !body?.conversationId) return { ok: false };
    await this.messaging.messages(user.id, body.conversationId);
    socket.to('conversation:' + body.conversationId).emit('typing', { userId: user.id, active: !!body.active });
    return { ok: true };
  }
}
