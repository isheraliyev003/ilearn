export type HealthResponse = {
  status: 'ok';
  database: 'connected';
};

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return v.status === 'ok' && v.database === 'connected';
}
