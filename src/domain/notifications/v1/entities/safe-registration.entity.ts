export class SafeRegistration {
  chainId: string;
  safes: Array<string>;
  signatures: Array<string>;

  constructor(
    chainId: string,
    safes: Array<string>,
    signatures: Array<string>,
  ) {
    this.chainId = chainId;
    this.safes = safes;
    this.signatures = signatures;
  }
}
