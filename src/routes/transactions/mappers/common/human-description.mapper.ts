import { Hex } from 'viem/types/misc';
import { Inject, Injectable } from '@nestjs/common';
import { formatUnits, isAddress, isHex } from 'viem';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { MAX_UINT256 } from '@/routes/transactions/constants';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IHumanDescriptionRepository } from '@/domain/human-description/human-description.repository.interface';
import { HumanDescriptionRepository } from '@/domain/human-description/human-description.repository';
import {
  HumanDescriptionFragment,
  TokenValueFragment,
  ValueType,
} from '@/domain/human-description/entities/human-description.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { isMultisigTransaction } from '@/domain/safe/entities/transaction.entity';
import {
  RichAddressFragment,
  RichDecodedInfo,
  RichDecodedInfoFragment,
  RichFragmentType,
  RichTextFragment,
  RichTokenValueFragment,
} from '@/routes/transactions/entities/human-description.entity';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import { asError } from '@/logging/utils';

@Injectable()
export class HumanDescriptionMapper {
  private static SIG_HASH_INDEX = 10;

  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IHumanDescriptionRepository)
    private readonly humanDescriptionRepository: HumanDescriptionRepository,
    private readonly safeAppInfoMapper: SafeAppInfoMapper,
  ) {}

  async mapRichDecodedInfo(
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichDecodedInfo | null> {
    if (!transaction.data || !isHex(transaction.data) || !transaction.to) {
      return null;
    }

    const sigHash = this.getSigHash(transaction.data);

    if (!sigHash) return null;

    try {
      const humanDescriptionFragments =
        this.humanDescriptionRepository.getHumanDescription({
          functionSignatureHash: sigHash,
          to: transaction.to,
          data: transaction.data,
        });

      const richDecodedInfoFragments = await this.enrichFragments(
        humanDescriptionFragments,
        transaction,
        chainId,
      );

      const richDecodedInfo = await this.enrichSafeAppInfo(
        richDecodedInfoFragments,
        transaction,
        chainId,
      );

      return new RichDecodedInfo(richDecodedInfo);
    } catch (error) {
      this.loggingService.debug(
        `Error trying to decode the input data: ${asError(error).message}`,
      );
      return null;
    }
  }

  mapHumanDescription(richDecodedInfo: RichDecodedInfo | null): string | null {
    if (!richDecodedInfo?.fragments) return null;

    return richDecodedInfo.fragments
      .map((fragment) => {
        if (fragment instanceof RichTokenValueFragment) {
          return fragment.symbol
            ? `${fragment.value} ${fragment.symbol}`
            : fragment.value;
        }

        if (fragment instanceof RichAddressFragment) {
          return this.shortenAddress(fragment.value);
        }

        return fragment.value;
      })
      .join(' ');
  }

  private async enrichFragments(
    fragments: HumanDescriptionFragment[],
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichDecodedInfoFragment[]> {
    return Promise.all(
      fragments.map(async (fragment) => {
        switch (fragment.type) {
          case ValueType.TokenValue:
            return this.enrichTokenValue(fragment, transaction, chainId);
          case ValueType.Address:
            return new RichAddressFragment(fragment.value);
          case ValueType.Text:
            return new RichTextFragment(fragment.value);
          case ValueType.Number:
            return new RichTextFragment(fragment.value.toString());
        }
      }),
    );
  }

  private async enrichTokenValue(
    fragment: TokenValueFragment,
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichTokenValueFragment> {
    const token = await this.tokenRepository
      .getToken({
        chainId,
        address: transaction.to,
      })
      .catch(() => null);

    let amount: string;
    if (fragment.value.amount === MAX_UINT256) {
      amount = 'unlimited';
    } else if (token && token.decimals) {
      amount = formatUnits(fragment.value.amount, token.decimals);
    } else {
      amount = fragment.value.amount.toString();
    }

    return new RichTokenValueFragment(
      amount,
      token?.symbol ?? null,
      token?.logoUri ?? null,
    );
  }

  async enrichSafeAppInfo(
    fragments: RichDecodedInfoFragment[],
    transaction: MultisigTransaction | ModuleTransaction,
    chainId: string,
  ): Promise<RichDecodedInfoFragment[]> {
    const safeAppInfo = isMultisigTransaction(transaction)
      ? await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction)
      : null;

    if (safeAppInfo) {
      const fragment: RichTextFragment = {
        type: RichFragmentType.Text,
        value: `via ${safeAppInfo.name}`,
      };
      fragments.push(fragment);
    }

    return fragments;
  }

  private shortenAddress(address: string, length = 4): string {
    if (!isAddress(address)) {
      throw Error('Invalid address');
    }

    const visibleCharactersLength = length * 2 + 2;

    if (address.length < visibleCharactersLength) {
      return address;
    }

    return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
  }

  private getSigHash(data: Hex): Hex | null {
    const dataStart = data.slice(0, HumanDescriptionMapper.SIG_HASH_INDEX);

    return isHex(dataStart) ? dataStart : null;
  }
}
