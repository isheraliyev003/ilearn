import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { CompleteSignupDto } from './dto/complete-signup.dto';

type SessionPayload = {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  token: string;
};

const SESSION_COOKIE = 'ilearn_session';
const VERIFICATION_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separator = part.indexOf('=');
      if (separator <= 0) {
        return acc;
      }
      const key = decodeURIComponent(part.slice(0, separator).trim());
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function buildCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
    path?: string;
    maxAge?: number;
    expires?: Date;
  },
): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expected] = storedHash.split(':');
    if (!salt || !expected) {
      return false;
    }
    const derived = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (derived.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(derived, expectedBuffer);
  }

  private buildCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private isDevelopmentMode(): boolean {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  private async sendVerificationEmail(params: {
    email: string;
    fullName: string;
    code: string;
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      if (this.isDevelopmentMode()) {
        this.logger.warn(
          `DEV AUTH CODE for ${params.email} (${params.fullName}): ${params.code}`,
        );
        return;
      }

      this.logger.error(
        'Missing RESEND_API_KEY or EMAIL_FROM for email authentication',
      );
      throw new ServiceUnavailableException(
        'Email delivery is not configured on the server.',
      );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject: 'Your ilearn sign-up code',
        text: `Hi ${params.fullName},\n\nYour ilearn verification code is ${params.code}. It expires in ${VERIFICATION_TTL_MINUTES} minutes.\n\nEnter this code in the sign-up form, then choose your password.\n\nIf you did not request this, you can ignore this email.`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (this.isDevelopmentMode()) {
        this.logger.warn(
          `Email delivery failed in development; using console fallback. Reason: ${text}`,
        );
        this.logger.warn(
          `DEV AUTH CODE for ${params.email} (${params.fullName}): ${params.code}`,
        );
        return;
      }

      this.logger.error(`Failed to send auth email: ${text}`);
      throw new ServiceUnavailableException(
        'Could not send the verification email.',
      );
    }
  }

  private async createSession(user: {
    id: string;
    email: string;
    fullName: string;
  }): Promise<SessionPayload> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token,
    };
  }

  async requestSignupCode(fullName: string, email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedName = fullName.trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser?.passwordHash) {
      throw new ConflictException(
        'An account with this email already exists. Please sign in.',
      );
    }

    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { fullName: normalizedName },
      create: {
        email: normalizedEmail,
        fullName: normalizedName,
      },
    });

    const code = this.buildCode();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + VERIFICATION_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.verificationCode.create({
      data: {
        userId: user.id,
        codeHash: this.hash(code),
        expiresAt,
      },
    });

    await this.sendVerificationEmail({
      email: normalizedEmail,
      fullName: normalizedName,
      code,
    });
  }

  async completeSignup(dto: CompleteSignupDto): Promise<SessionPayload> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.assertValidSignupCode(dto.email, dto.code);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: this.hashPassword(dto.password),
      },
    });

    await this.prisma.verificationCode.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    return this.createSession(updatedUser);
  }

  async verifySignupCode(email: string, code: string): Promise<void> {
    await this.assertValidSignupCode(email, code);
  }

  private async assertValidSignupCode(email: string, code: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or code');
    }

    const record = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.codeHash !== this.hash(code.trim())) {
      throw new UnauthorizedException('Invalid email or code');
    }

    return user;
  }

  async signIn(email: string, password: string): Promise<SessionPayload> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordHash = user.passwordHash;
    if (!this.verifyPassword(password, passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  async getUserFromCookieHeader(
    cookieHeader: string | undefined,
  ): Promise<SessionPayload['user'] | null> {
    if (!cookieHeader) {
      return null;
    }

    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      return null;
    }

    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.authSession.delete({ where: { id: session.id } });
      }
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
    };
  }

  async requireUser(cookieHeader: string | undefined) {
    const user = await this.getUserFromCookieHeader(cookieHeader);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  }

  writeSessionCookie(
    res: { setHeader(name: string, value: string): void },
    token: string,
  ) {
    res.setHeader(
      'Set-Cookie',
      buildCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.get<string>('NODE_ENV') === 'production',
        path: '/',
        maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      }),
    );
  }

  clearSessionCookie(res: { setHeader(name: string, value: string): void }) {
    res.setHeader(
      'Set-Cookie',
      buildCookie(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.get<string>('NODE_ENV') === 'production',
        path: '/',
        expires: new Date(0),
      }),
    );
  }

  async logout(cookieHeader: string | undefined): Promise<void> {
    if (!cookieHeader) {
      return;
    }

    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      return;
    }

    await this.prisma.authSession.deleteMany({
      where: { tokenHash: this.hash(token) },
    });
  }
}
