import { Test, TestingModule } from '@nestjs/testing';
import { FlagSubmissionService } from './flag_submission.service.js';

describe('FlagSubmissionService', () => {
  let service: FlagSubmissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlagSubmissionService],
    }).compile();

    service = module.get<FlagSubmissionService>(FlagSubmissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
