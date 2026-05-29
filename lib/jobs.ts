import { PgBoss } from "pg-boss";

export const TRANSCRIBE_VOICE_QUEUE = "transcribe-voice-memory";
export const GENERATE_DAILY_JOURNAL_QUEUE = "generate-daily-journal";

const globalForJobs = globalThis as unknown as {
  boss?: PgBoss;
  bossPromise?: Promise<PgBoss>;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined.");
  }

  return databaseUrl;
}

export async function getJobBoss() {
  if (globalForJobs.boss) {
    return globalForJobs.boss;
  }

  if (!globalForJobs.bossPromise) {
    globalForJobs.bossPromise = (async () => {
      const boss = new PgBoss(getDatabaseUrl());

      boss.on("error", (error) => {
        console.error("pg-boss error:", error);
      });

      await boss.start();

      await boss.createQueue(TRANSCRIBE_VOICE_QUEUE);
      await boss.createQueue(GENERATE_DAILY_JOURNAL_QUEUE);

      globalForJobs.boss = boss;

      return boss;
    })();
  }

  return globalForJobs.bossPromise;
}

export async function queueVoiceTranscription(memoryId: string) {
  const boss = await getJobBoss();

  await boss.send(TRANSCRIBE_VOICE_QUEUE, {
    memoryId,
  });
}

export async function queueDailyJournal(journalId: string) {
  const boss = await getJobBoss();

  await boss.send(GENERATE_DAILY_JOURNAL_QUEUE, {
    journalId,
  });
}