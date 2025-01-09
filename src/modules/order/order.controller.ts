import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  OrderResponseDto,
  CancelOrderDto,
  OrderQueryDto,
} from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully', type: OrderResponseDto })
  async createOrder(
    @Request() req,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.orderService.createOrder(req.user.id, createOrderDto);
  }

  @Delete(':orderId')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully', type: OrderResponseDto })
  async cancelOrder(
    @Request() req,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.orderService.cancelOrder(req.user.id, orderId);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order details', type: OrderResponseDto })
  async getOrder(
    @Request() req,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.orderService.getOrder(req.user.id, orderId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({ status: 200, description: 'List of orders', type: [OrderResponseDto] })
  async getOrders(
    @Request() req,
    @Query() query: OrderQueryDto,
  ): Promise<OrderResponseDto[]> {
    return this.orderService.getOrders(req.user.id, query);
  }
}
