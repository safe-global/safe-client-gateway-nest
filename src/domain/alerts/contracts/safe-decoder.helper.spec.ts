import { Hex } from 'viem';
import { faker } from '@faker-js/faker';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/alerts/__tests__/safe-transactions.encoder';

describe('SafeDecoder', () => {
  let target: SafeDecoder;

  beforeEach(() => {
    jest.clearAllMocks();
    target = new SafeDecoder();
  });

  it('decodes an addOwnerWithThreshold function call correctly', () => {
    const addOwnerWithThreshold = addOwnerWithThresholdEncoder();
    const args = addOwnerWithThreshold.build();
    const data = addOwnerWithThreshold.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'addOwnerWithThreshold',
      args: [args.owner, args.threshold],
    });
  });

  it('decodes a removeOwner function call correctly', () => {
    const removeOwner = removeOwnerEncoder();
    const args = removeOwner.build();
    const data = removeOwner.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'removeOwner',
      args: [args.prevOwner, args.owner, args.threshold],
    });
  });

  it('decodes a swapOwner function call correctly', () => {
    const swapOwner = swapOwnerEncoder();
    const args = swapOwner.build();
    const data = swapOwner.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'swapOwner',
      args: [args.prevOwner, args.oldOwner, args.newOwner],
    });
  });

  it('decodes a changeThreshold function call correctly', () => {
    const changeThreshold = changeThresholdEncoder();
    const args = changeThreshold.build();
    const data = changeThreshold.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'changeThreshold',
      args: [args.threshold],
    });
  });

  it('decodes an execTransaction function call correctly', () => {
    const execTransaction = execTransactionEncoder();
    const args = execTransaction.build();
    const data = execTransaction.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'execTransaction',
      args: [
        args.to,
        args.value,
        args.data,
        args.operation,
        args.safeTxGas,
        args.baseGas,
        args.gasPrice,
        args.gasToken,
        args.refundReceiver,
        args.signatures,
      ],
    });
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
