-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" TEXT NOT NULL DEFAULT '0',
    "locked" TEXT NOT NULL DEFAULT '0',
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "margin" TEXT NOT NULL,
    "timeInForce" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filledQty" TEXT NOT NULL DEFAULT '0',
    "remainingQty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "positionId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "entryPrice" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "liquidationPrice" TEXT NOT NULL,
    "margin" TEXT NOT NULL,
    "unrealizedPnl" TEXT NOT NULL,
    "realizedPnl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "profitPercent" DOUBLE PRECISION,
    "pnl" TEXT,
    "fee" TEXT,
    "makerOrderId" TEXT,
    "takerOrderId" TEXT,
    "makerUserId" TEXT,
    "takerUserId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "fee" TEXT,
    "txHash" TEXT,
    "address" TEXT,
    "chain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressWhitelist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "dailyLimit" TEXT NOT NULL,
    "dailyUsed" TEXT NOT NULL DEFAULT '0',
    "monthlyLimit" TEXT NOT NULL,
    "monthlyUsed" TEXT NOT NULL DEFAULT '0',
    "lastResetDaily" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastResetMonthly" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyConfig" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "minDeposit" TEXT NOT NULL,
    "minWithdraw" TEXT NOT NULL,
    "withdrawFee" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainConfig" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainScanStatus" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainScanStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingPair" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "operator" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_currency_key" ON "Balance"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_symbol_side_key" ON "Position"("userId", "symbol", "side");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_orderId_idx" ON "Trade"("orderId");

-- CreateIndex
CREATE INDEX "Trade_makerOrderId_idx" ON "Trade"("makerOrderId");

-- CreateIndex
CREATE INDEX "Trade_takerOrderId_idx" ON "Trade"("takerOrderId");

-- CreateIndex
CREATE INDEX "Trade_makerUserId_idx" ON "Trade"("makerUserId");

-- CreateIndex
CREATE INDEX "Trade_takerUserId_idx" ON "Trade"("takerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AddressWhitelist_userId_currency_address_chain_key" ON "AddressWhitelist"("userId", "currency", "address", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalLimit_userId_currency_key" ON "WithdrawalLimit"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyConfig_symbol_key" ON "CurrencyConfig"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "ChainConfig_chain_key" ON "ChainConfig"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "ChainScanStatus_chain_key" ON "ChainScanStatus"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "TradingPair_symbol_key" ON "TradingPair"("symbol");

-- CreateIndex
CREATE INDEX "WalletAuditLog_userId_idx" ON "WalletAuditLog"("userId");

-- CreateIndex
CREATE INDEX "WalletAuditLog_walletId_idx" ON "WalletAuditLog"("walletId");

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressWhitelist" ADD CONSTRAINT "AddressWhitelist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalLimit" ADD CONSTRAINT "WithdrawalLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
