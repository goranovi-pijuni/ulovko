import { Module } from "@nestjs/common";
import { RoleGuard } from "./role.guard.js";

@Module({
    providers: [RoleGuard],
    exports: [RoleGuard],
})
export class RolesModule {}