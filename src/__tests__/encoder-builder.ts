import { Hex } from 'viem';

export interface IEncoder<E = Hex> {
  encode(): E;
}
