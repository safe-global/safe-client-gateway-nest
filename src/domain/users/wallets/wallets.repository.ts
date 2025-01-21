import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '@/datasources/users/entities/wallets.entity.db';
import { IWalletsRepository } from '@/domain/users/wallets/wallets.repository.interface';

@Injectable()
export class WalletsRepository implements IWalletsRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}
}
