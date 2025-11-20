import { IsString, IsEnum, IsNotEmpty, IsDecimal, Matches } from 'class-validator';

export enum PaymentIntentMode {
  CHEAPEST = 'CHEAPEST',
  PRIVACY = 'PRIVACY',
  MANUAL = 'MANUAL',
}

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsDecimal({ decimal_digits: '0,18' }, { message: 'Amount must be a valid decimal string' })
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  payoutAsset: string;

  @IsString()
  @IsNotEmpty()
  payoutChain: string;

  @IsEnum(PaymentIntentMode)
  mode: PaymentIntentMode;
}

