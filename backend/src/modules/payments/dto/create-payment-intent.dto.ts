import { IsString, IsEnum, IsNotEmpty } from 'class-validator';

export enum PaymentIntentMode {
  CHEAPEST = 'CHEAPEST',
  PRIVACY = 'PRIVACY',
  MANUAL = 'MANUAL',
}

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
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

