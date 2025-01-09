import { Controller, Post, Body, Put, Param, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentOrderDto, UpdatePaymentOrderDto, CreateTransactionDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@ApiTags('支付')
@Controller('payment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('orders')
  @ApiOperation({ summary: '创建支付订单' })
  @ApiResponse({ status: 201, description: '支付订单创建成功' })
  async createPaymentOrder(
    @User('id') userId: number,
    @Body() createPaymentOrderDto: CreatePaymentOrderDto,
  ) {
    createPaymentOrderDto.userId = userId;
    return this.paymentService.createPaymentOrder(createPaymentOrderDto);
  }

  @Put('orders/:id')
  @ApiOperation({ summary: '更新支付订单' })
  @ApiResponse({ status: 200, description: '支付订单更新成功' })
  async updatePaymentOrder(
    @Param('id') id: string,
    @Body() updatePaymentOrderDto: UpdatePaymentOrderDto,
  ) {
    return this.paymentService.updatePaymentOrder(parseInt(id), updatePaymentOrderDto);
  }

  @Post('transactions')
  @ApiOperation({ summary: '创建交易记录' })
  @ApiResponse({ status: 201, description: '交易记录创建成功' })
  async createTransaction(
    @User('id') userId: number,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    createTransactionDto.userId = userId;
    return this.paymentService.createTransaction(createTransactionDto);
  }

  @Get('transactions/user')
  @ApiOperation({ summary: '获取用户交易记录' })
  @ApiResponse({ status: 200, description: '获取用户交易记录成功' })
  async getUserTransactions(@User('id') userId: number) {
    return this.paymentService.getUserTransactions(userId);
  }

  @Get('orders/user')
  @ApiOperation({ summary: '获取用户支付订单' })
  @ApiResponse({ status: 200, description: '获取用户支付订单成功' })
  async getUserPaymentOrders(@User('id') userId: number) {
    return this.paymentService.getUserPaymentOrders(userId);
  }
} 