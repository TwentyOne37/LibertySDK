import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { QuoteEvmDto } from './dto/quote-evm.dto';
import { BuildSwapTxDto } from './dto/build-swap-tx.dto';
import { ConfirmEvmTxDto } from './dto/confirm-evm-tx.dto';

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

  @Post(':id/quote-evm')
  async quoteEvm(@Param('id') id: string, @Body() dto: QuoteEvmDto) {
    return this.paymentsService.quoteEvm(id, dto);
  }

  @Post(':id/evm-swap-tx')
  async buildEvmSwapTx(@Param('id') id: string, @Body() dto: BuildSwapTxDto) {
    return this.paymentsService.buildEvmSwapTx(id, dto);
  }

  @Post(':id/evm-tx-confirm')
  async confirmEvmTx(@Param('id') id: string, @Body() dto: ConfirmEvmTxDto) {
    return this.paymentsService.confirmEvmTx(id, dto);
  }
}
