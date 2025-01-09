# 交易所API重构方案

## 当前状况

目前项目中存在两套API实现：
1. `/src` - 基于NestJS框架的新版本
2. `/exchange-api` - 基于Express框架的旧版本

### 现有项目结构对比

#### NestJS版本 (`/src`)
```
/src
├── app.module.ts              # 根模块
├── main.ts                    # 入口点
├── config/                    # 配置目录
├── modules/                   # 功能模块
│   ├── asset/                # 资产模块
│   ├── auth/                 # 认证模块
│   ├── market/               # 市场模块
│   ├── trade/                # 交易模块
│   ├── copy-trading/         # 跟单交易
│   ├── trading/              # 交易引擎
│   └── user/                 # 用户模块
└── shared/                   # 共享模块
    └── supabase/             # 数据库集成
```


## 重构目标

1. 统一到NestJS框架，移除Express实现
2. 整合并优化现有功能模块
3. 提升系统架构，增强可维护性和可扩展性

## 重构计划

### 1. 模块迁移和整合

#### 1.1 核心模块重构
- **认证模块** (auth)
  - 迁移Express的认证逻辑到NestJS Guards
  - 统一JWT处理和会话管理

- **市场模块** (market)
  - 整合行情数据处理
  - 迁移WebSocket实现到NestJS Gateway

- **交易模块** (trade)
  - 合并订单和交易逻辑
  - 优化交易引擎实现

- **用户模块** (user)
  - 整合用户管理功能
  - 添加KYC和权限管理

#### 1.2 共享模块优化
- 统一数据库访问层
- 集中化日志管理
- 统一错误处理
- 公共工具函数库

### 2. 架构优化

#### 2.1 新增功能
- 分布式任务队列
- 健康检查服务
- API版本控制
- 性能监控

#### 2.2 开发体验优化
- 完善API文档
- 增强测试覆盖
- 开发环境配置
- CI/CD流程优化

## 具体实施步骤

### 第一阶段：基础架构迁移
1. 设置NestJS项目结构
2. 迁移数据库访问层
3. 实现基础认证功能
4. 添加核心中间件

### 第二阶段：业务逻辑迁移
1. 迁移用户管理模块
2. 迁移市场数据模块
3. 迁移交易功能模块
4. 实现WebSocket服务

### 第三阶段：功能优化和测试
1. 添加新功能特性
2. 编写单元测试
3. 性能测试和优化
4. 文档更新

## 详细文件迁移映射

### 1. 核心文件迁移
| Express文件 | NestJS对应 | 说明 |
|------------|------------|------|
| app.ts | main.ts + app.module.ts | 应用引导和模块配置 |
| server.ts | main.ts | 服务器配置整合到main.ts |
| index.ts | main.ts | 入口文件合并 |

### 2. 配置文件迁移
| Express目录/文件 | NestJS对应 | 说明 |
|-----------------|------------|------|
| config/* | src/config/* | 配置文件迁移 |
| .env files | src/config/env.config.ts | 环境配置整合 |

### 3. 模块迁移
| Express模块 | NestJS模块 | 说明 |
|------------|------------|------|
| controllers/* | src/modules/*/controllers/* | 控制器迁移到对应模块 |
| services/* | src/modules/*/services/* | 服务迁移到对应模块 |
| routes/* | src/modules/*/controllers/* | 路由合并到控制器 |
| middleware/* | src/common/middleware/* | 中间件迁移 |
| middlewares/* | src/common/middleware/* | 中间件统一管理 |
| entities/* | src/modules/*/entities/* | 实体类按模块迁移 |
| models/* | src/modules/*/models/* | 数据模型按模块迁移 |
| validators/* | src/common/validators/* | 验证器迁移 |
| websocket/* | src/modules/websocket/* | WebSocket网关迁移 |

### 4. 基础设施迁移
| Express目录 | NestJS目录 | 说明 |
|------------|------------|------|
| infrastructure/* | src/infrastructure/* | 基础设施代码迁移 |
| lib/* | src/lib/* | 核心库迁移 |
| database/* | src/database/* | 数据库相关代码迁移 |
| commands/* | src/commands/* | 命令行工具迁移 |

### 5. 共享代码迁移
| Express目录 | NestJS目录 | 说明 |
|------------|------------|------|
| shared/* | src/shared/* | 共享代码迁移 |
| utils/* | src/utils/* | 工具函数迁移 |
| types/* | src/types/* | 类型定义迁移 |

### 6. 测试和文档迁移
| Express目录 | NestJS目录 | 说明 |
|------------|------------|------|
| test/* | test/* | 测试文件迁移并改写 |
| docs/* | docs/* | API文档迁移 |

## 详细模块迁移计划

### 1. 基础设施模块
```typescript
// NestJS infrastructure module
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(),
    RedisModule.forRoot(),
  ],
  exports: [ConfigService, DatabaseService, RedisService],
})
export class InfrastructureModule {}
```

### 2. 认证模块
```typescript
// NestJS auth module
@Module({
  imports: [
    JwtModule.register({}),
    PassportModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
  ],
})
export class AuthModule {}
```

### 3. WebSocket模块
```typescript
// NestJS WebSocket gateway
@WebSocketGateway()
export class MarketGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    // WebSocket初始化逻辑
  }
}
```

### 4. 中间件迁移
```typescript
// NestJS middleware
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 日志记录逻辑
    next();
  }
}
```

## 迁移步骤详解

1. **基础设施迁移**
   - 配置管理
   - 数据库连接
   - Redis集成
   - 日志系统
   - 错误处理

2. **核心模块迁移**
   - 用户认证
   - 市场数据
   - 订单管理
   - 资产管理
   - WebSocket服务

3. **业务逻辑迁移**
   - 控制器改写
   - 服务层迁移
   - 实体映射
   - 验证器适配

4. **测试和文档**
   - 单元测试改写
   - E2E测试迁移
   - API文档更新
   - Swagger配置

## 时间规划

1. **准备阶段** (1周)
   - 项目结构规划
   - 开发环境搭建
   - 技术方案确认

2. **基础架构** (2周)
   - 核心模块迁移
   - 数据库层适配
   - 基础服务搭建

3. **业务迁移** (3周)
   - 各业务模块迁移
   - 功能测试
   - 性能优化

4. **优化完善** (2周)
   - 新功能开发
   - 文档完善
   - 上线准备

## 风险管理

1. **数据一致性**
   - 迁移过程中确保数据不丢失
   - 保持新旧系统同步

2. **性能问题**
   - 及时进行性能测试
   - 监控系统资源使用

3. **兼容性**
   - 确保API接口兼容
   - 平滑升级策略

## 后续规划

1. **监控体系**
   - ELK日志系统
   - Prometheus监控
   - Grafana可视化

2. **扩展性优化**
   - 微服务拆分
   - 容器化部署
   - 自动扩缩容

3. **持续优化**
   - 代码质量
   - 测试覆盖
   - 文档维护

## 代码迁移示例

### 认证模块迁移

```typescript
// 原Express实现
router.post('/login', (req, res) => {
  authService.login(req.body);
});

// NestJS实现
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

### 中间件迁移

```typescript
// 原Express中间件
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// NestJS异常过滤器
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    response.status(status).json({
      message: exception.message
    });
  }
}
