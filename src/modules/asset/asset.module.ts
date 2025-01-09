import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { SupabaseModule } from '../../shared/supabase/supabase.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
  ],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}
