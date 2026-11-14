import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserProfileDto } from '../users/dto/user-profile.dto.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import type { Request, Response } from 'express';
import { AuthenticatedGuard } from './guards/authenticated.guard.js';
import { Roles } from '../roles/roles.decorator.js';
import { Role } from '../roles/roles.enum.js';
import { RoleGuard } from '../roles/role.guard.js';

@Controller('auth')
export class AuthController {
  @Get('google/login')
  @UseGuards(GoogleAuthGuard)
  handleLogin() {
    return { msg: 'Google Authentication' };
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  handleRedirect(@Res() response: Response) {
    const destination =
      process.env.NODE_ENV === 'production'
        ? '/competitions'
        : 'http://localhost:5173/competitions';
    return response.redirect(destination);
  }

  @Get('status')
  user(@Req() request: Request) {
    if (request.user) {
      return { msg: 'Authenticated' };
    } else {
      return { msg: 'Not Authenticated' };
    }
  }

  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Profil prijavljenog korisnika' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  getProfile(@Req() req: Request): UserProfileDto {
    return UserProfileDto.fromUser(req.user!);
  }

  @Get('organizer')
  @UseGuards(AuthenticatedGuard, RoleGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  getOrganizerContent() {
    return { msg: 'Welcome, organizer!' };
  }

  @Get('admin')
  @UseGuards(AuthenticatedGuard, RoleGuard)
  @Roles(Role.ADMIN)
  getAdminContent() {
    return { msg: 'Welcome, admin!' };
  }

  @Post('logout')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Odjava prijavljenog korisnika' })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  async logout(@Req() req: Request, @Res() res: Response) {
    req.logout((err) => {
      if (err) {
        return res.status(500).send('Logout failed');
      }

      req.session.destroy(() => {
        res.clearCookie('connect.sid');

        return res.json({
          message: 'Successfully logged out',
        });
      });
    });
  }
}
