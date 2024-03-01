export class EditTimespanError extends Error {
  constructor(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    timespanMs: number;
    lockWindowMs: number;
  }) {
    super(
      `Email cannot be edited at this time. ${args.timespanMs} ms have elapsed out of ${args.lockWindowMs} ms for signer=${args.signer}, safe=${args.safeAddress}, chainId=${args.chainId}`,
    );
  }
}
