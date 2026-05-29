

type TelegramFileResponse = {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
  };
  description?: string;
};

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not defined in .env.local.`);
  }

  return value;
}

export function getTelegramBotUsername() {
  const username = requireEnvironmentVariable("TELEGRAM_BOT_USERNAME").replace(
    /^@/,
    "",
  );

  if (!/^[A-Za-z0-9_]{5,}$/.test(username)) {
    throw new Error("TELEGRAM_BOT_USERNAME is invalid.");
  }

  return username;
}

export function getTelegramBotToken() {
  return requireEnvironmentVariable("TELEGRAM_BOT_TOKEN");
}

export function getTelegramWebhookSecret() {
  return requireEnvironmentVariable("TELEGRAM_WEBHOOK_SECRET");
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = getTelegramBotToken();

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram sendMessage failed: ${errorText}`);
  }
}


export async function sendTelegramWebAppButtonMessage({
  chatId,
  text,
  buttonText,
  webAppUrl,
}: {
  chatId: string;
  text: string;
  buttonText: string;
  webAppUrl: string;
}) {
  const botToken = getTelegramBotToken();

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: buttonText,
                web_app: {
                  url: webAppUrl,
                },
              },
            ],
          ],
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram web-app button failed: ${errorText}`);
  }
}

export async function downloadTelegramFile(fileId: string) {
  const botToken = getTelegramBotToken();

  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_id: fileId,
      }),
      cache: "no-store",
    },
  );

  if (!fileInfoResponse.ok) {
    throw new Error("Telegram getFile request failed.");
  }

  const fileInfo =
    (await fileInfoResponse.json()) as TelegramFileResponse;

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error(
      fileInfo.description ?? "Telegram file path was not returned.",
    );
  }

  const downloadResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`,
    {
      cache: "no-store",
    },
  );

  if (!downloadResponse.ok) {
    throw new Error("Telegram file download failed.");
  }

  const body = Buffer.from(await downloadResponse.arrayBuffer());

  return {
    body,
    filePath: fileInfo.result.file_path,
    fileSize: fileInfo.result.file_size ?? body.length,
  };
}