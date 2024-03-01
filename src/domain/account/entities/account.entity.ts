export class InvalidEmailFormatError extends Error {
  constructor() {
    super('Provided email is not a recognizable email format.');
  }
}

export interface Account {
  chainId: string;
  emailAddress: EmailAddress;
  isVerified: boolean;
  safeAddress: string;
  signer: string;
  verificationCode: string | null;
  verificationGeneratedOn: Date | null;
  verificationSentOn: Date | null;
}

export class EmailAddress {
  // https://www.ietf.org/rfc/rfc5322.txt
  private static EMAIL_REGEX: RegExp =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  constructor(readonly value: string) {
    if (!EmailAddress.EMAIL_REGEX.test(value)) {
      throw new InvalidEmailFormatError();
    }
  }
}
