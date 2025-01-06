import { z } from 'zod';

export const FirebaseOauth2TokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

export type FirebaseOauth2Token = z.infer<typeof FirebaseOauth2TokenSchema>;
