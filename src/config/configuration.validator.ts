import Ajv, { Schema } from 'ajv';
import addFormats from 'ajv-formats';

const configurationSchema: Schema = {
  type: 'object',
  properties: {
    AUTH_TOKEN: { type: 'string' },
    LOG_LEVEL: {
      type: 'string',
      enum: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    },
    ALERTS_PROVIDER_SIGNING_KEY: { type: 'string' },
    ALERTS_PROVIDER_API_KEY: { type: 'string' },
    ALERTS_PROVIDER_ACCOUNT: { type: 'string' },
    ALERTS_PROVIDER_PROJECT: { type: 'string' },
    EMAIL_API_APPLICATION_CODE: { type: 'string' },
    EMAIL_API_FROM_EMAIL: { type: 'string', format: 'email' },
    EMAIL_API_KEY: { type: 'string' },
    EMAIL_TEMPLATE_RECOVERY_TX: { type: 'string' },
    EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: { type: 'string' },
    EMAIL_TEMPLATE_VERIFICATION_CODE: { type: 'string' },
  },
  required: [
    'AUTH_TOKEN',
    'ALERTS_PROVIDER_SIGNING_KEY',
    'ALERTS_PROVIDER_API_KEY',
    'ALERTS_PROVIDER_ACCOUNT',
    'ALERTS_PROVIDER_PROJECT',
    'EMAIL_API_APPLICATION_CODE',
    'EMAIL_API_FROM_EMAIL',
    'EMAIL_API_KEY',
    'EMAIL_TEMPLATE_RECOVERY_TX',
    'EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX',
    'EMAIL_TEMPLATE_VERIFICATION_CODE',
  ],
};

export function validate(
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  if (process.env.NODE_ENV !== 'test') {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv, { formats: ['email'] });

    if (!ajv.validate(configurationSchema, configuration)) {
      const errors = ajv.errors
        ?.map((error) => `${error.instancePath} ${error.message}`)
        ?.join(', ');
      throw Error(`Configuration is invalid: ${errors}`);
    }
  }
  return configuration;
}
