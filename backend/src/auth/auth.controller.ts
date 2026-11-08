import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
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
  getProfile(@Req() req: Request) {
    return req.user;
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

  @Get('logout')
  @UseGuards(AuthenticatedGuard)
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
