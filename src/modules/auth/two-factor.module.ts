import { Module } from '@nestjs/common';
import { TwoFactorService } from './services/two-factor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {} 