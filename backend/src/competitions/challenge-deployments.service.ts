import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, eq, lte } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { challenges, competitions, deployments } from "../database/schema.js";
import type { ChallengeEndpointDto } from "./dto/challenge-endpoint.dto.js";

interface BuildJob {
  build_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string | null;
}

export interface DeploymentState {
  status: "uploaded" | "building" | "built" | "deployed" | "error" | null;
  error: string | null;
  endpoints: ChallengeEndpointDto[];
}

interface RunnerChallenge {
  services?: {
    name?: string;
    ready?: boolean;
    endpoints?: { protocol?: string; url?: string; host?: string; port?: number }[];
  }[];
}

// Do not expose images, internal K8s service names, or runner credentials.
function publicEndpoints(challenge: RunnerChallenge | null): ChallengeEndpointDto[] {
  if (!Array.isArray(challenge?.services)) return [];
  return challenge.services.flatMap((service) => {
    if (typeof service.name !== "string" || !Array.isArray(service.endpoints)) return [];
    return service.endpoints.flatMap((endpoint): ChallengeEndpointDto[] => {
      if (
        (endpoint.protocol === "http" || endpoint.protocol === "https") &&
        typeof endpoint.url === "string"
      ) {
        try {
          const url = new URL(endpoint.url);
          if (
            url.protocol === `${endpoint.protocol}:` &&
            url.hostname &&
            !url.username &&
            !url.password
          ) {
            return [
              {
                service: service.name!,
                ready: service.ready === true,
                protocol: endpoint.protocol,
                url: url.href,
              },
            ];
          }
        } catch {
          /* Invalid runner address; do not render it as a link. */
        }
      }
      if (
        endpoint.protocol === "tcp" &&
        typeof endpoint.host === "string" &&
        /^[a-zA-Z0-9.-]+$/.test(endpoint.host) &&
        Number.isInteger(endpoint.port) &&
        endpoint.port! >= 1 &&
        endpoint.port! <= 65535
      ) {
        return [
          {
            service: service.name!,
            ready: service.ready === true,
            protocol: "tcp",
            host: endpoint.host,
            port: endpoint.port,
          },
        ];
      }
      return [];
    });
  });
}

