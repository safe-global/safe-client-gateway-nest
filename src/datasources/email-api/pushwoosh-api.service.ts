import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { CreateEmailMessageDto } from '@/domain/account/entities/create-email-message.dto.entity';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';

@Injectable()
export class PushwooshApi implements IEmailApi {
  private readonly apiKey: string;
  private readonly applicationCode: string;
  private readonly baseUri: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.getOrThrow<string>('email.apiKey');
    this.applicationCode = this.configurationService.getOrThrow<string>(
      'email.applicationCode',
    );
    this.baseUri =
      this.configurationService.getOrThrow<string>('email.baseUri');
    this.fromEmail =
      this.configurationService.getOrThrow<string>('email.fromEmail');
    this.fromName =
      this.configurationService.getOrThrow<string>('email.fromName');
  }

  /**
   * Creates an email message through the Pushwoosh API.
   * For details on the specification see:
   * https://docs.pushwoosh.com/platform-docs/api-reference/email-api#createemailmessage
   */
  async createMessage(
    createEmailMessageDto: CreateEmailMessageDto,
  ): Promise<void> {
    try {
      const url = `${this.baseUri}/json/1.3/createEmailMessage`;
      await this.networkService.post(url, {
        request: {
          application: this.applicationCode, // application code, should exist on Pushwoosh
          auth: this.apiKey,
          notifications: [
            {
              send_date: 'now',
              email_template: createEmailMessageDto.template, // template code, should exist on Pushwoosh
              devices: createEmailMessageDto.to,
              use_auto_registration: true, // auto-register email addresses while sending
              subject: [{ default: createEmailMessageDto.subject }],
              dynamic_content_placeholders: createEmailMessageDto.substitutions, // key-value template substitutions
              from: { name: this.fromName, email: this.fromEmail },
              // optional unique identifier to avoid messages duplication
              ...(createEmailMessageDto.emailMessageId && {
                transactionId: createEmailMessageDto.emailMessageId,
              }),
            },
          ],
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async deleteEmailAddress(args: { emailAddress: string }): Promise<void> {
    try {
      const url = `${this.baseUri}/json/1.3/deleteEmail`;
      await this.networkService.post(url, {
        request: {
          application: this.applicationCode,
          email: args.emailAddress,
        },
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
