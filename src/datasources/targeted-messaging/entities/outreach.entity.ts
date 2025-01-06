export class Outreach {
  id: number;
  name: string;
  start_date: Date;
  end_date: Date;
  source_id: number;
  type: string;
  team_name: string;
  source_file: string | null;
  source_file_processed_date: Date | null;
  source_file_checksum: string | null;
  target_all: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(
    id: number,
    name: string,
    start_date: Date,
    end_date: Date,
    source_id: number,
    type: string,
    team_name: string,
    source_file: string | null,
    source_file_processed_date: Date | null,
    source_file_checksum: string | null,
    target_all: boolean,
    created_at: Date,
    updated_at: Date,
  ) {
    this.id = id;
    this.name = name;
    this.start_date = start_date;
    this.end_date = end_date;
    this.source_id = source_id;
    this.type = type;
    this.team_name = team_name;
    this.source_file = source_file;
    this.source_file_processed_date = source_file_processed_date;
    this.source_file_checksum = source_file_checksum;
    this.target_all = target_all;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
