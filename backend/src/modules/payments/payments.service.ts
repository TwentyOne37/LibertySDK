import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentIntentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPaymentIntentDto: CreatePaymentIntentDto) {
    return this.prisma.paymentIntent.create({
      data: {
        merchantId: createPaymentIntentDto.merchantId,
        amount: createPaymentIntentDto.amount,
        currency: createPaymentIntentDto.currency,
        payoutAsset: createPaymentIntentDto.payoutAsset,
        payoutChain: createPaymentIntentDto.payoutChain,
        mode: createPaymentIntentDto.mode,
        status: PaymentIntentStatus.CREATED,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.paymentIntent.findUnique({
      where: { id },
      include: {
        merchant: true,
      },
    });
  }
}

