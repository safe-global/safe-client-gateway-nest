import { Injectable } from '@nestjs/common';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { DELEGATE_OPERATION } from '@/domain/safe/entities/operation.entity';

@Injectable()
export class DataDecodedParamHelper {
  private readonly TRANSFER_METHOD = 'transfer';
  private readonly TRANSFER_FROM_METHOD = 'transferFrom';
  private readonly SAFE_TRANSFER_FROM_METHOD = 'safeTransferFrom';

  getFromParam(dataDecoded: DataDecoded | null, fallback: string): string {
    if (!dataDecoded || !dataDecoded.parameters) return fallback;

    switch (dataDecoded.method) {
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 0);
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_METHOD:
      default:
        return fallback;
    }
  }

  getToParam(dataDecoded: DataDecoded | null, fallback: string): string {
    if (!dataDecoded || !dataDecoded.parameters) return fallback;

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 0);
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 1);
        return typeof value === 'string' ? value : fallback;
      }
      default:
        return fallback;
    }
  }

  getValueParam(dataDecoded: DataDecoded | null, fallback: string): string {
    if (!dataDecoded || !dataDecoded.parameters) return fallback;

    switch (dataDecoded.method) {
      case this.TRANSFER_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 1);
        return typeof value === 'string' ? value : fallback;
      }
      case this.TRANSFER_FROM_METHOD:
      case this.SAFE_TRANSFER_FROM_METHOD: {
        const value = this.getValueAtPosition(dataDecoded, 2);
        return typeof value === 'string' ? value : fallback;
      }
      default:
        return fallback;
    }
  }

  getValueAtPosition(
    dataDecoded: DataDecoded | null,
    position: number,
  ): unknown {
    if (!dataDecoded || !dataDecoded.parameters?.length) return null;
    return dataDecoded.parameters[position]?.value ?? null;
  }

  hasNestedDelegate(dataDecoded: DataDecoded): boolean {
    if (!dataDecoded.parameters) return false;
    return dataDecoded.parameters.some(
      (param) =>
        Array.isArray(param.valueDecoded) &&
        param.valueDecoded.some(
          (innerParam) => innerParam?.operation === DELEGATE_OPERATION,
        ),
    );
  }
}
