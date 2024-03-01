import { Request } from 'express';

export function getRouteUrl(request: Request): URL {
  const protocol = request.get('X-Forwarded-Proto') ?? request.protocol;
  return new URL(`${protocol}://${request.get('Host')}${request.originalUrl}`);
}
