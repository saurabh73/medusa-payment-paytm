import { EntityManager } from 'typeorm';
import {
  AbstractPaymentService,
  Cart,
  Data,
  OrderService,
  Payment,
  PaymentSession,
  PaymentSessionData,
  PaymentSessionStatus
} from '@medusajs/medusa';
import * as Paytm from 'paytm-pg-node-sdk';
import { NativePaymentStatusResponseBody, SDKResponse } from 'paytm-pg-node-sdk';
import { humanizeAmount, MedusaError, zeroDecimalCurrencies } from 'medusa-core-utils';
import axios from 'axios';
import * as PaytmChecksum from 'paytmchecksum';
import { randomUUID } from 'crypto';

export interface PaytmPaymentPluginOptions {
  merchant_id: string;
  merchant_key: string;
  test_mode?: boolean;
  callback_url?: string;
}

// Util Functions
function roundToTwo(num, currency) {
  if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
    return `${num}`;
  }
  return num.toFixed(2);
}

function isEmpty(obj: Record<string, any>): boolean {
  for (const _key in obj) {
    return false;
  }
  return true;
}

class PaytmProviderService extends AbstractPaymentService {
  static identifier = 'paytm';
  private orderService_: OrderService;
  private options_: PaytmPaymentPluginOptions;

  protected manager_: EntityManager;
  protected transactionManager_: EntityManager;

  constructor({ orderService, regionService, manager }, options: PaytmPaymentPluginOptions) {
    super({ orderService, regionService, manager }, options as unknown as Record<string, unknown>);

    this.orderService_ = orderService;
    this.manager_ = manager;

    // Set Propertes from options
    this.options_ = options;
    const env: string = options.test_mode
      ? Paytm.LibraryConstants.STAGING_ENVIRONMENT
      : Paytm.LibraryConstants.PRODUCTION_ENVIRONMENT;
    const website: string = options.test_mode ? 'WEBSTAGING' : 'DEFAULT';
    const mid: string = options.merchant_id;
    const key: string = options.merchant_key;

    /** Initialize mandatory Parameters */
    Paytm.MerchantProperties.initialize(env, mid, key, website);
    if (options.callback_url) {
      Paytm.MerchantProperties.setCallbackUrl(options.callback_url);
    }
  }

  private getTxnAmount(cart: Cart): string {
    const { region, total } = cart;
    const { currency_code } = region;
    const amountValue = roundToTwo(humanizeAmount(total, currency_code), currency_code);
    return amountValue;
  }

  getOptions(): PaytmPaymentPluginOptions {
    return this.options_;
  }

  /**
   * Retrieves a Paytm order.
   * @param {PaymentData} paymentData
   * @return {Promise<Data>} Paytm order
   */
  async retrievePayment(paymentData: Data): Promise<Data> {
    const id = paymentData.id as string; // order id
    const paymentStatusDetail = new Paytm.PaymentStatusDetailBuilder(id).build();
    return Paytm.Payment.getPaymentStatus(paymentStatusDetail);
  }

  /**
   * Gets the payment data from a payment session
   * @param {PaymentSessionData} paymentData - the session to fetch payment data for.
   * @return {Promise<Data> } the Paytm order object
   */
  async getPaymentData(paymentSession: PaymentSession): Promise<Data> {
    return await this.retrievePayment(paymentSession.data);
  }

  /**
   * Get payment session status
   * @param {PaymentSessionData} paymentData - the data stored with the payment session
   * @return {Promise<PaymentSessionStatus>} the status of the order
   */
  async getStatus(data: PaymentSessionData): Promise<PaymentSessionStatus> {
    const response = (await this.retrievePayment(data)) as any as NativePaymentStatusResponseBody;
    let status;
    if (!response) {
      status = PaymentSessionStatus.PENDING;
    }
    // Check for Payment Status
    switch (response.getResultInfo().resultStatus) {
      case Paytm.LibraryConstants.TXN_SUCCESS_STATUS:
        status = PaymentSessionStatus.AUTHORIZED;
        break;
      case 'TXN_FAILURE':
        status = PaymentSessionStatus.ERROR;
        break;
      default:
        status = PaymentSessionStatus.PENDING;
    }
    return status;
  }

  /**
   * Not supported
   */
  async retrieveSavedMethods(customer) {
    return Promise.resolve([]);
  }

  /**
   *
   * @param cart
   */
  async createPayment(cart: Cart): Promise<Data> {
    const { customer_id, customer, region, id, total } = cart;
    const { currency_code } = region;
    try {
      // Logged In customer
      if (customer) {
        // Basic Customer Info
        const customerInfo = new Paytm.UserInfo(customer_id);
        customerInfo.setEmail(cart.email || customer.email);
        customerInfo.setFirstName(customer.first_name);
        customerInfo.setLastName(customer.last_name);
        customerInfo.setMobile(customer.phone);

        // Total Amount
        const currency = Paytm.EnumCurrency.getEnumByCurrency(currency_code.toUpperCase());
        const txnAmount = Paytm.Money.constructWithCurrencyAndValue(currency, this.getTxnAmount(cart));

        // Build Payment
        const paymentDetailBuilder = new Paytm.PaymentDetailBuilder(Paytm.EChannelId.WEB, id, txnAmount, customerInfo);
        const paymentDetail = paymentDetailBuilder.build();

        // Create Paytm Payment Transaction
        const response: Paytm.SDKResponse = await Paytm.Payment.createTxnToken(paymentDetail);
        return response.getResponseObject().body;
      } else {
        throw new MedusaError('paytm-plugin', 'Logged In Customer Needed to create Payment Session');
      }
    } catch (e) {
      Paytm.LoggingUtil.addLog(Paytm.LoggingUtil.LogLevel.ERROR, 'Exception Caught: Cart ID: {} Error: {}}', id, e);
      return Promise.reject(e);
    }
  }

