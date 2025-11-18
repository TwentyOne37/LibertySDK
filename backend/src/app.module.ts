import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, MerchantsModule, PaymentsModule],
})
export class AppModule {}

