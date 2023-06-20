import { JSONSchemaType } from 'ajv';
import { GetEstimationDto } from '../get-estimation.dto.entity';

export const getEstimationDtoSchema: JSONSchemaType<GetEstimationDto> = {
  $id: 'https://safe-client.safe.global/schemas/estimations/get-estimation.dto.json',
  type: 'object',
  properties: {
    to: { type: 'string' },
    value: { type: 'string' },
    data: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    operation: { type: 'number', enum: [0, 1] },
  },
  required: ['to', 'value'],
};
