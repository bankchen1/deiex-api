import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @ApiOperation({ summary: '获取用户信息' })
  @ApiResponse({ status: 200, description: '成功获取用户信息' })
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建新用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({ status: 200, description: '用户信息更新成功' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '用户删除成功' })
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Post(':id/kyc')
  @ApiOperation({ summary: '提交 KYC 验证' })
  @ApiResponse({ status: 201, description: 'KYC 信息提交成功' })
  async submitKyc(@Param('id') id: string, @Body() kycData: any) {
    return this.userService.submitKyc(id, kycData);
  }

  @Get(':id/kyc')
  @ApiOperation({ summary: '获取 KYC 状态' })
  @ApiResponse({ status: 200, description: '成功获取 KYC 状态' })
  async getKycStatus(@Param('id') id: string) {
    return this.userService.getKycStatus(id);
  }
}
