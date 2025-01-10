import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrometheusService } from '../../shared/prometheus/prometheus.service';

@Injectable()
export class RiskManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prometheusService: PrometheusService,
  ) {}

  async calculatePositionRisk(userId: string, symbol: string, side: string): Promise<number> {
    const position = await this.prisma.position.findUnique({
      where: {
        userId_symbol_side: {
          userId,
          symbol,
          side,
        }
      }
    });

    if (!position) {
      return 0;
    }

    // 更新 Prometheus 指标
    this.prometheusService.setPositionRiskLevel(symbol, side, 0);
    return 0;
  }
} 