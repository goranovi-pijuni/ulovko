import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('redirects to the frontend after Google callback', () => {
    const response = { redirect: vi.fn() };
    controller.handleRedirect(response as any);
    expect(response.redirect).toHaveBeenCalledWith(
      process.env.NODE_ENV === 'production'
        ? '/competitions'
        : 'http://localhost:5173/competitions',
    );
  });
});
