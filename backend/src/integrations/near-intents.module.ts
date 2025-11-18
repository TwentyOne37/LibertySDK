import { Module } from '@nestjs/common';
import { NearIntentsClient } from './near-intents.client';

@Module({
  providers: [NearIntentsClient],
  exports: [NearIntentsClient],
})
export class NearIntentsModule {}

