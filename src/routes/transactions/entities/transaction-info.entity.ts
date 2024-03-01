import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';

export enum TransactionInfoType {
  Creation = 'Creation',
  Custom = 'Custom',
  SettingsChange = 'SettingsChange',
  Transfer = 'Transfer',
}

export class TransactionInfo {
  @ApiProperty()
  type: TransactionInfoType;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;
  // TODO: Remove nullable once the feature flag is removed, allow returning an empty array instead
  @ApiPropertyOptional({ type: RichDecodedInfo, nullable: true })
  richDecodedInfo: RichDecodedInfo | null | undefined;

  protected constructor(
    type: TransactionInfoType,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null | undefined,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
    this.richDecodedInfo = richDecodedInfo;
  }
}
