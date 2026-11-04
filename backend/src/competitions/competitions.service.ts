import { Injectable } from '@nestjs/common';

import type { Competition } from './interfaces/competition.interface.js';

@Injectable()
export class CompetitionsService {
  private readonly competitions: Competition[] = [
    {
      id: 1,
      name: 'FER CTF 2026',
      description:
        'Godišnje studentsko natjecanje iz web sigurnosti, kriptografije i forenzike.',
      startsAt: new Date('2026-10-25T09:00:00+01:00'),
      endsAt: new Date('2026-10-28T21:00:00+01:00'),
      organisedBy: 1,
      status: 'active',
      teamCount: 42,
    },
    {
      id: 2,
      name: 'Zimski CTF',
      description:
        'Natjecanje za početnike s naglaskom na obrnuto inženjerstvo.',
      startsAt: new Date('2026-12-12T10:00:00+01:00'),
      endsAt: new Date('2026-12-13T22:00:00+01:00'),
      organisedBy: 2,
      status: 'finished',
      teamCount: 8,
    },
    {
      id: 3,
      name: 'Proljetni CTF 2026',
      description: 'Jeopardy natjecanje s HTTP i TCP servisima.',
      startsAt: new Date('2026-04-18T12:00:00+02:00'),
      endsAt: new Date('2026-04-19T20:00:00+02:00'),
      organisedBy: 1,
      status: 'upcoming',
      teamCount: 31,
    },
  ];

  findAll(): Array<Competition> {
    return this.competitions;
  }

  findById(id: number): Competition | undefined {
    return this.competitions.find((v) => v.id === id);
  }
}
