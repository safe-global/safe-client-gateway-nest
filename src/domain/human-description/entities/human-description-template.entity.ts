import { decodeFunctionData, isHex, parseAbi } from 'viem';
import type {
  HumanDescriptionFragment,
  TextFragment,
} from '@/domain/human-description/entities/human-description.entity';
import { ValueType } from '@/domain/human-description/entities/human-description.entity';

type SafeRegExpExecArray = RegExpExecArray & {
  groups: NonNullable<RegExpExecArray['groups']>;
};

/**
 * A {@link HumanDescriptionTemplate} represents a human-readable template
 *
 * The template requires a function signature in a string format and the
 * respective human-readable template.
 *
 * Creating a new {@link HumanDescriptionTemplate} triggers the ABI parsing
 * for the function signature, which can be an expensive operation.
 */
export class HumanDescriptionTemplate {
  private readonly functionAbi: never;

  private static readonly REGEX =
    /{{(?<typeToken>\w+) \$(?<paramIndex>\d+)}}|(?<textToken>\w+)/g;

  /**
   * Store the regex matches as an array instead of an iterable so that it can be restarted
   * @private
   */
  private readonly templateMatches: Array<SafeRegExpExecArray>;

  constructor(
    functionSignature: string,
    private readonly template: string,
  ) {
    this.functionAbi = parseAbi([functionSignature]);

    this.templateMatches = Array.from(
      template.matchAll(HumanDescriptionTemplate.REGEX),
    ).filter((match): match is SafeRegExpExecArray => {
      return match.groups !== undefined;
    });
  }

  /**
   * Parses a hex-data string into an array of {@link HumanDescriptionFragment}
   *
   * The resulting array represents the human-readable message in-order i.e.;
   * the first index represents the first word, second index the second word, etc.
   *
   * @param to - the target address of the transaction
   * @param data - the raw data of the transaction
   */
  parse(to: string, data: `0x${string}`): Array<HumanDescriptionFragment> {
    const { args } = decodeFunctionData({
      abi: this.functionAbi,
      data,
    });

    const fragments: Array<HumanDescriptionFragment> = [];

    for (const match of this.templateMatches) {
      if ('textToken' in match.groups && match.groups.textToken !== undefined) {
        const textFragment: TextFragment = {
          type: ValueType.Text,
          value: match.groups.textToken,
        };
        fragments.push(textFragment);
      } else if (
        'typeToken' in match.groups &&
        'paramIndex' in match.groups &&
        match.groups.typeToken !== undefined &&
        match.groups.paramIndex !== undefined
      ) {
        const tokenType = match.groups.typeToken;
        const paramIndex = match.groups.paramIndex;

        if (!args) {
          throw Error(
            `Error mapping token type ${tokenType}. No arguments provided`,
          );
        }

        fragments.push(
          this._mapTokenType(to, tokenType, Number(paramIndex), args),
        );
      } else {
        throw Error(`Error parsing template ${this.template}`);
      }
    }

    return fragments;
  }

  private _mapTokenType(
    to: string,
    tokenType: string,
    index: number,
    args: ReadonlyArray<unknown>,
  ): HumanDescriptionFragment {
    const value = args[index];

    switch (tokenType) {
      case 'tokenValue': {
        if (typeof value !== 'bigint') {
          throw Error(
            `Invalid token type amount. tokenType=${tokenType}, amount=${value}`,
          );
        }

        return {
          type: ValueType.TokenValue,
          value: { amount: value, address: to },
        };
      }
      case 'address': {
        if (!isHex(value)) {
          throw Error(
            `Invalid token type value. tokenType=${tokenType}, address=${value}`,
          );
        }

        return {
          type: ValueType.Address,
          value,
        };
      }
      case 'number': {
        if (typeof value !== 'bigint') {
          throw Error(
            `Invalid token type value. tokenType=${tokenType}, address=${value}`,
          );
        }

        return {
          type: ValueType.Number,
          value,
        };
      }
      default: {
        throw Error(`Unknown token type ${tokenType}`);
      }
    }
  }
}
