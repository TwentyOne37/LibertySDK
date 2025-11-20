import { IsString } from 'class-validator';

export class ConfirmEvmTxDto {
  @IsString()
  txHash: string;
}

