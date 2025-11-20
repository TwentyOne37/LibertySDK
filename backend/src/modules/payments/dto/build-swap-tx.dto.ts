import { IsInt, IsString, IsNumber } from 'class-validator';

export class BuildSwapTxDto {
  @IsInt()
  chainId: number;

  @IsString()
  fromTokenAddress: string;

  @IsString()
  userAddress: string;

  @IsNumber()
  slippageBps: number;
}

