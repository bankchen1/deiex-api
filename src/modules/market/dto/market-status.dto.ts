import { ApiProperty } from '@nestjs/swagger';

export class MarketStatusDto {
  @ApiProperty({ description: 'Market status (running, maintenance)' })
  status: string;

  @ApiProperty({ description: 'Status timestamp' })
  timestamp: number;

  @ApiProperty({ description: 'Whether market is under maintenance' })
  maintenance: boolean;

  @ApiProperty({ description: 'Optional status message', required: false })
  message: string | null;
}
