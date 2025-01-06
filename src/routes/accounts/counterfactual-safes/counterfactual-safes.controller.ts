import { CreateCounterfactualSafeDtoSchema } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { CounterfactualSafesService } from '@/routes/accounts/counterfactual-safes/counterfactual-safes.service';
import { CounterfactualSafe } from '@/routes/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/routes/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class CounterfactualSafesController {
  constructor(private readonly service: CounterfactualSafesService) {}

  @ApiOkResponse({ type: CounterfactualSafe })
  @Get(':address/counterfactual-safes/:chainId/:predictedAddress')
  async getCounterfactualSafe(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('predictedAddress', new ValidationPipe(AddressSchema))
    predictedAddress: `0x${string}`,
  ): Promise<CounterfactualSafe> {
    return this.service.getCounterfactualSafe({
      address,
      chainId,
      predictedAddress,
    });
  }

  @ApiOkResponse({ type: CounterfactualSafe, isArray: true })
  @Get(':address/counterfactual-safes')
  async getCounterfactualSafes(
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
  ): Promise<Array<CounterfactualSafe>> {
    return this.service.getCounterfactualSafes(address);
  }

  @ApiOkResponse({ type: CounterfactualSafe })
  @Put(':address/counterfactual-safes')
  @UseGuards(AuthGuard)
  async createCounterfactualSafe(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Body(new ValidationPipe(CreateCounterfactualSafeDtoSchema))
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Promise<CounterfactualSafe> {
    return this.service.createCounterfactualSafe({
      authPayload,
      address,
      createCounterfactualSafeDto,
    });
  }

  @Delete(':address/counterfactual-safes/:chainId/:predictedAddress')
  @UseGuards(AuthGuard)
  async deleteCounterfactualSafe(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('predictedAddress', new ValidationPipe(AddressSchema))
    predictedAddress: `0x${string}`,
  ): Promise<void> {
    return this.service.deleteCounterfactualSafe({
      authPayload,
      address,
      chainId,
      predictedAddress,
    });
  }

  @Delete(':address/counterfactual-safes')
  @UseGuards(AuthGuard)
  async deleteCounterfactualSafes(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
  ): Promise<void> {
    return this.service.deleteCounterfactualSafes({ authPayload, address });
  }
}
