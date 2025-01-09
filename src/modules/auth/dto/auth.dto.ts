import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: '用户邮箱' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '用户密码' })
  @IsString()
  @MinLength(8, { message: '密码长度至少为8位' })
  password: string;

  @ApiProperty({ description: '用户名' })
  @IsString()
  @MinLength(3, { message: '用户名长度至少为3位' })
  username: string;

  @ApiProperty({ description: '名字' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: '姓氏' })
  @IsString()
  lastName: string;
}

export class LoginDto {
  @ApiProperty({ description: '用户邮箱' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '用户密码' })
  @IsString()
  password: string;

  @ApiProperty({ description: '两步验证码', required: false })
  @IsString()
  @IsOptional()
  twoFactorCode?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '用户邮箱' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  @MinLength(8, { message: '密码长度至少为8位' })
  newPassword: string;
}

export class Enable2FADto {
  @ApiProperty({ description: '是否启用两步验证' })
  @IsBoolean()
  enable: boolean;

  @ApiProperty({ description: '两步验证码', required: false })
  @IsString()
  @IsOptional()
  code?: string;
}

export class Verify2FADto {
  @ApiProperty({ description: '两步验证码' })
  @IsString()
  code: string;
}
