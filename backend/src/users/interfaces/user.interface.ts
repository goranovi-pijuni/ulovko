import { Role } from "../../roles/roles.enum.js";

export interface User {
    id: number,
    email: string,
    displayName: string,
    oAuthUserId: string,
    avatar: string,
    permLevel: Role,
//    creationTime: string,
//    lastEditTime: string
}