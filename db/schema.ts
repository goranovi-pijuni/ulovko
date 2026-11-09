import {
  pgTable,
  pgEnum,
  integer,
  text,
  timestamp,
  boolean,
  primaryKey,
  index,
  check,
  bytea,
  serial,
} from "drizzle-orm/pg-core";
import { defineRelations, sql } from "drizzle-orm";

export const statusEnum = pgEnum('status', ['uploaded', 'building', 'built', 'deployed', 'error']);

export const users = pgTable(
  "Users",
  {
    id: serial("id").primaryKey(),
    email: text("email").unique().notNull(),
    displayName: text("displayName").notNull(),
    oauthUserId: text("oauthUserId").unique().notNull(),
    avatar: bytea("avatar"),
    permLevel: integer("permLevel").notNull(),
    creationTime: timestamp("creationTime").notNull(),
    lastEditTime: timestamp("lastEditTime").notNull(),
  },
  (table) => [
    index("users_oauthUserId_idx").on(table.oauthUserId),
  ]
);

export const teams = pgTable("Teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  accessCode: text("accessCode").notNull(),
  foundingTime: timestamp("foundingTime").notNull(),
  captain: integer("captain")
    .notNull()
    .references(() => users.id),

}, (table) => [
  index("teams_captain_idx").on(table.captain)
]);

export const permissionRequests = pgTable("PermissionRequests", {
  id: serial("id").primaryKey(),
  requestTime: timestamp("requestTime").notNull(),
  verdictTime: timestamp("verdictTime"),
  result: boolean("result").notNull(),
  requestedBy: integer("requestedBy")
    .notNull()
    .references(() => users.id),
}, (table) => [
    index("permissionRequests_requestedBy_idx").on(table.requestedBy)
]);

export const competitions = pgTable(
  "Competitions",
  {
    id: serial("id").primaryKey(),
    compName: text("compName").notNull(),
    compDescription: text("compDescription"),
    compStart: timestamp("compStart").notNull(),
    compEnd: timestamp("compEnd").notNull(),
    max: integer("max"),
    min: integer("min"),
    decay: integer("decay"),
    organizedBy: integer("organizedBy")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    check(
      "validCompetitionTime",
      sql`${table.compEnd} > ${table.compStart}`
    ),
    index("competitions_organizedBy_idx").on(table.organizedBy)
  ]
);

export const categories = pgTable("Categories", {
  id: serial("id").primaryKey(),
  categoryName: text("categoryName").notNull(),
});

export const challenges = pgTable("Challenges", {
  id: serial("id").primaryKey(),
  challengeTitle: text("challengeTitle").notNull(),
  challengeDescription: text("challengeDescription"),
  publishingDate: timestamp("publishingDate").notNull(),
  isPublic: boolean("isPublic").notNull().default(false),
  hasHandout: boolean("hasHandout").notNull().default(false),
  flag: text("flag").notNull(),
  points: integer("points"),
  deployId: integer("deployId")
    .unique()
    .references(() => deployments.id),
  competitionId: integer("competitionId")
    .notNull()
    .references(() => competitions.id),
  categoryId: integer("categoryId")
    .notNull()
    .references(() => categories.id),
  },
  (table) => [
    index("challenges_competitionId_idx").on(table.competitionId),
    index("challenges_categoryId_idx").on(table.categoryId)
  ]
);

export const userTeamComp = pgTable(
  "UserTeamComp",
  {
    userId: integer("userId")
    .notNull()
    .references(() => users.id),
    teamId: integer("teamId")
    .notNull()
    .references(() => teams.id),
    compId: integer("compId")
    .notNull()
    .references(() => competitions.id),
    participationStartTime: integer("participationStartTime").notNull(),
    participationEndTime: integer("participationEndTime"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.teamId, table.compId] }),
    check(
      "validParticipationTime",
      sql`${table.participationEndTime} > ${table.participationStartTime}`
    ),
  ]
);

export const solutions = pgTable(
  "Solutions",
  {
    userId: integer("userId")
    .notNull()
    .references(() => users.id),
    compId: integer("compId")
    .notNull()
    .references(() => competitions.id),
    challengeId: integer("challengeId")
    .notNull()
    .references(() => challenges.id),
    solveTime: timestamp("solveTime").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.compId, table.challengeId] }),
  ]
);

export const deployments = pgTable(
  "Deployments",
  {
    id: serial("id").primaryKey(),
    status: statusEnum("status").notNull(),
    buildId: text("buildId"),
    latestError: text("latestError")
  }
);

export const deploymentsRelations = defineRelations(
  {challenges, deployments}, (r) => ({
    deployments: {
      challenges: r.one.challenges({
        from: r.deployments.id,
        to: r.challenges.deployId,
        optional: true
      })
    }
  })
);