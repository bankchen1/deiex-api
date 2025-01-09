import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly supabase: SupabaseService) {}

  async findOne(id: string) {
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return user;
  }

  async findByEmail(email: string) {
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return user;
  }

  async create(createUserDto: any) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const { data: user, error } = await this.supabase.client
      .from('users')
      .insert([
        {
          ...createUserDto,
          password: hashedPassword,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return user;
  }

  async update(id: string, updateUserDto: any) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const { data: user, error } = await this.supabase.client
      .from('users')
      .update(updateUserDto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return user;
  }

  async remove(id: string) {
    const { error } = await this.supabase.client
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async submitKyc(userId: string, kycData: any): Promise<void> {
    const { error } = await this.supabase.client
      .from('kyc_verifications')
      .insert([{ user_id: userId, ...kycData }]);

    if (error) throw error;
  }

  async getKycStatus(userId: string) {
    const { data: kyc, error } = await this.supabase.client
      .from('kyc_verifications')
      .select('status, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return kyc;
  }
}
