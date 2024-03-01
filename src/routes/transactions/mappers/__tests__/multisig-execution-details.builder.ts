import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import {
  MultisigConfirmationDetails,
  MultisigExecutionDetails,
} from '@/routes/transactions/entities/transaction-details/multisig-execution-details.entity';
import { ExecutionDetailsType } from '@/routes/transactions/entities/transaction-details/execution-details.entity';

const MIN_SIGNERS = 2;
const MAX_SIGNERS = 5;

function multisigConfirmationDetailsBuilder(): IBuilder<MultisigConfirmationDetails> {
  return new Builder<MultisigConfirmationDetails>()
    .with('signer', addressInfoBuilder().build())
    .with('signature', faker.string.hexadecimal())
    .with('submittedAt', faker.number.int());
}

export function multisigExecutionDetailsBuilder(): IBuilder<MultisigExecutionDetails> {
  const signers = faker.helpers.multiple(() => addressInfoBuilder().build(), {
    count: { min: MIN_SIGNERS, max: MAX_SIGNERS },
  });
  const confirmations = faker.helpers.multiple(
    () => multisigConfirmationDetailsBuilder().build(),
    { count: { min: MIN_SIGNERS, max: MAX_SIGNERS } },
  );

  return new Builder<MultisigExecutionDetails>()
    .with('type', ExecutionDetailsType.Multisig)
    .with('submittedAt', faker.number.int())
    .with('nonce', faker.number.int())
    .with('safeTxGas', faker.string.numeric())
    .with('baseGas', faker.string.numeric())
    .with('gasPrice', faker.string.numeric())
    .with('gasToken', faker.finance.ethereumAddress())
    .with('refundReceiver', addressInfoBuilder().build())
    .with('safeTxHash', faker.string.sample())
    .with('executor', addressInfoBuilder().build())
    .with('signers', signers)
    .with('confirmationsRequired', faker.number.int({ max: signers.length }))
    .with('confirmations', confirmations)
    .with('rejectors', faker.helpers.arrayElements(signers, MIN_SIGNERS))
    .with('gasTokenInfo', tokenBuilder().build())
    .with('trusted', faker.datatype.boolean());
}
