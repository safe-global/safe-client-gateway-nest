import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export class CreateCounterfactualSafeDto
  implements z.infer<typeof CreateCounterfactualSafeDtoSchema>
{
  chainId: string;
  fallbackHandler: `0x${string}`;
  owners: Array<`0x${string}`>;
  predictedAddress: `0x${string}`;
  saltNonce: string;
  singletonAddress: `0x${string}`;
  threshold: number;

  constructor(props: CreateCounterfactualSafeDto) {
    this.chainId = props.chainId;
    this.fallbackHandler = props.fallbackHandler;
    this.owners = props.owners;
    this.predictedAddress = props.predictedAddress;
    this.saltNonce = props.saltNonce;
    this.singletonAddress = props.singletonAddress;
    this.threshold = props.threshold;
  }
}

export const CreateCounterfactualSafeDtoSchema = z.object({
  chainId: z.string(),
  fallbackHandler: AddressSchema,
  owners: z.array(AddressSchema).min(1),
  predictedAddress: AddressSchema,
  saltNonce: z.string(),
  singletonAddress: AddressSchema,
  threshold: z.number().int().gte(1),
});
