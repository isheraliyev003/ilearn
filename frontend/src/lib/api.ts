export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${getApiBase().replace(/\/$/, "")}${path}`, {
    ...init,
    credentials: "include",
  });
}
