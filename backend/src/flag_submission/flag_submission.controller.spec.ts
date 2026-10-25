import { Test, TestingModule } from '@nestjs/testing';
import { FlagSubmissionController } from './flag_submission.controller.js';

describe('FlagSubmissionController', () => {
  let controller: FlagSubmissionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlagSubmissionController],
    }).compile();

    controller = module.get<FlagSubmissionController>(FlagSubmissionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
