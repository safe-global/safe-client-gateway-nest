import type { Request } from 'express';
import get from 'lodash/get';

const HEADER_IP_ADDRESS = 'X-Real-IP';
const HEADER_SAFE_APP_USER_AGENT = 'Safe-App-User-Agent';
const HEADER_ORIGIN = 'Origin';

export function formatRouteLogMessage(
  statusCode: number,
  request: Request,
  startTimeMs: number,
  detail?: string,
): {
  chain_id: string | null;
  client_ip: string | null;
  method: string;
  response_time_ms: number;
  route: string;
  path: string;
  safe_app_user_agent: string | null;
  status_code: number;
  detail: string | null;
  origin: string | null;
} {
  const clientIp = request.header(HEADER_IP_ADDRESS) ?? null;
  const safeAppUserAgent = request.header(HEADER_SAFE_APP_USER_AGENT) ?? null;
  const chainId = request.params['chainId'] ?? null;
  const origin = request.header(HEADER_ORIGIN) ?? null;

  return {
    chain_id: chainId,
    client_ip: clientIp,
    method: request.method,
    response_time_ms: performance.now() - startTimeMs,
    route: request.route.path,
    path: request.url,
    safe_app_user_agent: safeAppUserAgent,
    status_code: statusCode,
    detail: detail ?? null,
    origin,
  };
}

/**
 * Coerces an unknown value into an {@link Error} with defined {@link message}:
 *
 * @param thrown - The value to coerce into an {@link Error}
 *
 * - If the value is an {@link Error}, it is returned as is.
 *
 * The {@link message} of the returned {@link Error} is otherwise defined as follows:
 *
 * - If {@link thrown} is a string, it is used as the {@link message}.
 * - If {@link thrown} is an object, it tries to get a `message` property and uses it as the {@link message}.
 * - If {@link thrown} is an object without a `message` property, it tries to stringify it and use it as the {@link message}.
 * - If stringify fails, it converts {@link thrown} to string and uses it as the {@link message}.
 *
 * @returns {@link Error} containing {@link message}
 */
export const asError = (thrown: unknown): Error => {
  if (thrown instanceof Error) {
    return thrown;
  }

  let message: string;

  if (typeof thrown === 'string') {
    message = thrown;
  } else {
    try {
      message = get(thrown, 'message') ?? JSON.stringify(thrown);
    } catch {
      message = String(thrown);
    }
  }

  return new Error(message);
};
