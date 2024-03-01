import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  SettingsChange,
  SettingsChangeType,
} from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class EnableModule extends SettingsChange {
  @ApiProperty()
  module: AddressInfo;

  constructor(module: AddressInfo) {
    super(SettingsChangeType.EnableModule);
    this.module = module;
  }
}
