import { Inject } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';

export class UrlGeneratorHelper {
  private readonly webAppBaseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.webAppBaseUri =
      this.configurationService.getOrThrow<string>('safeWebApp.baseUri');
  }

  addressToSafeWebAppUrl(args: { chain: Chain; safeAddress: string }): string {
    return `${this.webAppBaseUri}/home?safe=${args.chain.shortName}:${args.safeAddress}`;
  }

  addressToExplorerUrl(args: { chain: Chain; address: string }): string {
    return args.chain.blockExplorerUriTemplate.address.replace(
      '{{address}}',
      args.address,
    );
  }
}
