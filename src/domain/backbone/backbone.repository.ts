import { Inject, Injectable } from '@nestjs/common';
import { BackboneValidator } from '@/domain/backbone/backbone.validator';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IBackboneRepository } from '@/domain/backbone/backbone.repository.interface';

@Injectable()
export class BackboneRepository implements IBackboneRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: BackboneValidator,
  ) {}

  async getBackbone(chainId: string): Promise<Backbone> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const data = await api.getBackbone();
    return this.validator.validate(data);
  }
}
