import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export async function getAudioDurationSeconds({
  buffer,
  extension,
}: {
  buffer: Buffer;
  extension: string;
}) {
  if (!ffmpegPath) {
    throw new Error("FFmpeg executable was not found.");
  }

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "keepsake-audio-duration-"),
  );

  try {
    const audioPath = path.join(temporaryDirectory, `voice.${extension}`);

    await writeFile(audioPath, buffer);

    const { stderr } = await execFileAsync(ffmpegPath, [
      "-i",
      audioPath,
      "-f",
      "null",
      "-",
    ]);

    const match = stderr.match(/Duration:\s(\d{2}):(\d{2}):(\d{2}\.\d+)/);

    if (!match) {
      throw new Error("Could not detect audio duration.");
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    const totalSeconds = Math.ceil(hours * 3600 + minutes * 60 + seconds);

    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      throw new Error("Invalid audio duration.");
    }

    return totalSeconds;
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}