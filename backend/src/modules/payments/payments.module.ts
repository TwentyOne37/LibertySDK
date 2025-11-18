import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentStatusPollerService } from './payment-status-poller.service';
import { NearIntentsModule } from '../../integrations/near-intents.module';

@Module({
  imports: [NearIntentsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentStatusPollerService],
})
export class PaymentsModule {}

