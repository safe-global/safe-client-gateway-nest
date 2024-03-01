export class InvalidVerificationCodeError extends Error {
  constructor(args: { chainId: string; safeAddress: string; signer: string }) {
    super(
      `The verification code is invalid. chainId=${args.chainId}, safeAddress=${args.safeAddress}, signer=${args.signer} `,
    );
  }
}
