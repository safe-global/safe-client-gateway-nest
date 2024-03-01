export class AlertLog {
  address!: string;
  topics!: Array<string>;
  data!: string;
}

export class AlertTransaction {
  network!: string;
  block_hash!: string;
  block_number!: number;
  hash!: string;
  from!: string;
  to!: string;
  logs!: Array<AlertLog>;
  input!: string;
  value!: string;
  nonce!: string;
  gas!: string;
  gas_used!: string;
  cumulative_gas_used!: string;
  gas_price!: string;
  gas_tip_cap!: string;
  gas_fee_cap!: string;
}

export enum EventType {
  ALERT = 'ALERT',
  TEST = 'TEST',
}

export class Alert {
  id!: string;
  event_type!: EventType;
  transaction!: AlertTransaction;
}
