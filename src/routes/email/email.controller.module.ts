import { Module } from '@nestjs/common';
import { AccountDomainModule } from '@/domain/account/account.domain.module';
import { EmailController } from '@/routes/email/email.controller';
import { EmailService } from '@/routes/email/email.service';

@Module({
  imports: [AccountDomainModule],
  providers: [EmailService],
  controllers: [EmailController],
})
export class EmailControllerModule {}
