export class AccountDoesNotExistError extends Error {
  readonly signer: string;

  constructor(chainId: string, safeAddress: string, signer: string) {
    super(
      `Account for ${signer} of ${safeAddress} on chain ${chainId} does not exist.`,
    );
    this.signer = signer;
  }
}
