import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../shared/supabase/supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('用户不存在或已被删除');
    }

    // 检查用户状态
    if (!user.active) {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 返回用户信息（不包含敏感数据）
    const { password, two_factor_secret, ...result } = user;
    return result;
  }
}
