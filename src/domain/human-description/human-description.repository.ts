import { Inject, Injectable } from '@nestjs/common';
import { toFunctionSelector } from 'viem';
import { HumanDescriptionTemplate } from '@/domain/human-description/entities/human-description-template.entity';
import {
  FunctionSignatureHash,
  HumanDescriptionFragment,
} from '@/domain/human-description/entities/human-description.entity';
import { IHumanDescriptionRepository } from '@/domain/human-description/human-description.repository.interface';
import { IHumanDescriptionApi } from '@/domain/interfaces/human-description-api.interface';

@Injectable()
export class HumanDescriptionRepository implements IHumanDescriptionRepository {
  private readonly templates: Record<
    FunctionSignatureHash,
    HumanDescriptionTemplate
  > = {};

  constructor(
    @Inject(IHumanDescriptionApi)
    private readonly humanDescriptionApi: IHumanDescriptionApi,
  ) {
    const humanDescriptions = this.humanDescriptionApi.getDescriptions();

    for (const functionSignature in humanDescriptions) {
      const selector = toFunctionSelector(functionSignature);
      this.templates[selector] = new HumanDescriptionTemplate(
        functionSignature,
        humanDescriptions[functionSignature],
      );
    }
  }

  getHumanDescription(args: {
    functionSignatureHash: FunctionSignatureHash;
    to: string;
    data: `0x${string}`;
  }): Array<HumanDescriptionFragment> {
    const template = this._getTemplate(args.functionSignatureHash);
    return template.parse(args.to, args.data);
  }

  private _getTemplate(
    functionSignature: FunctionSignatureHash,
  ): HumanDescriptionTemplate {
    const template = this.templates[functionSignature];
    if (!template)
      throw Error(`No template for function signature ${functionSignature}`);
    return template;
  }
}
