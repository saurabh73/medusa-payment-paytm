import { OrderService } from '@medusajs/medusa';
import { Request, Response } from 'express';
import PaytmProviderService from 'services/paytm-provider';
import * as PaytmChecksum from 'paytmchecksum';
import * as Paytm from 'paytm-pg-node-sdk';

// Handle Payment Webhook
export default async (req: Request, res: Response): Promise<void> => {
  const paymentProvider: PaytmProviderService = req.scope.resolve('pp_paytm');
  const { merchant_id, merchant_key } = paymentProvider.getOptions();
  const event = req.body as any;
  /* string we need to verify against checksum */
  const body = JSON.stringify({ mid: merchant_id, orderId: event.orderid });
  /* checksum that we need to verify */
  const checksumhash = event.checksumhash;
  const isVerifySignature = PaytmChecksum.verifySignature(body, merchant_key, checksumhash);
  // Work with Verified Signature
  if (isVerifySignature) {
    const orderService: OrderService = req.scope.resolve('orderService');
    const cartId = event.orderid;
    const order = await orderService.retrieveByCartId(cartId).catch(() => undefined);

    // Capture Successful Payments
    switch (event.status) {
      case Paytm.LibraryConstants.TXN_SUCCESS_STATUS:
        if (order && order.payment_status !== 'captured') {
          await orderService.capturePayment(order.id);
        }
        break;
    }
  }
  // Send Success Status to PG
  res.sendStatus(201);
};
