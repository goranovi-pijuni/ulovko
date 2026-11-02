export interface Competition {
  id: number;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  organisedBy: number;
  teamCount: number;
}
