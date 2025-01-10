import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserBalance(userId: string, currency: string) {
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });

    if (!balance) {
      return {
        available: '0',
        locked: '0',
        total: '0',
      };
    }

    return {
      available: balance.available,
      locked: balance.locked,
      total: (parseFloat(balance.available) + parseFloat(balance.locked)).toString(),
    };
  }

  async freezeBalance(userId: string, currency: string, amount: string) {
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });

    if (!balance) {
      throw new BadRequestException('Insufficient balance');
    }

    const available = parseFloat(balance.available);
    const amountToFreeze = parseFloat(amount);

    if (available < amountToFreeze) {
      throw new BadRequestException('Insufficient balance');
    }

    await this.prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
      data: {
        available: (available - amountToFreeze).toString(),
        locked: (parseFloat(balance.locked) + amountToFreeze).toString(),
      },
    });
  }

  async unfreezeBalance(userId: string, currency: string, amount: string) {
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });

    if (!balance) {
      throw new BadRequestException('Balance not found');
    }

    const locked = parseFloat(balance.locked);
    const amountToUnfreeze = parseFloat(amount);

    if (locked < amountToUnfreeze) {
      throw new BadRequestException('Invalid unfreeze amount');
    }

    await this.prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
      data: {
        available: (parseFloat(balance.available) + amountToUnfreeze).toString(),
        locked: (locked - amountToUnfreeze).toString(),
      },
    });
  }
}
