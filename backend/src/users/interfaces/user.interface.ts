import { Role } from "../../roles/roles.enum.js";

export interface User {
    id: number,
    email: string,
    displayName: string,
    oauthUserId: string,
    avatar: string | null,
    permLevel: Role,
    creationTime: Date,
    lastEditTime: Date  
}