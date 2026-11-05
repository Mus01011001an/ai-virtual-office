import { Body, Controller, Get, Post } from '@nestjs/common';
import { AllowAnonymous, Session, UserSession } from '@thallesp/nestjs-better-auth';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { STRICT_RATE_LIMIT } from 'src/common/constants/rate-limit';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Core - Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle(STRICT_RATE_LIMIT)
  @Post('signup')
  @AllowAnonymous()
  signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Throttle(STRICT_RATE_LIMIT)
  @Post('signin')
  @AllowAnonymous()
  signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @Post('signout')
  signOut(@Session() session: UserSession) {
    return this.authService.signOut(session);
  }

  @Get('me')
  getProfile(@Session() session: UserSession) {
    return this.authService.getProfile(session);
  }

  @Get('workspaces')
  getMyWorkspaces(@Session() session: UserSession) {
    return this.authService.getMyWorkspaces(session);
  }

  @Post('switch-company')
  switchCompany(@Session() session: UserSession, @Body('companyId') companyId: string) {
    return this.authService.switchCompany(session, companyId);
  }

  @Throttle(STRICT_RATE_LIMIT)
  @Post('change-password')
  changePassword(@Session() session: UserSession, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(session, dto);
  }
}
