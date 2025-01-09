import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * 用户注册
   * @param registerDto 注册信息
   * @returns 注册成功的用户信息和token
   */
  async register(registerDto: RegisterDto) {
    // 检查用户是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: registerDto.email },
          { username: registerDto.username }
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('用户已存在');
    }

    // 创建新用户
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        username: registerDto.username,
        password: hashedPassword,
        emailVerified: false,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      }
    });

    // 生成 JWT token
    const token = this.generateToken(user.id);

    // 发送验证邮件
    await this.sendVerificationEmail(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
      },
      token,
    };
  }

  /**
   * 用户登录
   * @param loginDto 登录信息
   * @returns 登录成功的用户信息和token
   */
  async login(loginDto: LoginDto) {
    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        emailVerified: true,
        status: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 检查用户状态
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 生成 token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
      },
      token,
    };
  }

  /**
   * 用户登出
   * @param token JWT token
   */
  async logout(token: string) {
    try {
      // 解码 token
      const payload = this.jwtService.verify(token.replace('Bearer ', ''));
      
      // 将 token 加入黑名单
      const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
      await this.redis.set(
        `token:blacklist:${payload.jti}`,
        '1',
        'EX',
        expiresIn > 0 ? expiresIn : 0
      );
    } catch (error) {
      // 如果 token 已经过期或无效，直接返回
      return;
    }
  }

  /**
   * 获取用户信息
   * @param userId 用户ID
   * @returns 用户详细信息
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
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
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }

  /**
   * 修改密码
   * @param userId 用户ID
   * @param changePasswordDto 修改密码信息
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        password: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('旧密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  /**
   * 发送邮箱验证邮件
   * @param userId 用户ID
   */
  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 生成验证token
    const verificationToken = this.jwtService.sign(
      { sub: userId, type: 'email_verification' },
      { expiresIn: '24h' },
    );

    // 发送验证邮件
    await this.mailService.sendVerificationEmail(user.email, verificationToken);
  }

  /**
   * 验证邮箱
   * @param token 验证token
   */
  async verifyEmail(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'email_verification') {
        throw new UnauthorizedException('无效的验证token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      if (user.status === 'DISABLED') {
        throw new UnauthorizedException('账户已被禁用');
      }

      await this.prisma.user.update({
        where: {
          id: payload.sub,
        },
        data: {
          emailVerified: true,
        },
      });
    } catch (error) {
      throw new UnauthorizedException('验证token已过期或无效');
    }
  }

  /**
   * 重置密码
   * @param email 用户邮箱
   */
  async resetPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      // 为了安全，即使用户不存在也返回成功
      return;
    }

    if (user.status === 'DISABLED') {
      // 为了安全，即使账户被禁用也返回成功
      return;
    }

    // 生成重置密码token
    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password_reset' },
      { expiresIn: '1h' },
    );

    // 发送重置密码邮件
    await this.mailService.sendPasswordResetEmail(email, resetToken);
  }

  private generateToken(userId: string): string {
    const jti = uuidv4(); // 生成唯一的 token ID
    return this.jwtService.sign(
      { 
        sub: userId,
        jti,
      },
      {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '1d'),
      }
    );
  }
}