  /**
   *
   * @param paymentSessionData
   * @param cart
   */
  async updatePayment(paymentSessionData: Data, cart: Cart): Promise<Data> {
    const txnToken = paymentSessionData.txnToken;
    let response;
    // call create payment if not set
    if (!txnToken) {
      response = await this.createPayment(cart);
    } else {
      const txnAmount = this.getTxnAmount(cart);
      const paymentStatus = (await this.retrievePayment(paymentSessionData)) as any as NativePaymentStatusResponseBody;
      // If no update to Txn Amount
      const { extendInfo } = cart.metadata ?? {};
      if (paymentStatus.getTxnAmount() === txnAmount && (!extendInfo || isEmpty(extendInfo))) {
        // convert Payment Status object to Data
        response = paymentStatus as any as Data;
      } else {
        // Update with new Txn Amount/Extend Info
        const cart_id = cart.id;
        const currency_code = cart.region?.currency_code;
        response = await this.updatePaymentData(paymentSessionData, {
          txnToken,
          cart_id,
          txnAmount,
          currency_code,
          extendInfo
        });
      }
    }
    return paymentSessionData;
  }

  /**
   * Method
   * @param paymentSessionData
   * @param data
   * @returns
   */
  async updatePaymentData(paymentSessionData: Data, data: Data): Promise<Data> {
    // This API updates txnAmount and extendInfo in order details
    const { txnToken, cart_id, txnAmount, currency_code, extendInfo } = data ?? {};
    if (txnToken && cart_id) {
      // URL
      const baseUrl = new URL(Paytm.MerchantProperties.getPaymentStatusUrl());
      const updateTxnUrl = `https://${baseUrl.hostname}/theia/api/v1/updateTransactionDetail`;
      const body: any = {};
      if (txnAmount && currency_code) {
        const currency = Paytm.EnumCurrency.getEnumByCurrency(currency_code as string);
        const amount = Paytm.Money.constructWithCurrencyAndValue(currency, data.txnAmount as string);
        body.txnAmount = amount;
      }
      if (extendInfo) {
        body.extendInfo = extendInfo;
      }
      const signature = await PaytmChecksum.generateSignature(
        JSON.stringify(body),
        Paytm.MerchantProperties.getMerchantKey()
      );
      // Update TXN
      await axios.post<SDKResponse>(
        updateTxnUrl,
        {
          body: body,
          head: {
            txnToken: txnToken,
            signature: signature
          }
        },
        {
          params: {
            mid: Paytm.MerchantProperties.getMid(),
            orderId: cart_id
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    // No Upate to paymentSessionData
    return paymentSessionData;
  }

  /**
   * Authorizes Paytm payment intent by simply returning the status for the payment intent in use.
   * @param {PaymentSession} paymentSession - payment session data
   * @param {Data} context - properties relevant to current context
   * @return {Promise<{ data: PaymentSessionData; status: PaymentSessionStatus }>} result with data and status
   */
  async authorizePayment(
    paymentSession: PaymentSession,
    context: Data
  ): Promise<{ data: Data; status: PaymentSessionStatus }> {
    const stat = await this.getStatus(paymentSession.data);
    const response = { data: paymentSession.data, status: stat };
    return response;
  }

  /**
   *
   * @param payment
   */
  async capturePayment(payment: Payment): Promise<Data> {
    // Fetch Status and Mark Order as Captured if status is AUTHORIZED
    const paymentStatus = await this.getStatus(payment.data);
    if (paymentStatus === PaymentSessionStatus.AUTHORIZED) {
      const order = await this.orderService_.retrieveByCartId(payment.cart_id).catch(() => undefined);
      if (order && order.payment_status !== 'captured') {
        await this.orderService_.capturePayment(order.id);
      }
    }
    return payment.data;
  }

  /**
   * Cancels payment for paytm payment.
   * @param payment {Payment} payment
   * @return {Promise<PaymentData>} canceled payment intent
   */
  async cancelPayment(payment: Payment): Promise<Data> {
    // Cancel payment is not supported, initate refund with full amount
    return await this.refundPayment(payment, payment.amount);
  }

  /**
   *
   * @param payment
   * @param refundAmount
   */
  async refundPayment(payment: Payment, refundAmount: number): Promise<Data> {
    const paymentStatus = (await this.retrievePayment(payment.data)) as any as NativePaymentStatusResponseBody;
    const orderId: string = payment.cart_id;
    const txnId: string = paymentStatus?.getTxnId();
    /** REF ID returned in Paytm\pg\process\Refund call */
    const refId: string = randomUUID();
    const txnType = 'REFUND';
    const refundTotal: string = roundToTwo(Math.min(payment.amount, refundAmount), payment.currency_code);
    /** Paytm\pg\process\Refund object will have all the information required to make refund call */
    const refundBuilder: Paytm.RefundDetailBuilder = new Paytm.RefundDetailBuilder(
      orderId,
      refId,
      txnId,
      txnType,
      refundTotal
    );
    const refundDetail = refundBuilder.build();
    try {
      const response: SDKResponse = await Paytm.Refund.initiateRefund(refundDetail);
      return response.getResponseObject();
    } catch (e) {
      Paytm.LoggingUtil.addLog(Paytm.LoggingUtil.LogLevel.ERROR, 'Exception caught: ', e);
      return Promise.reject(e);
    }
  }

  /**
   * Delete Payment Not suported {@link https://business.paytm.com/docs/}
   */
  async deletePayment(paymentSession: PaymentSession): Promise<void> {
    // NOT supported
  }
}

export default PaytmProviderService;
