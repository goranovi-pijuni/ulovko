import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { HealthModule } from "./health/health.module.js";
import { FlagSubmissionModule } from "./flag_submission/flag_submission.module.js";
import { CompetitionsModule } from "./competitions/competitions.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module.js";

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    DatabaseModule,
    HealthModule,
    FlagSubmissionModule,
    CompetitionsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
