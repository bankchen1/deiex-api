import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // 检查 token 是否在黑名单中
    const isBlacklisted = await this.redis.get(`token:blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token已失效，请重新登录');
    }

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        status: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在或已被删除');
    }

    // 检查用户状态
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 返回用户信息（不包含敏感数据）
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
