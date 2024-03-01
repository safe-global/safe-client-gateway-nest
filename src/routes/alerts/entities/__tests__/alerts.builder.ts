import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import {
  AlertLog,
  AlertTransaction,
  Alert,
  EventType,
} from '@/routes/alerts/entities/alert.dto.entity';

export function alertLogBuilder(): IBuilder<AlertLog> {
  return new Builder<AlertLog>()
    .with('address', faker.finance.ethereumAddress())
    .with(
      'topics',
      Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () =>
        faker.string.hexadecimal(),
      ),
    )
    .with('data', faker.string.hexadecimal());
}

export function alertTransactionBuilder(): IBuilder<AlertTransaction> {
  return new Builder<AlertTransaction>()
    .with('network', faker.string.numeric())
    .with('block_hash', faker.string.hexadecimal({ length: 66 }))
    .with('block_number', faker.number.int())
    .with('hash', faker.string.hexadecimal({ length: 66 }))
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with(
      'logs',
      Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () =>
        alertLogBuilder().build(),
      ),
    )
    .with('input', faker.string.hexadecimal())
    .with('value', faker.string.hexadecimal())
    .with('nonce', faker.string.hexadecimal())
    .with('gas', faker.string.hexadecimal())
    .with('gas_used', faker.string.hexadecimal())
    .with('cumulative_gas_used', faker.string.hexadecimal())
    .with('gas_price', faker.string.hexadecimal())
    .with('gas_tip_cap', faker.string.hexadecimal())
    .with('gas_fee_cap', faker.string.hexadecimal());
}

export function alertBuilder(): IBuilder<Alert> {
  return new Builder<Alert>()
    .with('id', faker.string.uuid())
    .with('event_type', faker.helpers.enumValue(EventType))
    .with('transaction', alertTransactionBuilder().build());
}
