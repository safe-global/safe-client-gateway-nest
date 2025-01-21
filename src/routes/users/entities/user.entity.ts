import { ApiProperty } from '@nestjs/swagger';

export class User {
  @ApiProperty()
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}
