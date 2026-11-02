import { beforeAll, afterAll, describe, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { CompetitionsModule } from "../src/competitions/competitions.module.js";

describe("Competitions API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CompetitionsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/competitions returns 200", async () => {
    await request(app.getHttpServer())
      .get("/api/competitions")
      .expect(200)
      .expect("Content-Type", /json/);
  });

  it("GET /api/competitions/abc returns 400", async () => {
    await request(app.getHttpServer()).get("/api/competitions/abc").expect(400);
  });
});
