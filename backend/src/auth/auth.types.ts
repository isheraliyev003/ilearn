import type { Request, Response } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};

export type AuthResponse = Response;
