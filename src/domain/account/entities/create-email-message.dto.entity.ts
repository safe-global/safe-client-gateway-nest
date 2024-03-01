export class CreateEmailMessageDto {
  to!: string[];
  template!: string;
  subject!: string;
  substitutions!: Record<string, unknown> | null;
  emailMessageId?: string;
}
