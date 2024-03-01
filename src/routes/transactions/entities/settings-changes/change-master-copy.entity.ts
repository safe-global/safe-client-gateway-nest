import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class ChangeMasterCopy extends SettingsChange {
  @ApiProperty()
  implementation: AddressInfo;

  constructor(implementation: AddressInfo) {
    super(SettingsChangeType.ChangeMasterCopy);
    this.implementation = implementation;
  }
}
