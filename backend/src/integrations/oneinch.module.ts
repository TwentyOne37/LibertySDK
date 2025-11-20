import { Module } from '@nestjs/common';
import { OneInchClient } from './oneinch.client';

@Module({
  providers: [OneInchClient],
  exports: [OneInchClient],
})
export class OneInchModule {}

