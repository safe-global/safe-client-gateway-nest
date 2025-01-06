import type {
  Abi,
  ContractEventName,
  ContractFunctionName,
  DecodeEventLogParameters,
  DecodeFunctionDataParameters,
  Hex,
} from 'viem';
import {
  decodeEventLog as _decodeEventLog,
  decodeFunctionData as _decodeFunctionData,
  toFunctionSelector,
} from 'viem';

type Helper<TAbi extends Abi> = `is${Capitalize<ContractFunctionName<TAbi>>}`;

type Helpers<TAbi extends Abi> = {
  [key in Helper<TAbi>]: (data: Hex) => boolean;
};

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

export function _generateHelpers<TAbi extends Abi>(
  abi: Readonly<TAbi>,
): Helpers<TAbi> {
  const helpers = {} as Helpers<TAbi>;

  for (const item of abi) {
    if (item.type !== 'function') {
      continue;
    }

    const helperName = `is${capitalize(item.name)}` as Helper<TAbi>;
    const functionSelector = toFunctionSelector(item);

    helpers[helperName] = (data: Hex): boolean => {
      return data.startsWith(functionSelector);
    };
  }

  return helpers;
}

export abstract class AbiDecoder<TAbi extends Abi> {
  readonly helpers: Helpers<TAbi>;

  protected constructor(private readonly abi: TAbi) {
    this.helpers = _generateHelpers(abi);
  }

  // Use inferred types from viem
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  decodeEventLog<
    const abi extends TAbi,
    eventName extends ContractEventName<abi> | undefined = undefined,
    topics extends Array<Hex> = Array<Hex>,
    data extends Hex | undefined = undefined,
    strict extends boolean = true,
  >(
    args: Omit<
      DecodeEventLogParameters<abi, eventName, topics, data, strict>,
      'abi'
    >,
  ) {
    return _decodeEventLog({
      ...args,
      abi: this.abi,
    });
  }

  // Use inferred types from viem
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  decodeFunctionData<TAbi extends Abi>(
    args: Omit<DecodeFunctionDataParameters<TAbi>, 'abi'>,
  ) {
    return _decodeFunctionData({ ...args, abi: this.abi });
  }
}
