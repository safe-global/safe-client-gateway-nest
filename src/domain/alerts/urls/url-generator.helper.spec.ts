import { IConfigurationService } from '@/config/configuration.service.interface';
import { UrlGeneratorHelper } from '@/domain/alerts/urls/url-generator.helper';
import { blockExplorerUriTemplateBuilder } from '@/domain/chains/entities/__tests__/block-explorer-uri-template.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { faker } from '@faker-js/faker';

const configurationService = {
  getOrThrow: jest.fn(),
} as unknown as IConfigurationService;

const configurationServiceMock = jest.mocked(configurationService);

describe('UrlGeneratorHelper', () => {
  const webAppBaseUri = faker.internet.url({ appendSlash: false });

  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'safeWebApp.baseUri') {
      return webAppBaseUri;
    }
    throw new Error(`Unexpected key: ${key}`);
  });

  const target = new UrlGeneratorHelper(configurationServiceMock);

  describe('addressToSafeWebAppUrl', () => {
    it('should return a Safe web app url', () => {
      const chain = chainBuilder().build();

      const safeAddress = faker.finance.ethereumAddress();
      const expected = `${webAppBaseUri}/home?safe=${chain.shortName}:${safeAddress}`;

      expect(target.addressToSafeWebAppUrl({ chain, safeAddress })).toEqual(
        expected,
      );
    });
  });

  describe('addressToExplorerUrl', () => {
    it('should return a Safe web app url', () => {
      const explorerUrl = faker.internet.url({ appendSlash: false });
      const chain = chainBuilder()
        .with(
          'blockExplorerUriTemplate',
          blockExplorerUriTemplateBuilder()
            .with('address', `${explorerUrl}/{{address}}`)
            .build(),
        )
        .build();

      const address = faker.finance.ethereumAddress();
      const expected = `${explorerUrl}/${address}`;

      expect(target.addressToExplorerUrl({ chain, address })).toEqual(expected);
    });
  });
});
