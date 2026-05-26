import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-bulog-wms-key',
    });
  }

  async validate(payload: { email: string; sub: number }) {
    const user = await this.userService.findByEmail(payload.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesi tidak valid atau akun dinonaktifkan');
    }
    return user;
  }
}
