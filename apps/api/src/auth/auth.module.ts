import { Body, ConflictException, Controller, Get, HttpCode, Injectable, Module, Post, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { TOKEN_COOKIE } from '../common/guards';
import { PrismaService } from '../common/prisma.service';
import { PLAN_LIMITS } from '../common/plans';

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) @MaxLength(100) password: string;
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private audit: AuditService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('An account with this email already exists.');
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        company: dto.company?.trim(),
        passwordHash: await bcrypt.hash(dto.password, 10),
        subscription: { create: { plan: 'FREE', status: 'TRIALING' } },
      },
    });
    await this.audit.log(user.id, 'user.register', 'User', user.id);
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password.');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('This account is suspended. Contact support.');
    await this.audit.log(user.id, 'user.login', 'User', user.id);
    return user;
  }

  sign(userId: string) {
    return this.jwt.signAsync({ sub: userId });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, company: true, phone: true, createdAt: true, subscription: true },
    });
    const plan = user.subscription?.plan ?? 'FREE';
    return { ...user, limits: PLAN_LIMITS[plan] };
  }
}

function setCookie(res: Response, jwt: string) {
  res.cookie(TOKEN_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    const token = await this.auth.sign(user.id);
    setCookie(res, token);
    return { user: await this.auth.me(user.id), token };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto);
    const token = await this.auth.sign(user.id);
    setCookie(res, token);
    return { user: await this.auth.me(user.id), token };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(TOKEN_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
