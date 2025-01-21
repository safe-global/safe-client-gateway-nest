import { Injectable } from '@nestjs/common';
import { IWalletsRepository } from '@/domain/users/wallets/wallets.repository.interface';

@Injectable()
export class WalletsRepository implements IWalletsRepository {}
