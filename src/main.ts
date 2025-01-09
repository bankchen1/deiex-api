import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  console.log('Starting application...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });

  console.log('Application created successfully');

  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  // 启用 CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  console.log('Configuring Swagger...');

  // 配置 Swagger
  const config = new DocumentBuilder()
    .setTitle('DEiEX Exchange API')
    .setDescription('DEiEX 加密货币交易所 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    // 用户认证
    .addTag('Auth', '认证相关接口')
    .addTag('User', '用户管理接口')
    // 交易相关
    .addTag('Market', '市场行情接口')
    .addTag('Trade', '交易相关接口')
    .addTag('Trade Analysis', '交易分析接口')
    .addTag('Trade Notifications', '交易通知接口')
    .addTag('Order', '订单管理接口')
    // 资产相关
    .addTag('Asset', '资产管理接口')
    .addTag('Wallet', '钱包资产接口')
    .addTag('Payment', '支付系统接口')
    // 统计分析
    .addTag('Statistics', '交易统计接口')
    // 社交交易
    .addTag('Social Trading', '社交交易接口')
    .addTag('Copy Trading', '跟单交易接口')
    .addTag('Strategy', '策略交易接口')
    .addTag('Ranking', '交易员排行榜接口')
    // 合约交易
    .addTag('Perpetual', '永续合约接口')
    .addTag('Risk', '风险控制接口')
    // 系统功能
    .addTag('Monitoring', '系统监控接口')
    .addTag('Notification', '通知中心接口')
    .addTag('WebSocket', 'WebSocket实时接口')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // 保存 Swagger JSON 到文件
  writeFileSync(
    join(__dirname, 'docs', 'swagger-spec.json'),
    JSON.stringify(document, null, 2),
    { encoding: 'utf8' }
  );

  // 设置 Swagger UI 路径
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT || 1212;
  try {
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();