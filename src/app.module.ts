import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketModule } from './modules/market/market.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AssetModule } from './modules/asset/asset.module';
import { TradeModule } from './modules/trade/trade.module';
import { SupabaseModule } from './shared/supabase/supabase.module';
import { PaymentModule } from './modules/payment/payment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { StatisticsModule } from './modules/statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    MarketModule,
    AuthModule,
    UserModule,
    AssetModule,
    TradeModule,
    PaymentModule,
    NotificationModule,
    WalletModule,
    StatisticsModule,
  ],
})
export class AppModule {}