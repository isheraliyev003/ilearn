import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CompleteSignupDto } from './dto/complete-signup.dto';
import { RequestEmailCodeDto } from './dto/request-email-code.dto';
import { SignInDto } from './dto/sign-in.dto';
import { VerifySignupCodeDto } from './dto/verify-signup-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sign-up/request-code')
  @HttpCode(204)
  async requestCode(@Body() dto: RequestEmailCodeDto) {
    await this.auth.requestSignupCode(dto.fullName, dto.email);
  }

  @Post('sign-up/verify-code')
  @HttpCode(204)
  async verifySignupCode(@Body() dto: VerifySignupCodeDto) {
    await this.auth.verifySignupCode(dto.email, dto.code);
  }

  @Post('sign-up/complete')
  async completeSignup(
    @Body() dto: CompleteSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.completeSignup(dto);
    this.auth.writeSessionCookie(res, session.token);
    return { user: session.user };
  }

  @Post('sign-in')
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.signIn(dto.email, dto.password);
    this.auth.writeSessionCookie(res, session.token);
    return { user: session.user };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.auth.getUserFromCookieHeader(req.headers.cookie);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.headers.cookie);
    this.auth.clearSessionCookie(res);
    return { ok: true as const };
  }
}
