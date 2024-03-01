import { faker } from '@faker-js/faker';
import { fakeJson } from '@/__tests__/faker';
import { validate } from '@/config/configuration.validator';
import { omit } from 'lodash';

describe('Configuration validator', () => {
  const validConfiguration = {
    ...JSON.parse(fakeJson()),
    AUTH_TOKEN: faker.string.uuid(),
    ALERTS_PROVIDER_SIGNING_KEY: faker.string.uuid(),
    ALERTS_PROVIDER_API_KEY: faker.string.uuid(),
    ALERTS_PROVIDER_ACCOUNT: faker.string.alphanumeric(),
    ALERTS_PROVIDER_PROJECT: faker.string.alphanumeric(),
    EMAIL_API_APPLICATION_CODE: faker.string.alphanumeric(),
    EMAIL_API_FROM_EMAIL: faker.internet.email(),
    EMAIL_API_KEY: faker.string.uuid(),
    EMAIL_TEMPLATE_RECOVERY_TX: faker.string.alphanumeric(),
    EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: faker.string.alphanumeric(),
    EMAIL_TEMPLATE_VERIFICATION_CODE: faker.string.alphanumeric(),
  };

  it('should bypass this validation on test environment', () => {
    process.env.NODE_ENV = 'test';
    const expected = JSON.parse(fakeJson());
    const validated = validate(expected);
    expect(validated).toBe(expected);
  });

  it('should return the input configuration if validated in production environment', () => {
    process.env.NODE_ENV = 'production';
    const validated = validate(validConfiguration);
    expect(validated).toBe(validConfiguration);
  });

  it.each([
    { key: 'AUTH_TOKEN' },
    { key: 'ALERTS_PROVIDER_SIGNING_KEY' },
    { key: 'ALERTS_PROVIDER_API_KEY' },
    { key: 'ALERTS_PROVIDER_ACCOUNT' },
    { key: 'ALERTS_PROVIDER_PROJECT' },
    { key: 'EMAIL_API_APPLICATION_CODE' },
    { key: 'EMAIL_API_FROM_EMAIL' },
    { key: 'EMAIL_API_KEY' },
    { key: 'EMAIL_TEMPLATE_RECOVERY_TX' },
    { key: 'EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX' },
    { key: 'EMAIL_TEMPLATE_VERIFICATION_CODE' },
  ])(
    'should detect that $key is missing in the configuration in production environment',
    ({ key }) => {
      process.env.NODE_ENV = 'production';
      expect(() => validate(omit(validConfiguration, key))).toThrow(
        `must have required property '${key}'`,
      );
    },
  );

  it('should an invalid LOG_LEVEL configuration in production environment', () => {
    expect(() =>
      validate({
        ...JSON.parse(fakeJson()),
        AUTH_TOKEN: faker.string.uuid(),
        LOG_LEVEL: faker.word.words(),
        ALERTS_PROVIDER_SIGNING_KEY: faker.string.uuid(),
        ALERTS_PROVIDER_API_KEY: faker.string.uuid(),
        ALERTS_PROVIDER_ACCOUNT: faker.string.alphanumeric(),
        ALERTS_PROVIDER_PROJECT: faker.string.alphanumeric(),
        EMAIL_API_APPLICATION_CODE: faker.string.alphanumeric(),
        EMAIL_API_FROM_EMAIL: faker.internet.email(),
        EMAIL_API_KEY: faker.string.uuid(),
        EMAIL_TEMPLATE_RECOVERY_TX: faker.string.alphanumeric(),
        EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: faker.string.alphanumeric(),
        EMAIL_TEMPLATE_VERIFICATION_CODE: faker.string.alphanumeric(),
      }),
    ).toThrow(/LOG_LEVEL must be equal to one of the allowed values/);
  });
});
