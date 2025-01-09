import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记公开路由的装饰器
 * 使用方式: @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
