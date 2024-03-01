import { get } from 'lodash';

const HEADER_IP_ADDRESS = 'X-Real-IP';
const HEADER_SAFE_APP_USER_AGENT = 'Safe-App-User-Agent';

export function formatRouteLogMessage(
  statusCode: number,
  request: any,
  startTimeMs: number,
  detail?: string,
): {
  chain_id: any;
  client_ip: any;
  method: any;
  response_time_ms: number;
  route: any;
  path: any;
  safe_app_user_agent: any;
  status_code: number;
  detail: string | null;
} {
  const clientIp = request.header(HEADER_IP_ADDRESS) ?? null;
  const safe_app_user_agent =
    request.header(HEADER_SAFE_APP_USER_AGENT) ?? null;
  const chainId = request.params['chainId'] ?? null;

  return {
    chain_id: chainId,
    client_ip: clientIp,
    method: request.method,
    response_time_ms: performance.now() - startTimeMs,
    route: request.route.path,
    path: request.url,
    safe_app_user_agent: safe_app_user_agent,
    status_code: statusCode,
    detail: detail ?? null,
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
