import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedInitialData1704784453000 implements MigrationInterface {
  name = 'SeedInitialData1704784453000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert admin user
    const hashedPassword = await bcrypt.hash('Admin123456', 10);
    await queryRunner.query(`
      INSERT INTO "users" (id, email, username, password, status, role)
      VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        'admin@deiex.com',
        'admin',
        '${hashedPassword}',
        'active',
        'admin'
      )
    `);

    // Insert test user
    const testUserPassword = await bcrypt.hash('Test123456', 10);
    await queryRunner.query(`
      INSERT INTO "users" (id, email, username, password, status, role)
      VALUES (
        '550e8400-e29b-41d4-a716-446655440001',
        'test@deiex.com',
        'testuser',
        '${testUserPassword}',
        'active',
        'user'
      )
    `);

    // Insert trading pairs
    const tradingPairs = [
      {
        symbol: 'BTC-USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        status: 'active',
        minPrice: '0.01',
        maxPrice: '1000000',
        tickSize: '0.01',
        minQty: '0.00001',
        maxQty: '1000',
        stepSize: '0.00001',
        makerFee: '0.001',
        takerFee: '0.001'
      },
      {
        symbol: 'ETH-USDT',
        baseAsset: 'ETH',
        quoteAsset: 'USDT',
        status: 'active',
        minPrice: '0.01',
        maxPrice: '100000',
        tickSize: '0.01',
        minQty: '0.0001',
        maxQty: '10000',
        stepSize: '0.0001',
        makerFee: '0.001',
        takerFee: '0.001'
      },
      {
        symbol: 'BNB-USDT',
        baseAsset: 'BNB',
        quoteAsset: 'USDT',
        status: 'active',
        minPrice: '0.01',
        maxPrice: '10000',
        tickSize: '0.01',
        minQty: '0.001',
        maxQty: '100000',
        stepSize: '0.001',
        makerFee: '0.001',
        takerFee: '0.001'
      }
    ];

    for (const pair of tradingPairs) {
      await queryRunner.query(`
        INSERT INTO "trading_pairs" (
          symbol,
          "baseAsset",
          "quoteAsset",
          status,
          "minPrice",
          "maxPrice",
          "tickSize",
          "minQty",
          "maxQty",
          "stepSize",
          "makerFee",
          "takerFee"
        ) VALUES (
          '${pair.symbol}',
          '${pair.baseAsset}',
          '${pair.quoteAsset}',
          '${pair.status}',
          ${pair.minPrice},
          ${pair.maxPrice},
          ${pair.tickSize},
          ${pair.minQty},
          ${pair.maxQty},
          ${pair.stepSize},
          ${pair.makerFee},
          ${pair.takerFee}
        )
      `);
    }

    // Create initial wallets for test user
    const currencies = ['BTC', 'ETH', 'USDT', 'BNB'];
    for (const currency of currencies) {
      await queryRunner.query(`
        INSERT INTO "wallets" (
          "userId",
          currency,
          balance,
          "frozenBalance",
          "totalDeposited",
          "totalWithdrawn"
        ) VALUES (
          '550e8400-e29b-41d4-a716-446655440001',
          '${currency}',
          1000,
          0,
          1000,
          0
        )
      `);
    }

    // Insert user settings for test user
    await queryRunner.query(`
      INSERT INTO "user_settings" (
        "userId",
        language,
        timezone,
        "notificationPreferences",
        "tradingPreferences"
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440001',
        'en',
        'UTC',
        '{"email": true, "sms": false, "push": true}',
        '{"defaultLeverage": 1, "defaultMarginType": "cross"}'
      )
    `);

    // Insert risk limits for test user
    await queryRunner.query(`
      INSERT INTO "risk_limits" (
        "userId",
        "maxDailyWithdrawal",
        "maxPositionSize",
        "maxLeverage",
        "maxDrawdown"
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440001',
        10000,
        100000,
        20,
        50
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete data in reverse order
    await queryRunner.query(`DELETE FROM "risk_limits"`);
    await queryRunner.query(`DELETE FROM "user_settings"`);
    await queryRunner.query(`DELETE FROM "wallets"`);
    await queryRunner.query(`DELETE FROM "trading_pairs"`);
    await queryRunner.query(`DELETE FROM "users"`);
  }
}
