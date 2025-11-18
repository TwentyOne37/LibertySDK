import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('payment-intents')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    return this.paymentsService.create(createPaymentIntentDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const paymentIntent = await this.paymentsService.findOne(id);
    if (!paymentIntent) {
      throw new NotFoundException(`Payment intent with ID ${id} not found`);
    }
    return paymentIntent;
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.paymentsService.getStatus(id);
  }

  @Post(':id/quote-zec')
  async quoteZec(@Param('id') id: string) {
    return this.paymentsService.quoteZec(id);
  }
}

