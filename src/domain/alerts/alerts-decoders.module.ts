import { Module } from '@nestjs/common';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';

@Module({
  providers: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
  exports: [DelayModifierDecoder, MultiSendDecoder, SafeDecoder],
})
export class AlertsDecodersModule {}
