export interface User {
  id: number;
  email: string;
  displayName: string;
  oauthUserId: string;
  avatar: Buffer | null;
  permLevel: number;
  creationTime: Date;
  lastEditTime: Date;
}
