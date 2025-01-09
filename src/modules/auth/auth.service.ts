import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { 
  LoginDto, 
  RegisterDto, 
  ChangePasswordDto,
  Enable2FADto 
} from './dto/auth.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * 用户注册
   * @param registerDto 注册信息
   * @returns 注册成功的用户信息和token
   */
  async register(registerDto: RegisterDto) {
    // 检查用户是否已存在
    const existingUser = await this.supabase
      .from('users')
      .select('*')
      .or(`email.eq.${registerDto.email},username.eq.${registerDto.username}`)
      .single();

    if (existingUser) {
      throw new ConflictException('用户已存在');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 创建用户
    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        email: registerDto.email,
        username: registerDto.username,
        password: hashedPassword,
        first_name: registerDto.firstName,
        last_name: registerDto.lastName,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    // 发送验证邮件
    await this.sendVerificationEmail(user.id);

    // 生成JWT token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
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
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', loginDto.email)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const validPassword = await bcrypt.compare(loginDto.password, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 检查两步验证
    if (user.two_factor_enabled) {
      if (!loginDto.twoFactorCode) {
        return { requireTwoFactor: true };
      }

      const isValid = this.verify2FAToken(user.two_factor_secret, loginDto.twoFactorCode);
      if (!isValid) {
        throw new UnauthorizedException('两步验证码无效');
      }
    }

    // 生成JWT token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * 获取用户信息
   * @param userId 用户ID
   * @returns 用户详细信息
   */
  async getProfile(userId: string) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*, assets(*)')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundException('用户不存在');
    }

    return this.sanitizeUser(user);
  }

  /**
   * 重置密码
   * @param email 用户邮箱
   */
  async resetPassword(email: string) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select()
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new NotFoundException('用户不存在');
    }

    // 生成重置token
    const resetToken = this.generateResetToken(user);

    // 发送重置密码邮件
    await this.mailService.sendPasswordReset(email, resetToken);

    return { message: '重置密码邮件已发送' };
  }

  /**
   * 修改密码
   * @param userId 用户ID
   * @param changePasswordDto 修改密码信息
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select()
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证当前密码
    const validPassword = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('当前密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    return { message: '密码修改成功' };
  }

  /**
   * 配置两步验证
   * @param userId 用户ID
   * @param enable2FADto 两步验证配置
   */
  async configure2FA(userId: string, enable2FADto: Enable2FADto) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select()
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundException('用户不存在');
    }

    if (enable2FADto.enable) {
      // 生成新的2FA密钥
      const secret = speakeasy.generateSecret({
        name: `Exchange:${user.email}`,
      });

      // 生成QR码
      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      // 更新用户2FA配置
      await this.supabase
        .from('users')
        .update({
          two_factor_secret: secret.base32,
          two_factor_enabled: true,
        })
        .eq('id', userId);

      return {
        secret: secret.base32,
        qrCode,
      };
    } else {
      // 禁用2FA
      await this.supabase
        .from('users')
        .update({
          two_factor_secret: null,
          two_factor_enabled: false,
        })
        .eq('id', userId);

      return { message: '两步验证已禁用' };
    }
  }

  /**
   * 验证两步验证码
   * @param userId 用户ID
   * @param code 验证码
   */
  async verify2FA(userId: string, code: string) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select()
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundException('用户不存在');
    }

    const isValid = this.verify2FAToken(user.two_factor_secret, code);
    if (!isValid) {
      throw new UnauthorizedException('验证码无效');
    }

    return { message: '验证成功' };
  }

  /**
   * 发送邮箱验证邮件
   * @param userId 用户ID
   */
  async sendVerificationEmail(userId: string) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select()
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundException('用户不存在');
    }

    // 生成验证token
    const verificationToken = this.generateEmailVerificationToken(user);

    // 发送验证邮件
    await this.mailService.sendEmailVerification(user.email, verificationToken);

    return { message: '验证邮件已发送' };
  }

  /**
   * 验证邮箱
   * @param token 验证token
   */
  async verifyEmail(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      
      await this.supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', decoded.userId);

      return { message: '邮箱验证成功' };
    } catch (error) {
      throw new UnauthorizedException('验证token无效或已过期');
    }
  }

  /**
   * 生成JWT token
   * @param user 用户信息
   * @returns JWT token
   */
  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * 生成重置密码token
   * @param user 用户信息
   * @returns 重置密码token
   */
  private generateResetToken(user: any) {
    const payload = {
      sub: user.id,
      type: 'reset_password',
    };
    return this.jwtService.sign(payload, { expiresIn: '1h' });
  }

  /**
   * 生成邮箱验证token
   * @param user 用户信息
   * @returns 邮箱验证token
   */
  private generateEmailVerificationToken(user: any) {
    const payload = {
      sub: user.id,
      type: 'email_verification',
    };
    return this.jwtService.sign(payload, { expiresIn: '24h' });
  }

  /**
   * 验证2FA token
   * @param secret 2FA密钥
   * @param token 验证码
   * @returns 是否有效
   */
  private verify2FAToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  /**
   * 清理用户敏感信息
   * @param user 用户信息
   * @returns 清理后的用户信息
   */
  private sanitizeUser(user: any) {
    const { password, two_factor_secret, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
