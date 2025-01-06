import { convertToDate } from '@/datasources/common/utils';
import { Outreach as DbOutreach } from '@/datasources/targeted-messaging/entities/outreach.entity';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OutreachDbMapper {
  map(outreach: DbOutreach): Outreach {
    return {
      id: outreach.id,
      name: outreach.name,
      startDate: convertToDate(outreach.start_date),
      endDate: convertToDate(outreach.end_date),
      sourceId: outreach.source_id,
      type: outreach.type,
      teamName: outreach.team_name,
      sourceFile: outreach.source_file,
      sourceFileProcessedDate: outreach.source_file_processed_date
        ? convertToDate(outreach.source_file_processed_date)
        : null,
      sourceFileChecksum: outreach.source_file_checksum,
      targetAll: outreach.target_all,
      created_at: convertToDate(outreach.created_at),
      updated_at: convertToDate(outreach.updated_at),
    };
  }
}
