export class EmailEditMatchesError extends Error {
  constructor(args: { chainId: string; safeAddress: string; signer: string }) {
    super(
      `The provided email address matches that set for the Safe owner. chainId=${args.chainId}, safeAddress=${args.safeAddress}, signer=${args.signer}`,
    );
  }
}
