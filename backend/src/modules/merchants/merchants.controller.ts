import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { MerchantsService } from './merchants.service';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const merchant = await this.merchantsService.findOne(id);
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }
    return merchant;
  }
}

