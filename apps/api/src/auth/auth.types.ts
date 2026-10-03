import { UserRole, UserStatus } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  roles: UserRole[];
  type: 'access';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  status: UserStatus;
  roles: UserRole[];
}