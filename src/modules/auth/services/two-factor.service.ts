import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as speakeasy from 'speakeasy';

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  async generateSecret(userId: number) {
    const secret = speakeasy.generateSecret();
    await this.prisma.user.update({
      where: { id: userId.toString() },
      data: { twoFactorSecret: secret.base32 },
    });
    return secret;
  }

  async verify(userId: number, token: string, context?: any): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId.toString() },
    });

    if (!user?.twoFactorSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1, // 允许前后 1 个时间窗口的验证码
    });
  }

  async enable(userId: number, token: string): Promise<boolean> {
    const isValid = await this.verify(userId, token);
    if (isValid) {
      await this.prisma.user.update({
        where: { id: userId.toString() },
        data: { twoFactorEnabled: true },
      });
      return true;
    }
    return false;
  }

  async disable(userId: number, token: string): Promise<boolean> {
    const isValid = await this.verify(userId, token);
    if (isValid) {
      await this.prisma.user.update({
        where: { id: userId.toString() },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
      return true;
    }
    return false;
  }
} 