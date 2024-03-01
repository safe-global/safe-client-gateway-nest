import { faker } from '@faker-js/faker';
import { getRouteUrl } from '@/routes/common/decorators/utils';
import { Request } from 'express';

describe('utils tests', () => {
  describe('getRouteUrl tests', () => {
    const request = {
      get: jest.fn(),
      originalUrl: faker.system.filePath(),
      protocol: faker.internet.protocol(),
    } as jest.MockedObjectDeep<Request>;

    const requestMock = jest.mocked(request);

    it('Uses X-Forwarded-Proto as protocol if set', () => {
      const protocol = faker.internet.protocol();
      const host = faker.internet.domainName();
      request.get.mockImplementation((arg) => {
        if (arg == 'X-Forwarded-Proto') {
          return protocol;
        } else if (arg == 'Host') {
          return host;
        } else {
          throw Error('Unknown arg');
        }
      });

      const actual = getRouteUrl(requestMock).toString();

      expect(actual).toBe(`${protocol}://${host}${request.originalUrl}`);
    });

    it('Uses request protocol if X-Forwarded-Proto is not set', () => {
      const host = faker.internet.domainName();
      request.get.mockImplementation((arg) => {
        if (arg == 'X-Forwarded-Proto') {
          return undefined;
        } else if (arg == 'Host') {
          return host;
        } else {
          throw Error('Unknown arg');
        }
      });

      const actual = getRouteUrl(requestMock).toString();

      expect(actual).toBe(
        `${request.protocol}://${host}${request.originalUrl}`,
      );
    });
  });
});
