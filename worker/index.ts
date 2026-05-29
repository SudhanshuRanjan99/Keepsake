import "dotenv/config";

import { PgBoss } from "pg-boss";
import { expireAllEndedSubscriptions } from "@/lib/subscription-expiry";
import { scheduleNightlyJournals } from "./jobs/schedule-nightly-journals";
import {
  GENERATE_DAILY_JOURNAL_QUEUE,
  TRANSCRIBE_VOICE_QUEUE,
} from "@/lib/jobs";
import { generateDailyJournal } from "./jobs/generate-daily-journal";
import { transcribeVoiceMemory } from "./jobs/transcribe-voice";

async function startWorker() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined.");
  }

  const boss = new PgBoss(databaseUrl);

  boss.on("error", (error) => {
    console.error("Worker pg-boss error:", error);
  });

  await boss.start();

  await boss.createQueue(TRANSCRIBE_VOICE_QUEUE);
  await boss.createQueue(GENERATE_DAILY_JOURNAL_QUEUE);

  await boss.work(TRANSCRIBE_VOICE_QUEUE, async ([job]) => {
    const data = job.data as {
      memoryId?: string;
    };

    if (!data.memoryId) {
      throw new Error("Transcription job is missing memoryId.");
    }

    console.log(`Transcribing memory ${data.memoryId}`);

    await transcribeVoiceMemory(data.memoryId);

    console.log(`Completed transcription for memory ${data.memoryId}`);
  });

  await boss.work(GENERATE_DAILY_JOURNAL_QUEUE, async ([job]) => {
  const data = job.data as {
    journalId?: string;
  };

  if (!data.journalId) {
    throw new Error("Journal job is missing journalId.");
  }

  console.log(`Generating journal ${data.journalId}`);

  await generateDailyJournal(data.journalId);

  console.log(`Completed journal ${data.journalId}`);
});

let nightlyScanRunning = false;

async function runNightlyJournalScan() {
  if (process.env.ENABLE_NIGHTLY_JOURNALS !== "true") {
    return;
  }

  if (nightlyScanRunning) {
    return;
  }

  nightlyScanRunning = true;

  try {
    await scheduleNightlyJournals();
  } catch (error) {
    console.error("Nightly journal scan failed:", error);
  } finally {
    nightlyScanRunning = false;
  }
}

await runNightlyJournalScan();

setInterval(() => {
  void runNightlyJournalScan();
}, 5 * 60 * 1000);

console.log(
  process.env.ENABLE_NIGHTLY_JOURNALS === "true"
    ? "Nightly journal automation is enabled."
    : "Nightly journal automation is disabled.",
);

let subscriptionExpiryRunning = false;

async function runSubscriptionExpirySweep() {
  if (subscriptionExpiryRunning) {
    return;
  }

  subscriptionExpiryRunning = true;

  try {
    const expiredCount = await expireAllEndedSubscriptions();

    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} ended subscription(s).`);
    }
  } catch (error) {
    console.error("Subscription expiry sweep failed:", error);
  } finally {
    subscriptionExpiryRunning = false;
  }
}

await runSubscriptionExpirySweep();

setInterval(() => {
  void runSubscriptionExpirySweep();
}, 15 * 60 * 1000);

console.log("Keepsake worker is running.");
}

startWorker().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});