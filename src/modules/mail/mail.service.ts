import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(email: string, token: string) {
    // TODO: 实现邮件发送逻辑
    console.log(`发送验证邮件到 ${email}，token: ${token}`);
  }

  async sendPasswordResetEmail(email: string, token: string) {
    // TODO: 实现邮件发送逻辑
    console.log(`发送密码重置邮件到 ${email}，token: ${token}`);
  }
}
