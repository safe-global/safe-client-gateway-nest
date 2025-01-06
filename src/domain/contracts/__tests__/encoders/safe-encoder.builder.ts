import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { encodeFunctionData, getAddress, pad } from 'viem';
import Safe130 from '@/abis/safe/v1.3.0/GnosisSafe.abi';
import type { Safe } from '@/domain/safe/entities/safe.entity';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';

const ZERO_ADDRESS = pad('0x0', { size: 20 });
const SENTINEL_ADDRESS = pad('0x1', { dir: 'left', size: 20 });

const MAX_THRESHOLD = 10;

function getPrevOwner(ownerToRemove: Hex, owners?: Safe['owners']): Hex {
  if (!owners) {
    return SENTINEL_ADDRESS;
  }

  const ownerIndex = owners.findIndex((owner) => {
    return owner.toLowerCase() === ownerToRemove.toLowerCase();
  });

  return ownerIndex <= 0
    ? SENTINEL_ADDRESS
    : getAddress(owners[ownerIndex - 1]);
}

// setup

type SetupArgs = {
  owners: Array<Hex>;
  threshold: bigint;
  to: Hex;
  data: Hex;
  fallbackHandler: Hex;
  paymentToken: Hex;
  payment: bigint;
  paymentReceiver: Hex;
};

class SetupEncoder<T extends SetupArgs> extends Builder<T> implements IEncoder {
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'setup',
      args: [
        args.owners,
        args.threshold,
        args.to,
        args.data,
        args.fallbackHandler,
        args.paymentToken,
        args.payment,
        args.paymentReceiver,
      ],
    });
  }
}

export function setupEncoder(): SetupEncoder<SetupArgs> {
  return new SetupEncoder()
    .with('owners', [getAddress(faker.finance.ethereumAddress())])
    .with('threshold', BigInt(1))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('data', '0x')
    .with('fallbackHandler', ZERO_ADDRESS)
    .with('paymentToken', ZERO_ADDRESS)
    .with('payment', BigInt(0))
    .with('paymentReceiver', ZERO_ADDRESS);
}

// execTransaction

type ExecTransactionArgs = {
  to: Hex;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Hex;
  refundReceiver: Hex;
  signatures: Hex;
};

class ExecTransactionEncoder<T extends ExecTransactionArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
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
  }
}

export function execTransactionEncoder(): ExecTransactionEncoder<ExecTransactionArgs> {
  return new ExecTransactionEncoder()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', BigInt(0))
    .with('data', '0x')
    .with('operation', 0)
    .with('safeTxGas', BigInt(0))
    .with('baseGas', BigInt(0))
    .with('gasPrice', BigInt(0))
    .with('gasToken', ZERO_ADDRESS)
    .with('refundReceiver', ZERO_ADDRESS)
    .with('signatures', '0x');
}

// addOwnerWithThreshold

type AddOwnerWithThresholdArgs = {
  owner: Hex;
  threshold: bigint;
};

class AddOwnerWithThresholdEncoder<T extends AddOwnerWithThresholdArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'addOwnerWithThreshold',
      args: [args.owner, args.threshold],
    });
  }
}

export function addOwnerWithThresholdEncoder(): AddOwnerWithThresholdEncoder<AddOwnerWithThresholdArgs> {
  return new AddOwnerWithThresholdEncoder()
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('threshold', faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }));
}

// removeOwner

type RemoveOwnerArgs = {
  prevOwner: Hex;
  owner: Hex;
  threshold: bigint;
};

class RemoveOwnerEncoder<T extends RemoveOwnerArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'removeOwner',
      args: [args.prevOwner, args.owner, args.threshold],
    });
  }
}

export function removeOwnerEncoder(
  owners?: Safe['owners'],
): RemoveOwnerEncoder<RemoveOwnerArgs> {
  const owner = getAddress(faker.finance.ethereumAddress());
  const prevOwner = getPrevOwner(owner, owners);

  return new RemoveOwnerEncoder()
    .with('prevOwner', prevOwner)
    .with('owner', owner)
    .with('threshold', faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }));
}

// swapOwner

type SwapOwnerArgs = {
  prevOwner: Hex;
  oldOwner: Hex;
  newOwner: Hex;
};

class SwapOwnerEncoder<T extends SwapOwnerArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'swapOwner',
      args: [args.prevOwner, args.oldOwner, args.newOwner],
    });
  }
}

export function swapOwnerEncoder(
  owners?: Safe['owners'],
): SwapOwnerEncoder<SwapOwnerArgs> {
  const oldOwner = getAddress(faker.finance.ethereumAddress());
  const prevOwner = getPrevOwner(oldOwner, owners);

  return new SwapOwnerEncoder()
    .with('prevOwner', prevOwner)
    .with('oldOwner', oldOwner)
    .with('newOwner', getAddress(faker.finance.ethereumAddress()));
}

// changeThreshold

type ChangeThresholdArgs = {
  threshold: bigint;
};

class ChangeThresholdEncoder<T extends ChangeThresholdArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'changeThreshold',
      args: [args.threshold],
    });
  }
}

export function changeThresholdEncoder(): ChangeThresholdEncoder<ChangeThresholdArgs> {
  return new ChangeThresholdEncoder().with(
    'threshold',
    faker.number.bigInt({ min: 1, max: MAX_THRESHOLD }),
  );
}

// enableModule

type EnableModuleArgs = {
  module: Hex;
};

class EnableModuleEncoder<T extends EnableModuleArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'enableModule',
      args: [args.module],
    });
  }
}

export function enableModuleEncoder(): EnableModuleEncoder<EnableModuleArgs> {
  return new EnableModuleEncoder().with(
    'module',
    getAddress(faker.finance.ethereumAddress()),
  );
}

// disableModule

type DisableModuleArgs = {
  prevModule: Hex;
  module: Hex;
};

class DisableModuleEncoder<T extends DisableModuleArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'disableModule',
      args: [args.prevModule, args.module],
    });
  }
}

export function disableModuleEncoder(): DisableModuleEncoder<DisableModuleArgs> {
  return new DisableModuleEncoder()
    .with('prevModule', getAddress(faker.finance.ethereumAddress()))
    .with('module', getAddress(faker.finance.ethereumAddress()));
}

// setFallbackHandler

type SetFallbackHandlerArgs = {
  handler: Hex;
};

class SetFallbackHandlerEncoder<T extends SetFallbackHandlerArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'setFallbackHandler',
      args: [args.handler],
    });
  }
}

export function setFallbackHandlerEncoder(): SetFallbackHandlerEncoder<SetFallbackHandlerArgs> {
  return new SetFallbackHandlerEncoder().with(
    'handler',
    getAddress(faker.finance.ethereumAddress()),
  );
}

// setGuard

type SetGuardArgs = {
  guard: Hex;
};

class SetGuardEncoder<T extends SetGuardArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: Safe130,
      functionName: 'setGuard',
      args: [args.guard],
    });
  }
}

export function setGuardEncoder(): SetGuardEncoder<SetGuardArgs> {
  return new SetGuardEncoder().with(
    'guard',
    getAddress(faker.finance.ethereumAddress()),
  );
}
