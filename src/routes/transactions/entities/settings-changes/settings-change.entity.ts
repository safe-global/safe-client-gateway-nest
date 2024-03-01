import { ApiProperty } from '@nestjs/swagger';

export enum SettingsChangeType {
  AddOwner = 'ADD_OWNER',
  ChangeMasterCopy = 'CHANGE_MASTER_COPY',
  ChangeThreshold = 'CHANGE_THRESHOLD',
  DeleteGuard = 'DELETE_GUARD',
  DisableModule = 'DISABLE_MODULE',
  EnableModule = 'ENABLE_MODULE',
  RemoveOwner = 'REMOVE_OWNER',
  SetFallbackHandler = 'SET_FALLBACK_HANDLER',
  SetGuard = 'SET_GUARD',
  SwapOwner = 'SWAP_OWNER',
}

export abstract class SettingsChange {
  @ApiProperty()
  type: SettingsChangeType;

  protected constructor(type: SettingsChangeType) {
    this.type = type;
  }
}
