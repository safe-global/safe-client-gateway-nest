import { faker } from '@faker-js/faker';
import { concatHex, encodeFunctionData, getAddress, pad, toHex } from 'viem';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { CALL_OPERATION } from '@/domain/safe/entities/operation.entity';
import { getSafeSingletonDeployment } from '@safe-global/safe-deployments';

describe('Safe Contract Helper Tests', () => {
  let target: SafeContractHelper;
  let abi: Array<unknown>;

  const supportedSafeVersion = '1.3.0';

  beforeAll(() => {
    const deployment = getSafeSingletonDeployment({
      version: supportedSafeVersion,
    });
    if (!deployment) throw Error('Safe deployment is undefined');
    abi = deployment.abi;
  });

  beforeEach(() => {
    target = new SafeContractHelper();
  });

  it('decodes an execTransaction correctly', () => {
    const to = getAddress(faker.finance.ethereumAddress());
    const value = faker.number.bigInt();
    const callData = getExecTransactionCallData({ to, value });

    const actual = target.decode(SafeContractHelper.EXEC_TRANSACTION, callData);

    expect(actual).toEqual({ data: '0x00', to: to, value: value });
  });

  it('decoding a non execTransaction call throws', () => {
    const functionSignature = faker.string.hexadecimal({
      length: 8,
    }) as `0x${string}`;
    const arg1 = pad(getAddress(faker.finance.ethereumAddress()));
    const arg2 = pad(getAddress(faker.finance.ethereumAddress()));
    const callData = concatHex([functionSignature, arg1, arg2]);

    expect(() => {
      target.decode(SafeContractHelper.EXEC_TRANSACTION, callData);
    }).toThrow();
  });

  it('isCall returns true for a execTransaction call', () => {
    const callData = getExecTransactionCallData();

    const actual = target.isCall(callData);

    expect(actual).toBe(true);
  });

  it('isCall returns false for a non safe call', () => {
    const functionSignature = faker.string.hexadecimal({
      length: 8,
    }) as `0x${string}`;
    const arg1 = pad(getAddress(faker.finance.ethereumAddress()));
    const arg2 = pad(getAddress(faker.finance.ethereumAddress()));
    const callData = concatHex([functionSignature, arg1, arg2]);

    const actual = target.isCall(callData);

    expect(actual).toBe(false);
  });

  it.each([
    {
      functionName: 'addOwnerWithThreshold',
      args: [
        getAddress(faker.finance.ethereumAddress()),
        toHex(faker.number.bigInt()),
      ],
    },
    {
      functionName: 'approveHash',
      args: [pad(toHex(faker.number.bigInt()))],
    },
    {
      functionName: 'approvedHashes',
      args: [
        getAddress(faker.finance.ethereumAddress()),
        pad(toHex(faker.number.bigInt())),
      ],
    },
    {
      functionName: 'changeThreshold',
      args: [pad(toHex(faker.number.bigInt()))],
    },
    {
      functionName: 'checkNSignatures',
      args: [
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt())),
      ],
    },
    {
      functionName: 'checkSignatures',
      args: [
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt())),
      ],
    },
    {
      functionName: 'disableModule',
      args: [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ],
    },
    {
      functionName: 'enableModule',
      args: [getAddress(faker.finance.ethereumAddress())],
    },
    {
      functionName: 'execTransactionFromModule',
      args: [
        getAddress(faker.finance.ethereumAddress()),
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt())),
        pad(toHex(faker.number.bigInt({ min: 0, max: 1 }))),
      ],
    },
    {
      functionName: 'isModuleEnabled',
      args: [getAddress(faker.finance.ethereumAddress())],
    },
    {
      functionName: 'isOwner',
      args: [getAddress(faker.finance.ethereumAddress())],
    },
    {
      functionName: 'removeOwner',
      args: [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        toHex(faker.number.bigInt()),
      ],
    },
    {
      functionName: 'setGuard',
      args: [getAddress(faker.finance.ethereumAddress())],
    },
    {
      functionName: 'swapOwner',
      args: [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ],
    },
  ])('$functionName is valid call', ({ functionName, args }) => {
    const callData = encodeFunctionData({
      abi,
      functionName,
      args,
    });

    const actual = target.isCall(callData);

    expect(actual).toBe(true);
  });

  function getExecTransactionCallData(args?: {
    to?: `0x${string}`;
    value?: bigint;
  }): `0x${string}` {
    const to = args?.to ?? getAddress(faker.finance.ethereumAddress());
    const value = args?.value ?? faker.number.bigInt();
    const data = toHex(0);
    const operation = CALL_OPERATION;
    const safeTxGas = faker.number.bigInt();
    const baseGas = faker.number.bigInt();
    const gasPrice = faker.number.bigInt();
    const gasToken = getAddress(faker.finance.ethereumAddress());
    const refundReceiver = getAddress(faker.finance.ethereumAddress());
    const signatures = faker.string.hexadecimal({ length: 64 * 2 });

    return encodeFunctionData({
      abi,
      functionName: 'execTransaction',
      args: [
        to,
        value,
        data,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        signatures,
      ],
    });
  }
});
