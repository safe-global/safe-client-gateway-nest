import { balancesProviderBuilder } from '@/domain/chains/entities/__tests__/balances-provider.builder';
import { beaconChainExplorerUriTemplateBuilder } from '@/domain/chains/entities/__tests__/beacon-chain-explorer-uri-template.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractAddressesBuilder } from '@/domain/chains/entities/__tests__/contract-addresses.builder';
import { gasPriceFixedEIP1559Builder } from '@/domain/chains/entities/__tests__/gas-price-fixed-eip-1559.builder';
import { gasPriceFixedBuilder } from '@/domain/chains/entities/__tests__/gas-price-fixed.builder';
import { gasPriceOracleBuilder } from '@/domain/chains/entities/__tests__/gas-price-oracle.builder';
import { nativeCurrencyBuilder } from '@/domain/chains/entities/__tests__/native.currency.builder';
import { pricesProviderBuilder } from '@/domain/chains/entities/__tests__/prices-provider.builder';
import { rpcUriBuilder } from '@/domain/chains/entities/__tests__/rpc-uri.builder';
import { themeBuilder } from '@/domain/chains/entities/__tests__/theme.builder';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import {
  ChainSchema,
  BalancesProviderSchema,
  GasPriceFixedEip1559Schema,
  GasPriceFixedSchema,
  GasPriceOracleSchema,
  GasPriceSchema,
  NativeCurrencySchema,
  PricesProviderSchema,
  RpcUriSchema,
  ThemeSchema,
  ContractAddressesSchema,
  ChainLenientPageSchema,
  BeaconChainExplorerUriTemplateSchema,
} from '@/domain/chains/entities/schemas/chain.schema';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('Chain schemas', () => {
  describe('NativeCurrencySchema', () => {
    it('should validate a valid native currency', () => {
      const nativeCurrency = nativeCurrencyBuilder().build();

      const result = NativeCurrencySchema.safeParse(nativeCurrency);

      expect(result.success).toBe(true);
    });

    it('should not validate a native currency with an invalid logoUri', () => {
      const nativeCurrency = { invalid: 'nativeCurrency' };

      const result = NativeCurrencySchema.safeParse(nativeCurrency);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['name'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['symbol'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'undefined',
            path: ['decimals'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['logoUri'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('RpcUriSchema', () => {
    it('should validate a valid RPC URI', () => {
      const rpcUri = rpcUriBuilder().build();

      const result = RpcUriSchema.safeParse(rpcUri);

      expect(result.success).toBe(true);
    });

    it('should default the authentication to UNKNOWN', () => {
      const rpcUri = {
        value: faker.internet.url(),
      };

      const result = RpcUriSchema.safeParse(rpcUri);

      expect(result.success && result.data.authentication).toBe('UNKNOWN');
    });

    it('does not allow invalid RPC URIs', () => {
      const rpcUri = { invalid: 'rpcUri' };

      const result = RpcUriSchema.safeParse(rpcUri);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['value'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('BeaconChainExplorerUriTemplate', () => {
    it('should validate a BeaconChainExplorerUriTemplate', () => {
      const beaconChainExplorerUriTemplate =
        beaconChainExplorerUriTemplateBuilder().build();

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success).toBe(true);
    });

    it('should allow a string publicKey', () => {
      const beaconChainExplorerUriTemplate =
        beaconChainExplorerUriTemplateBuilder()
          .with(
            'publicKey',
            `${faker.internet.url({ appendSlash: false })}/{{publicKey}}`,
          )
          .build();

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success).toBe(true);
    });

    it('should allow a null publicKey', () => {
      const beaconChainExplorerUriTemplate =
        beaconChainExplorerUriTemplateBuilder().with('publicKey', null).build();

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success).toBe(true);
    });

    it('should default publicKey to null', () => {
      const beaconChainExplorerUriTemplate = {
        publicKey: null,
      };

      const result = BeaconChainExplorerUriTemplateSchema.safeParse(
        beaconChainExplorerUriTemplate,
      );

      expect(result.success && result.data.publicKey).toBe(null);
    });
  });

  describe('ThemeSchema', () => {
    it('should validate a valid theme', () => {
      const theme = themeBuilder().build();

      const result = ThemeSchema.safeParse(theme);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid theme', () => {
      const theme = { invalid: 'theme' };

      const result = ThemeSchema.safeParse(theme);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['textColor'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['backgroundColor'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceOracleSchema', () => {
    it('should validate a valid gas price oracle', () => {
      const gasPriceOracle = gasPriceOracleBuilder().build();

      const result = GasPriceOracleSchema.safeParse(gasPriceOracle);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price oracle', () => {
      const gasPriceOracle = { invalid: 'gasPriceOracle' };

      const result = GasPriceOracleSchema.safeParse(gasPriceOracle);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          // @ts-expect-error - inferred types don't allow literal strings
          {
            code: 'invalid_literal',
            expected: 'oracle',
            path: ['type'],
            message: 'Invalid literal value, expected "oracle"',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['uri'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gasParameter'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['gweiFactor'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceFixedSchema', () => {
    it('should validate a valid gas price fixed', () => {
      const gasPriceFixed = gasPriceFixedBuilder().build();

      const result = GasPriceFixedSchema.safeParse(gasPriceFixed);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price fixed', () => {
      const gasPriceFixed = { invalid: 'gasPriceFixed' };

      const result = GasPriceFixedSchema.safeParse(gasPriceFixed);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          // @ts-expect-error - inferred types don't allow literal strings
          {
            code: 'invalid_literal',
            expected: 'fixed',
            path: ['type'],
            message: 'Invalid literal value, expected "fixed"',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['weiValue'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceFixedEip1559Schema', () => {
    it('should validate a valid gas price fixed 1559', () => {
      const gasPriceFixedEip1559 = gasPriceFixedEIP1559Builder().build();

      const result = GasPriceFixedEip1559Schema.safeParse(gasPriceFixedEip1559);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price fixed 1559', () => {
      const gasPriceFixedEip1559 = { invalid: 'gasPriceFixedEip1559' };

      const result = GasPriceFixedEip1559Schema.safeParse(gasPriceFixedEip1559);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          // @ts-expect-error - inferred types don't allow literal strings
          {
            code: 'invalid_literal',
            expected: 'fixed1559',
            path: ['type'],
            message: 'Invalid literal value, expected "fixed1559"',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['maxFeePerGas'],
            message: 'Required',
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['maxPriorityFeePerGas'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('GasPriceSchema', () => {
    it.each([
      ['oracle', gasPriceOracleBuilder],
      ['fixed', gasPriceFixedBuilder],
      ['fixed1559', gasPriceFixedEIP1559Builder],
    ])('should validate a valid %s gas price', (_, builder) => {
      const gasPrice = builder().build();

      const result = GasPriceSchema.safeParse([gasPrice]);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid gas price', () => {
      const gasPrice = [
        // type is schema discriminator
        { type: faker.string.sample() },
      ];

      const result = GasPriceSchema.safeParse(gasPrice);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_union_discriminator',
            options: ['oracle', 'fixed', 'fixed1559'],
            path: [0, 'type'],
            message:
              "Invalid discriminator value. Expected 'oracle' | 'fixed' | 'fixed1559'",
          },
        ]),
      );
    });
  });

  describe('PricesProviderSchema', () => {
    it('should validate a valid prices provider', () => {
      const pricesProvider = pricesProviderBuilder().build();

      const result = PricesProviderSchema.safeParse(pricesProvider);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid prices provider chainName', () => {
      const pricesProvider = pricesProviderBuilder()
        .with('chainName', faker.number.int() as unknown as string)
        .build();

      const result = PricesProviderSchema.safeParse(pricesProvider);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['chainName'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should not validate an invalid prices provider nativeCoin', () => {
      const pricesProvider = pricesProviderBuilder()
        .with('nativeCoin', faker.number.int() as unknown as string)
        .build();

      const result = PricesProviderSchema.safeParse(pricesProvider);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['nativeCoin'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });

  describe('BalancesProviderSchema', () => {
    it('should validate a valid BalancesProvider', () => {
      const balancesProvider = balancesProviderBuilder().build();

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(result.success).toBe(true);
    });

    it('should not validate an invalid balancesProvider chainName', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - chainName is expected to be a string
      balancesProvider.chainName = faker.number.int();

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['chainName'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });

    it('should default balancesProvider chainName to null', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete balancesProvider.chainName;

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(result.success && result.data.chainName).toStrictEqual(null);
    });

    it('should not validate an undefined balancesProvider enablement status', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete balancesProvider.enabled;

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'undefined',
            path: ['enabled'],
            message: 'Required',
          },
        ]),
      );
    });

    it('should not validate an invalid balancesProvider enablement status', () => {
      const balancesProvider = balancesProviderBuilder().build();
      // @ts-expect-error - enabled is expected to be a boolean
      balancesProvider.enabled = 'true';

      const result = BalancesProviderSchema.safeParse(balancesProvider);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'boolean',
            received: 'string',
            path: ['enabled'],
            message: 'Expected boolean, received string',
          },
        ]),
      );
    });
  });

  describe('ContractAddressesSchema', () => {
    it('should validate a valid ContractAddresses', () => {
      const contractAddresses = contractAddressesBuilder().build();

      const result = ContractAddressesSchema.safeParse(contractAddresses);

      expect(result.success).toBe(true);
    });

    [
      'safeSingletonAddress' as const,
      'safeProxyFactoryAddress' as const,
      'multiSendAddress' as const,
      'multiSendCallOnlyAddress' as const,
      'fallbackHandlerAddress' as const,
      'signMessageLibAddress' as const,
      'createCallAddress' as const,
      'simulateTxAccessorAddress' as const,
      'safeWebAuthnSignerFactoryAddress' as const,
    ].forEach((field) => {
      it(`should checksum the ${field}`, () => {
        const contractAddresses = contractAddressesBuilder()
          .with(
            field,
            faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
          )
          .build();

        const result = ContractAddressesSchema.safeParse(contractAddresses);

        expect(result.success && result.data[field]).toBe(
          getAddress(contractAddresses[field]!),
        );
      });

      it(`should allow undefined ${field} and default to null`, () => {
        const contractAddresses = contractAddressesBuilder().build();
        delete contractAddresses[field];

        const result = ContractAddressesSchema.safeParse(contractAddresses);

        expect(result.success && result.data[field]).toBe(null);
      });
    });
  });

  describe('ChainSchema', () => {
    it('should validate a valid chain', () => {
      const chain = chainBuilder().build();

      const result = ChainSchema.safeParse(chain);

      expect(result.success).toBe(true);
    });

    it.each([['chainLogoUri' as const], ['ensRegistryAddress' as const]])(
      'should allow undefined %s and default to null',
      (field) => {
        const chain = chainBuilder().build();
        delete chain[field];

        const result = ChainSchema.safeParse(chain);

        expect(result.success && result.data[field]).toBe(null);
      },
    );

    it.each(['transactionService' as const, 'vpcTransactionService' as const])(
      'accept non-trailing slash %s as is',
      (field) => {
        const url = faker.internet.url({ appendSlash: false });
        const chain = chainBuilder().with(field, url).build();

        const result = ChainSchema.safeParse(chain);

        expect(result.success && result.data[field]).toBe(url);
      },
    );

    it.each(['transactionService' as const, 'vpcTransactionService' as const])(
      'should remove trailing slashes from %s',
      (field) => {
        const url = faker.internet.url({ appendSlash: false });
        const chain = chainBuilder().with(field, `${url}/`).build();

        const result = ChainSchema.safeParse(chain);

        expect(result.success && result.data[field]).toBe(url);
      },
    );

    it.each([
      ['chainId' as const],
      ['chainName' as const],
      ['description' as const],
      ['shortName' as const],
      ['transactionService' as const],
      ['vpcTransactionService' as const],
      ['recommendedMasterCopyVersion' as const],
    ])('should not validate a chain without %s', (field) => {
      const chain = chainBuilder().build();
      delete chain[field];

      const result = ChainSchema.safeParse(chain);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: [field],
            message: 'Required',
          },
        ]),
      );
    });

    it.each([
      ['rpcUri' as const],
      ['safeAppsRpcUri' as const],
      ['publicRpcUri' as const],
      ['blockExplorerUriTemplate' as const],
      ['beaconChainExplorerUriTemplate' as const],
      ['contractAddresses' as const],
      ['nativeCurrency' as const],
      ['pricesProvider' as const],
      ['balancesProvider' as const],
      ['theme' as const],
    ])('should not validate a chain without %s', (field) => {
      const chain = chainBuilder().build();
      delete chain[field];

      const result = ChainSchema.safeParse(chain);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: [field],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('ChainLenientPageSchema', () => {
    it('should validate a valid Chain page', () => {
      const chains = faker.helpers.multiple(() => chainBuilder().build(), {
        count: { min: 1, max: 5 },
      });
      const chainPage = pageBuilder()
        .with('results', chains)
        .with('count', chains.length)
        .build();

      const result = ChainLenientPageSchema.safeParse(chainPage);

      expect(result.success).toBe(true);
    });

    it('should exclude invalid Chain items', () => {
      const chains = faker.helpers.multiple(() => chainBuilder().build(), {
        count: { min: 1, max: 5 },
      });
      const chainPage = pageBuilder<Chain>()
        .with('results', chains)
        .with('count', chains.length)
        .build();
      // @ts-expect-error - results are assumed optional
      delete chainPage.results[0].chainId;

      const result = ChainLenientPageSchema.safeParse(chainPage);

      expect(result.success).toBe(true);
    });
  });
});
