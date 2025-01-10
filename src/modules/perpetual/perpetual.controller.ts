import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PerpetualService } from './services/perpetual.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('perpetual')
@UseGuards(JwtAuthGuard)
export class PerpetualController {
  constructor(private readonly perpetualService: PerpetualService) {}

  @Post('orders')
  async createOrder(@User() user: any, @Body() orderData: any) {
    return this.perpetualService.createOrder(user.id, orderData);
  }

  @Get('orders')
  async getOpenOrders(@User() user: any) {
    return this.perpetualService.getOpenOrders(user.id);
  }

  @Post('orders/:orderId/cancel')
  async cancelOrder(@User() user: any, @Param('orderId') orderId: string) {
    return this.perpetualService.cancelOrder(user.id, orderId);
  }

  @Get('positions')
  async getPositions(
    @User() user: any,
    @Query('symbol') symbol: string,
    @Query('side') side: string,
  ) {
    return this.perpetualService.getPosition(user.id, symbol, side);
  }
}
