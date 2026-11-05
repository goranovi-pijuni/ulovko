import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';
import type { Competition } from './interfaces/competition.interface.js';

const example: Competition = {
  id: 1,
  name: 'FER CTF 2026',
  description: 'Test competition',
  startsAt: new Date('2026-10-25T08:00:00Z'),
  endsAt: new Date('2026-10-28T20:00:00Z'),
  status: 'finished',
  organisedBy: 1,
  teamCount: 42,
};

describe('CompetitionsController', () => {
  let controller: CompetitionsController;

  const mockService = {
    findAll: vi.fn(),
    findById: vi.fn(),
    uploadChallenge: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module = await Test.createTestingModule({
      controllers: [CompetitionsController],
      providers: [
        {
          provide: CompetitionsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get(CompetitionsController);
  });

  it('should return all competitions', async () => {
    mockService.findAll.mockResolvedValue([example]);

    await expect(controller.getCompetitions()).resolves.toEqual([example]);
    expect(mockService.findAll).toHaveBeenCalledOnce();
  });

  it('should return a competition by ID', async () => {
    mockService.findById.mockResolvedValue(example);

    await expect(controller.getById(1)).resolves.toEqual(example);
    expect(mockService.findById).toHaveBeenCalledWith(1);
  });

  it('should throw NotFoundException for missing IDs', async () => {
    mockService.findById.mockResolvedValue(undefined);

    await expect(controller.getById(999)).rejects.toThrow(NotFoundException);
  });
});