@Injectable()
export class RunnerClient {
  private async request(path: string, method = "GET", body?: object): Promise<Response> {
    const url = process.env.RUNNER_API_URL?.replace(/\/$/, "");
    const token = process.env.RUNNER_API_TOKEN;
    if (!url || !token) throw new ServiceUnavailableException("Runner nije konfiguriran");
    let response: Response;
    try {
      response = await fetch(`${url}${path}`, {
        method,
        redirect: "error",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(
          method === "POST" && path.endsWith("/deploy") ? 360_000 : 15_000,
        ),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Runner nije dostupan; provjerite RUNNER_API_URL (bez preusmjeravanja)",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new ServiceUnavailableException(
        "Runner je odbio API token; provjerite RUNNER_API_TOKEN na oba VPS-a",
      );
    }
    return response;
  }

  private async check(response: Response): Promise<void> {
    if (response.ok) return;
    const details = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const message =
      typeof details?.detail === "string" ? details.detail : `HTTP ${response.status}`;
    throw new BadGatewayException(`Runner: ${message.slice(0, 300)}`);
  }

  private async call<T>(path: string, method = "GET", body?: object): Promise<T> {
    const response = await this.request(path, method, body);
    await this.check(response);
    return (await response.json()) as T;
  }

  queue(competitionId: number, challengeId: number): Promise<BuildJob> {
    return this.call("/builds", "POST", {
      competition_id: String(competitionId),
      task_id: String(challengeId),
    });
  }

  build(buildId: string): Promise<BuildJob> {
    return this.call(`/builds/${buildId}`);
  }

  deploy(competitionId: number, challengeId: number, buildId: string): Promise<unknown> {
    return this.call(`/challenges/${competitionId}/${challengeId}/deploy`, "POST", {
      build_id: buildId,
    });
  }

  async challenge(competitionId: number, challengeId: number): Promise<RunnerChallenge | null> {
    const response = await this.request(`/challenges/${competitionId}/${challengeId}`);
    if (response.status === 404) return null;
    await this.check(response);
    return (await response.json()) as RunnerChallenge;
  }
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ChallengeDeploymentsService {
  private readonly logger = new Logger(ChallengeDeploymentsService.name);
  private readonly running = new Set<number>();
  private readonly starting = new Set<string>();

  constructor(
    private readonly database: DatabaseService,
    private readonly runner: RunnerClient,
  ) {}

  private async find(competitionId: number, challengeId: number) {
    const [challenge] = await this.database.db
      .select({
        id: challenges.id,
        hasDeploy: challenges.hasDeploy,
        deploymentId: challenges.deployId,
      })
      .from(challenges)
      .where(and(eq(challenges.id, challengeId), eq(challenges.competitionId, competitionId)))
      .limit(1);
    if (!challenge) throw new NotFoundException("Zadatak nije pronađen");
    return challenge;
  }

  private async record(id: number) {
    const [record] = await this.database.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);
    return record;
  }

  async status(competitionId: number, challengeId: number): Promise<DeploymentState> {
    const challenge = await this.find(competitionId, challengeId);
    if (!challenge.deploymentId) return { status: null, error: null, endpoints: [] };
    const deployment = await this.record(challenge.deploymentId);
    if (!deployment) return { status: null, error: null, endpoints: [] };
    const running =
      deployment.status === "deployed"
        ? await this.runner.challenge(competitionId, challengeId)
        : null;
    if (deployment.status === "deployed" && !running) {
      await this.database.db
        .update(deployments)
        .set({ status: "uploaded", latestError: null })
        .where(eq(deployments.id, deployment.id));
      return { status: "uploaded", error: null, endpoints: [] };
    }
    if ((deployment.status === "building" || deployment.status === "built") && deployment.buildId) {
      this.watch(competitionId, challengeId, deployment.id, deployment.buildId);
    }
    return {
      status: deployment.status,
      error: deployment.latestError,
      endpoints: publicEndpoints(running),
    };
  }

  // Public metadata endpoint: only published challenges may reveal service addresses.
  async publishedEndpoints(
    competitionId: number,
    challengeId: number,
  ): Promise<ChallengeEndpointDto[]> {
    const now = new Date();
    const [challenge] = await this.database.db
      .select({ hasDeploy: challenges.hasDeploy })
      .from(challenges)
      .innerJoin(competitions, eq(challenges.competitionId, competitions.id))
      .where(
        and(
          eq(challenges.id, challengeId),
          eq(challenges.competitionId, competitionId),
          eq(challenges.isPublic, true),
          lte(challenges.publishingDate, now),
          lte(competitions.compStart, now),
        ),
      )
      .limit(1);
    if (!challenge) throw new NotFoundException("Zadatak nije pronađen ili nije objavljen");
    if (!challenge.hasDeploy) return [];
    return publicEndpoints(await this.runner.challenge(competitionId, challengeId));
  }

  async start(competitionId: number, challengeId: number): Promise<DeploymentState> {
    const key = `${competitionId}/${challengeId}`;
    if (this.starting.has(key)) throw new ConflictException("Pokretanje je već u tijeku");
    this.starting.add(key);
    try {
      const challenge = await this.find(competitionId, challengeId);
      // Also refresh a previously deployed record after manual teardown.
      if (challenge.deploymentId) await this.status(competitionId, challengeId);
      if (!challenge.hasDeploy) throw new ConflictException("Zadatak nema deploy datoteke");
      if (challenge.deploymentId) {
        const existing = await this.record(challenge.deploymentId);
        if (existing && existing.status !== "error" && existing.status !== "uploaded") {
          throw new ConflictException(
            existing.status === "deployed"
              ? "Zadatak je već pokrenut. Prije ponovne objave ručno uklonite postojeći deployment."
              : "Izgradnja ili objava zadatka već traje",
          );
        }
      }
      const build = await this.runner.queue(competitionId, challengeId);
      const [created] = await this.database.db
        .insert(deployments)
        .values({
          status: "building",
          buildId: build.build_id,
          latestError: null,
        })
        .returning({ id: deployments.id });
      await this.database.db
        .update(challenges)
        .set({ deployId: created.id })
        .where(and(eq(challenges.id, challengeId), eq(challenges.competitionId, competitionId)));
      this.watch(competitionId, challengeId, created.id, build.build_id);
      return { status: "building", error: null, endpoints: [] };
    } finally {
      this.starting.delete(key);
    }
  }

  private watch(competitionId: number, challengeId: number, id: number, buildId: string): void {
    if (this.running.has(id)) return;
    this.running.add(id);
    void this.finish(competitionId, challengeId, id, buildId)
      .catch((error: unknown) => this.logger.error("Deployment state update failed", error))
      .finally(() => {
        this.running.delete(id);
      });
  }

  private async finish(competitionId: number, challengeId: number, id: number, buildId: string) {
    try {
      let job: BuildJob | undefined;
      for (let i = 0; i < 300; i++) {
        // at most ten minutes, no scheduler needed
        job = await this.runner.build(buildId);
        if (job.status === "succeeded" || job.status === "failed") break;
        await pause(2000);
      }
      if (!job || job.status !== "succeeded") {
        throw new Error(job?.error || "Izgradnja nije uspjela ili je isteklo vrijeme čekanja");
      }
      await this.database.db
        .update(deployments)
        .set({ status: "built" })
        .where(eq(deployments.id, id));
      await this.runner.deploy(competitionId, challengeId, buildId);
      await this.database.db
        .update(deployments)
        .set({ status: "deployed", latestError: null })
        .where(eq(deployments.id, id));
    } catch (error) {
      await this.database.db
        .update(deployments)
        .set({
          status: "error",
          latestError: (error instanceof Error ? error.message : "Neuspješno pokretanje").slice(
            0,
            1000,
          ),
        })
        .where(eq(deployments.id, id));
    }
  }
}
