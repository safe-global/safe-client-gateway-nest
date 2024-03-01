export enum TokenType {
  Erc721 = 'ERC721',
  Erc20 = 'ERC20',
  NativeToken = 'NATIVE_TOKEN',
}

export interface Token {
  address: string;
  decimals: number | null;
  logoUri: string;
  name: string;
  symbol: string;
  type: TokenType;
  trusted: boolean;
}
