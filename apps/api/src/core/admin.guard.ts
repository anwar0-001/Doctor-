import { CanActivate,ExecutionContext,ForbiddenException,Injectable } from '@nestjs/common';
import { Request } from 'express';
@Injectable()
export class AdminGuard implements CanActivate { canActivate(ctx:ExecutionContext){const r=ctx.switchToHttp().getRequest<Request&{user?:{roles:string[]}}>();if(!r.user?.roles?.some(x=>['ADMIN','SUPER_ADMIN','MODERATOR','FINANCE','SUPPORT'].includes(x)))throw new ForbiddenException('Admin role required');return true;} }