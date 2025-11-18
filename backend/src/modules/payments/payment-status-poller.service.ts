import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NearIntentsClient } from '../../integrations/near-intents.client';
import { PaymentIntentStatus } from '@prisma/client';

/**
 * Maps NEAR Intents status to our internal PaymentIntentStatus
 */
function mapIntentsStatusToPaymentStatus(
  intentsStatus: string,
): PaymentIntentStatus {
  const statusUpper = intentsStatus.toUpperCase();
  
  switch (statusUpper) {
    case 'PENDING_DEPOSIT':
      return 'AWAITING_DEPOSIT';
    case 'PROCESSING':
      return 'SWAPPING';
    case 'SUCCESS':
      return 'COMPLETED';
    case 'FAILED':
    case 'INCOMPLETE_DEPOSIT':
      return 'FAILED';
    default:
      // Default to current status or AWAITING_DEPOSIT if unknown
      return 'AWAITING_DEPOSIT';
  }
}

@Injectable()
export class PaymentStatusPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentStatusPollerService.name);
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 15000; // 15 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly nearIntentsClient: NearIntentsClient,
  ) {}

  onModuleInit() {
    this.logger.log('Starting payment status poller...');
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.logger.log('Stopped payment status poller');
    }
  }

  private startPolling() {
    // Poll immediately on start
    this.pollStatuses();

    // Then poll every interval
    this.pollingInterval = setInterval(() => {
      this.pollStatuses();
    }, this.POLL_INTERVAL_MS);
  }

  private async pollStatuses() {
    try {
      // Find all payment intents that need polling
      const paymentIntents = await this.prisma.paymentIntent.findMany({
        where: {
          provider: 'intents',
          status: {
            in: ['AWAITING_DEPOSIT', 'SWAPPING'],
          },
          intentsDepositAddress: {
            not: null,
          },
        },
      });

      this.logger.debug(`Polling ${paymentIntents.length} payment intents`);

      for (const intent of paymentIntents) {
        if (!intent.intentsDepositAddress) {
          continue;
        }

        try {
          const statusResponse = await this.nearIntentsClient.getStatus(
            intent.intentsDepositAddress,
          );

          const newStatus = mapIntentsStatusToPaymentStatus(
            statusResponse.status,
          );

          // Only update if status changed
          if (newStatus !== intent.status) {
            await this.prisma.paymentIntent.update({
              where: { id: intent.id },
              data: {
                status: newStatus,
                intentsStatus: statusResponse.status,
                // Store txHash if available
                providerMetadata: statusResponse.txHash
                  ? {
                      ...((intent.providerMetadata as any) || {}),
                      txHash: statusResponse.txHash,
                    }
                  : intent.providerMetadata,
              },
            });

            this.logger.log(
              `Updated payment intent ${intent.id} from ${intent.status} to ${newStatus}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to poll status for payment intent ${intent.id}: ${error.message}`,
          );
          // Continue with other intents
        }
      }
    } catch (error) {
      this.logger.error(`Error in payment status poller: ${error.message}`);
    }
  }
}

