export class Outreach {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  source_id: number;
  type: string;
  team_name: string;
  source_file: string;
  source_file_processed_date: string;
  created_at: string;
  updated_at: string;

  constructor(
    id: number,
    name: string,
    start_date: string,
    end_date: string,
    source_id: number,
    type: string,
    team_name: string,
    source_file: string,
    source_file_processed_date: string,
    created_at: string,
    updated_at: string,
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
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
