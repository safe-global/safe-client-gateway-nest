import { CreateEmailMessageDto } from '@/domain/account/entities/create-email-message.dto.entity';

export const IEmailApi = Symbol('IEmailApi');

export interface IEmailApi {
  /**
   * Creates and sends a new email message.
   *
   * @param createEmailMessageDto.to - the email address of the recipient
   * @param createEmailMessageDto.template - the email template reference
   * @param createEmailMessageDto.subject - the email message subject
   * @param createEmailMessageDto.substitutions - object containing a dictionary of substitutions
   * to be applied to the email message template
   * @param createEmailMessageDto.emailMessageId - optional unique identifier for the email message
   */
  createMessage(createEmailMessageDto: CreateEmailMessageDto): Promise<void>;

  /**
   * Triggers an email address deletion on the underlying provider.
   *
   * @param args.emailAddress - the email address to be deleted from the provider systems
   */
  deleteEmailAddress(args: { emailAddress: string }): Promise<void>;
}
