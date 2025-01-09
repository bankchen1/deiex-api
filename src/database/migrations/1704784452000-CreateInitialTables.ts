import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1704784452000 implements MigrationInterface {
  name = 'CreateInitialTables1704784452000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Users and Authentication
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "username" varchar NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "role" varchar NOT NULL DEFAULT 'user',
        "twoFactorSecret" varchar,
        "twoFactorEnabled" boolean DEFAULT false,
        "phoneNumber" varchar,
        "phoneVerified" boolean DEFAULT false,
        "lastLoginAt" TIMESTAMP,
        "lastLoginIp" varchar,
        "failedLoginAttempts" integer DEFAULT 0,
        "lockUntil" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "language" varchar DEFAULT 'en',
        "timezone" varchar DEFAULT 'UTC',
        "notificationPreferences" jsonb DEFAULT '{}',
        "tradingPreferences" jsonb DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_kyc" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "level" integer NOT NULL DEFAULT 1,
        "firstName" varchar,
        "lastName" varchar,
        "dateOfBirth" date,
        "nationality" varchar,
        "documentType" varchar,
        "documentNumber" varchar,
        "documentFiles" jsonb,
        "verificationNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_kyc_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    // Trading
    await queryRunner.query(`
      CREATE TABLE "trading_pairs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "symbol" varchar NOT NULL UNIQUE,
        "baseAsset" varchar NOT NULL,
        "quoteAsset" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "minPrice" decimal(32,8) NOT NULL,
        "maxPrice" decimal(32,8) NOT NULL,
        "tickSize" decimal(32,8) NOT NULL,
        "minQty" decimal(32,8) NOT NULL,
        "maxQty" decimal(32,8) NOT NULL,
        "stepSize" decimal(32,8) NOT NULL,
        "makerFee" decimal(32,8) NOT NULL DEFAULT 0,
        "takerFee" decimal(32,8) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "symbol" varchar NOT NULL,
        "type" varchar NOT NULL,
        "side" varchar NOT NULL,
        "price" decimal(32,8),
        "quantity" decimal(32,8) NOT NULL,
        "filledQuantity" decimal(32,8) DEFAULT 0,
        "remainingQuantity" decimal(32,8),
        "status" varchar NOT NULL,
        "timeInForce" varchar NOT NULL DEFAULT 'GTC',
        "stopPrice" decimal(32,8),
        "icebergQty" decimal(32,8),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_order_user" FOREIGN KEY ("userId") REFERENCES "users"("id"),
        CONSTRAINT "fk_order_pair" FOREIGN KEY ("symbol") REFERENCES "trading_pairs"("symbol")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "trades" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "symbol" varchar NOT NULL,
        "side" varchar NOT NULL,
        "price" decimal(32,8) NOT NULL,
        "quantity" decimal(32,8) NOT NULL,
        "fee" decimal(32,8) NOT NULL,
        "feeCurrency" varchar NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_trade_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id"),
        CONSTRAINT "fk_trade_user" FOREIGN KEY ("userId") REFERENCES "users"("id"),
        CONSTRAINT "fk_trade_pair" FOREIGN KEY ("symbol") REFERENCES "trading_pairs"("symbol")
      )
    `);

    // Asset Management
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "currency" varchar NOT NULL,
        "address" varchar,
        "tag" varchar,
        "balance" decimal(32,8) NOT NULL DEFAULT 0,
        "frozenBalance" decimal(32,8) NOT NULL DEFAULT 0,
        "totalDeposited" decimal(32,8) NOT NULL DEFAULT 0,
        "totalWithdrawn" decimal(32,8) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uk_user_currency" UNIQUE ("userId", "currency"),
        CONSTRAINT "fk_wallet_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "deposits" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "walletId" uuid NOT NULL,
        "currency" varchar NOT NULL,
        "amount" decimal(32,8) NOT NULL,
        "status" varchar NOT NULL,
        "txid" varchar,
        "address" varchar NOT NULL,
        "tag" varchar,
        "confirmations" integer DEFAULT 0,
        "requiredConfirmations" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_deposit_user" FOREIGN KEY ("userId") REFERENCES "users"("id"),
        CONSTRAINT "fk_deposit_wallet" FOREIGN KEY ("walletId") REFERENCES "wallets"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "withdrawals" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "walletId" uuid NOT NULL,
        "currency" varchar NOT NULL,
        "amount" decimal(32,8) NOT NULL,
        "fee" decimal(32,8) NOT NULL,
        "status" varchar NOT NULL,
        "txid" varchar,
        "address" varchar NOT NULL,
        "tag" varchar,
        "memo" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_withdrawal_user" FOREIGN KEY ("userId") REFERENCES "users"("id"),
        CONSTRAINT "fk_withdrawal_wallet" FOREIGN KEY ("walletId") REFERENCES "wallets"("id")
      )
    `);

    // Social Trading
    await queryRunner.query(`
      CREATE TABLE "trader_profiles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "nickname" varchar NOT NULL,
        "biography" text,
        "experience" integer DEFAULT 0,
        "totalCopiers" integer DEFAULT 0,
        "rating" decimal(3,2) DEFAULT 0,
        "profitRate" decimal(32,8) DEFAULT 0,
        "riskLevel" varchar DEFAULT 'medium',
        "status" varchar NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_trader_profile_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "copy_trading_relationships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "followerId" uuid NOT NULL,
        "traderId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "copyRatio" decimal(32,8) NOT NULL DEFAULT 1,
        "maxPositionSize" decimal(32,8),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_copy_follower" FOREIGN KEY ("followerId") REFERENCES "users"("id"),
        CONSTRAINT "fk_copy_trader" FOREIGN KEY ("traderId") REFERENCES "users"("id")
      )
    `);

    // Risk Management
    await queryRunner.query(`
      CREATE TABLE "risk_limits" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "maxDailyWithdrawal" decimal(32,8),
        "maxPositionSize" decimal(32,8),
        "maxLeverage" integer,
        "maxDrawdown" decimal(5,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_risk_limit_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "action" varchar NOT NULL,
        "category" varchar NOT NULL,
        "details" jsonb,
        "ipAddress" varchar,
        "userAgent" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_audit_log_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    // Notifications
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "content" text NOT NULL,
        "read" boolean DEFAULT false,
        "data" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notification_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "risk_limits"`);
    await queryRunner.query(`DROP TABLE "copy_trading_relationships"`);
    await queryRunner.query(`DROP TABLE "trader_profiles"`);
    await queryRunner.query(`DROP TABLE "withdrawals"`);
    await queryRunner.query(`DROP TABLE "deposits"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TABLE "trades"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "trading_pairs"`);
    await queryRunner.query(`DROP TABLE "user_kyc"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP EXTENSION "uuid-ossp"`);
  }
}
