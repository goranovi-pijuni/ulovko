import { config } from "dotenv"; 
config();
import { drizzle } from "drizzle-orm/node-postgres";

import { 
    users, 
    teams, 
    permissionRequests, 
    competitions, 
    categories, 
    challenges,
    userTeamComp,
    solutions
} from './schema';

export const db = drizzle({connection: process.env.DATABASE_URL!});

async function main(){
    
    // users
    const insertedUsers = await db
      .insert(users)
      .values([
        {
          email: "alice@example.com",
          displayName: "Alice",
          oauthUserId: "gh-1001",
          avatar: null,
          permLevel: 3,
          creationTime: new Date("2024-01-01T10:00:00Z"),
          lastEditTime: new Date("2024-01-01T10:00:00Z"),
        },
        {
          email: "bob@example.com",
          displayName: "Bob",
          oauthUserId: "gh-1002",
          avatar: null,
          permLevel: 2,
          creationTime: new Date("2024-01-02T10:00:00Z"),
          lastEditTime: new Date("2024-01-02T10:00:00Z"),
        },
        {
          email: "carol@example.com",
          displayName: "Carol",
          oauthUserId: "gh-1003",
          avatar: null,
          permLevel: 1,
          creationTime: new Date("2024-01-03T10:00:00Z"),
          lastEditTime: new Date("2024-01-03T10:00:00Z"),
        },
        {
          email: "dave@example.com",
          displayName: "Dave",
          oauthUserId: "gh-1004",
          avatar: null,
          permLevel: 1,
          creationTime: new Date("2024-01-04T10:00:00Z"),
          lastEditTime: new Date("2024-01-04T10:00:00Z"),
        },
      ]).returning();
    
    const [alice, bob, carol, dave] = insertedUsers;
    
    // teams
    const insertedTeams = await db
      .insert(teams)
      .values([
        {
          name: "Brownbird Tim",
          accessCode: "BBT123",
          foundingTime: new Date("2024-01-10T09:00:00Z"),
          captain: carol.id,
        },
        {
          name: "Goranovi pijuni",
          accessCode: "GP0123",
          foundingTime: new Date("2024-01-11T09:00:00Z"),
          captain: dave.id,
        },
      ])
      .returning();
    
    const [hackers, byteBenders] = insertedTeams;
    
    // permission requests
    await db.insert(permissionRequests).values([
      {
        requestTime: new Date("2024-01-05T12:00:00Z"),
        verdictTime: new Date("2024-01-05T15:00:00Z"),
        result: true,
        requestedBy: bob.id,
      },
      {
        requestTime: new Date("2024-01-06T12:00:00Z"),
        verdictTime: null, // still pending
        result: false,
        requestedBy: carol.id,
      },
    ]);
    
    // categories
    const insertedCategories = await db
      .insert(categories)
      .values([
        { categoryName: "Web" },
        { categoryName: "Crypto" },
        { categoryName: "Pwn" },
        { categoryName: "Forensics" },
      ])
      .returning();
    
    const [web, crypto, pwn, forensics] = insertedCategories;
    
    // competitions
    const insertedComps = await db
      .insert(competitions)
      .values([
        {
          compName: "Spring CTF 2024",
          compDescription: "Beginner-friendly capture the flag.",
          compStart: new Date("2024-03-01T08:00:00Z"),
          compEnd: new Date("2024-03-03T20:00:00Z"),
          max: 200,
          min: 10,
          decay: 50,
          organizedBy: alice.id,
        },
        {
          compName: "Summer Hackfest",
          compDescription: "Advanced multi-category competition.",
          compStart: new Date("2024-07-15T08:00:00Z"),
          compEnd: new Date("2024-07-17T20:00:00Z"),
          max: 500,
          min: 25,
          decay: 100,
          organizedBy: bob.id,
        },
      ])
      .returning();
    
    const [springCtf, summerHack] = insertedComps;
    
    // challenges
    const insertedChallenges = await db
      .insert(challenges)
      .values([
        {
          challengeTitle: "Cookie Monster",
          challengeDescription: "A web app leaks its session signing key.",
          publishingDate: new Date("2024-03-01T08:00:00Z"),
          flag: "flag{c00k13s_4r3_t4sty}",
          points: 150,
          competitionId: springCtf.id,
          categoryId: web.id,
        },
        {
          challengeTitle: "Weak RSA",
          challengeDescription: "Recover the plaintext from a small modulus.",
          publishingDate: new Date("2024-03-01T08:00:00Z"),
          flag: "flag{sm4ll_m0dulus_1s_b4d}",
          points: 200,
          competitionId: springCtf.id,
          categoryId: crypto.id,
        },
        {
          challengeTitle: "Buffer Overflow 101",
          challengeDescription: "Classic stack smash. Get a shell.",
          publishingDate: new Date("2024-03-01T08:00:00Z"),
          flag: "flag{r3t2w1n_4r3_w3}",
          points: 300,
          competitionId: springCtf.id,
          categoryId: pwn.id,
        },
        {
          challengeTitle: "Hidden in Plain Sight",
          challengeDescription: "Steganography in a JPEG.",
          publishingDate: new Date("2024-07-15T08:00:00Z"),
          flag: "flag{st3g0_m4st3r}",
          points: 100,
          competitionId: summerHack.id,
          categoryId: forensics.id,
        },
        {
          challengeTitle: "SQL Injection Basics",
          challengeDescription: "Bypass the login form.",
          publishingDate: new Date("2024-07-15T08:00:00Z"),
          flag: "flag{sql1_1nj3ct10n}",
          points: 120,
          competitionId: summerHack.id,
          categoryId: web.id,
        },
      ])
      .returning();
    
    const [cookieMonster, weakRsa, bufferOverflow, hiddenInSight, sqlInjection] = insertedChallenges;
    
    // user, team, comp
    await db.insert(userTeamComp).values([
      {
        userId: carol.id,
        teamId: hackers.id,
        compId: springCtf.id,
        participationStartTime: Math.floor(
          new Date("2024-03-01T08:00:00Z").getTime() / 1000
        ),
        participationEndTime: Math.floor(
          new Date("2024-03-03T20:00:00Z").getTime() / 1000
        ),
      },
      {
        userId: dave.id,
        teamId: hackers.id,
        compId: springCtf.id,
        participationStartTime: Math.floor(
          new Date("2024-03-01T08:00:00Z").getTime() / 1000
        ),
        participationEndTime: Math.floor(
          new Date("2024-03-03T20:00:00Z").getTime() / 1000
        ),
      },
      {
        userId: carol.id,
        teamId: hackers.id,
        compId: summerHack.id,
        participationStartTime: Math.floor(
          new Date("2024-07-15T08:00:00Z").getTime() / 1000
        ),
        participationEndTime: null, // still ongoing
      },
      {
        userId: dave.id,
        teamId: byteBenders.id,
        compId: summerHack.id,
        participationStartTime: Math.floor(
          new Date("2024-07-15T08:00:00Z").getTime() / 1000
        ),
        participationEndTime: null,
      },
    ]);
    
    // solutions
    await db.insert(solutions).values([
      {
        userId: carol.id,
        compId: springCtf.id,
        challengeId: cookieMonster.id,
        solveTime: new Date("2024-03-01T09:12:00Z"),
      },
      {
        userId: dave.id,
        compId: springCtf.id,
        challengeId: cookieMonster.id,
        solveTime: new Date("2024-03-01T10:05:00Z"),
      },
      {
        userId: dave.id,
        compId: springCtf.id,
        challengeId: weakRsa.id,
        solveTime: new Date("2024-03-01T14:33:00Z"),
      },
      {
        userId: carol.id,
        compId: springCtf.id,
        challengeId: bufferOverflow.id,
        solveTime: new Date("2024-03-02T17:48:00Z"),
      },
      {
        userId: carol.id,
        compId: summerHack.id,
        challengeId: hiddenInSight.id,
        solveTime: new Date("2024-07-15T09:20:00Z"),
      },
      {
        userId: dave.id,
        compId: summerHack.id,
        challengeId: sqlInjection.id,
        solveTime: new Date("2024-07-15T11:02:00Z"),
      },
    ]);

}

main();