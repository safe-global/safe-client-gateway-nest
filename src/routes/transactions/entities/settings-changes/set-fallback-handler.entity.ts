import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class SetFallbackHandler extends SettingsChange {
  @ApiProperty()
  handler: AddressInfo;

  constructor(handler: AddressInfo) {
    super(SettingsChangeType.SetFallbackHandler);
    this.handler = handler;
  }
}
