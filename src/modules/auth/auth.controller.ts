import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { 
  LoginDto, 
  RegisterDto, 
  ResetPasswordDto, 
  ChangePasswordDto,
  Enable2FADto,
  Verify2FADto
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户注册
   * @param registerDto 注册信息
   * @returns 注册成功的用户信息和token
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '注册成功' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '注册信息无效' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '用户已存在' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * 用户登录
   * @param loginDto 登录信息
   * @returns 登录成功的用户信息和token
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: HttpStatus.OK, description: '登录成功' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '登录失败' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * 获取当前用户信息
   * @param user 当前用户
   * @returns 用户详细信息
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户信息' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功' })
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  /**
   * 重置密码请求
   * @param resetPasswordDto 重置密码信息
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '请求重置密码' })
  @ApiResponse({ status: HttpStatus.OK, description: '重置密码邮件已发送' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto.email);
  }

  /**
   * 修改密码
   * @param user 当前用户
   * @param changePasswordDto 修改密码信息
   */
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: HttpStatus.OK, description: '密码修改成功' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  /**
   * 启用/禁用两步验证
   * @param user 当前用户
   * @param enable2FADto 两步验证配置
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '配置两步验证' })
  @ApiResponse({ status: HttpStatus.OK, description: '两步验证配置成功' })
  async enable2FA(
    @CurrentUser() user: User,
    @Body() enable2FADto: Enable2FADto,
  ) {
    return this.authService.configure2FA(user.id, enable2FADto);
  }

  /**
   * 验证两步验证码
   * @param user 当前用户
   * @param verify2FADto 验证码信息
   */
  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证两步验证码' })
  @ApiResponse({ status: HttpStatus.OK, description: '验证成功' })
  async verify2FA(
    @CurrentUser() user: User,
    @Body() verify2FADto: Verify2FADto,
  ) {
    return this.authService.verify2FA(user.id, verify2FADto.code);
  }

  /**
   * 发送邮箱验证邮件
   * @param user 当前用户
   */
  @Post('email/verify/send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送邮箱验证邮件' })
  @ApiResponse({ status: HttpStatus.OK, description: '验证邮件已发送' })
  async sendVerificationEmail(@CurrentUser() user: User) {
    return this.authService.sendVerificationEmail(user.id);
  }

  /**
   * 验证邮箱
   * @param token 验证token
   */
  @Get('email/verify/:token')
  @ApiOperation({ summary: '验证邮箱' })
  @ApiResponse({ status: HttpStatus.OK, description: '邮箱验证成功' })
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}
