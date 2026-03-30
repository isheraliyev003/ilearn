export async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string | string[];
    };
    const message = parsed.message;
    if (Array.isArray(message)) {
      return message.join(", ");
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Fall through to raw text below.
  }

  return text;
}
