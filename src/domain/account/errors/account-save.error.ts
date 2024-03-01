export class AccountSaveError extends Error {
  constructor(chainId: string, safeAddress: string, signer: string) {
    super(
      `Error while creating account. Account was not created. chainId=${chainId}, safeAddress=${safeAddress}, signer=${signer}`,
    );
  }
}
