export interface Challenge {
  id: number;
  challengeTitle: string;
  challengeDescription: string;
  publishingDate: Date;
  flag: string;
  points: number;
  competitionId: number;
  categoryId: number;
}
