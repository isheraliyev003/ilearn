const backendUrl = process.env.API_URL ?? "http://127.0.0.1:3001";
const healthUrl = new URL("/health", backendUrl).toString();
const retryDelayMs = 500;
const timeoutMs = 60_000;

const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(healthUrl, { cache: "no-store" });
    if (response.ok) {
      process.stdout.write(`Backend is ready at ${healthUrl}\n`);
      process.exit(0);
    }
  } catch {
    // Keep waiting until the backend is reachable.
  }

  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
}

process.stderr.write(`Timed out waiting for backend at ${healthUrl}\n`);
process.exit(1);
