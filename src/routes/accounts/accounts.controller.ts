import { CreateAccountDtoSchema } from '@/domain/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDtoSchema } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { AccountDataSetting } from '@/routes/accounts/entities/account-data-setting.entity';
import { AccountDataType } from '@/routes/accounts/entities/account-data-type.entity';
import { Account } from '@/routes/accounts/entities/account.entity';
import { CreateAccountDto } from '@/routes/accounts/entities/create-account.dto.entity';
import { UpsertAccountDataSettingsDto } from '@/routes/accounts/entities/upsert-account-data-settings.dto.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOkResponse({ type: Account })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  async createAccount(
    @Body(new ValidationPipe(CreateAccountDtoSchema))
    createAccountDto: CreateAccountDto,
    @Auth() authPayload: AuthPayload,
    @Req() req: Request,
  ): Promise<Account> {
    return this.accountsService.createAccount({
      authPayload,
      createAccountDto,
      clientIp: req.ip,
    });
  }

  @ApiOkResponse({ type: AccountDataType, isArray: true })
  @Get('data-types')
  async getDataTypes(): Promise<Array<AccountDataType>> {
    return this.accountsService.getDataTypes();
  }

  @ApiOkResponse({ type: AccountDataSetting, isArray: true })
  @Get(':address/data-settings')
  @UseGuards(AuthGuard)
  async getAccountDataSettings(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
  ): Promise<Array<AccountDataSetting>> {
    return this.accountsService.getAccountDataSettings({
      authPayload,
      address,
    });
  }

  @ApiOkResponse({ type: AccountDataSetting, isArray: true })
  @Put(':address/data-settings')
  @UseGuards(AuthGuard)
  async upsertAccountDataSettings(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Body(new ValidationPipe(UpsertAccountDataSettingsDtoSchema))
    upsertAccountDataSettingsDto: UpsertAccountDataSettingsDto,
  ): Promise<Array<AccountDataSetting>> {
    return this.accountsService.upsertAccountDataSettings({
      authPayload,
      address,
      upsertAccountDataSettingsDto,
    });
  }

  @ApiOkResponse({ type: Account })
  @Get(':address')
  @UseGuards(AuthGuard)
  async getAccount(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<Account> {
    return this.accountsService.getAccount({ authPayload, address });
  }

  @Delete(':address')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return this.accountsService.deleteAccount({ authPayload, address });
  }
}
