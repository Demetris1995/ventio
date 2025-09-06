import { LanguageCode, PaymentMethodHandler } from '@vendure/core';

/**
 * Minimal "manual" payment handler for dev/testing.
 * - Step 1: createPayment -> returns Authorized
 * - Step 2: settlePayment -> returns success, transitions to Settled
 */
export const ManualPaymentHandler = new PaymentMethodHandler({
  code: 'manual',
  description: [{ languageCode: LanguageCode.en, value: 'Manual payment (dev)' }],
  args: {},

  async createPayment(ctx, order, amount, _args, metadata) {
    return {
      amount,
      state: 'Authorized',                 // required, then settlePayment will be called
      transactionId: (metadata as any)?.txId ?? 'manual-auth',
      metadata,
    };
  },

  async settlePayment(ctx, order, payment, _args) {
    // In dev we always succeed immediately
    return { success: true, metadata: { settledAt: new Date().toISOString() } };
  },
});
