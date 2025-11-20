import { IsInt, IsString, IsNumber, Min } from 'class-validator';

export class QuoteEvmDto {
  @IsInt()
  chainId: number;

  @IsString()
  fromTokenAddress: string;

  @IsInt()
  fromTokenDecimals: number;

  @IsString()
  amountDecimal: string;
}

