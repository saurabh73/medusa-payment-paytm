import { CartService, EventBusService } from '@medusajs/medusa';
import PaytmProviderService from 'services/paytm-provider';

class CartSubscriber {
  private paymentProviderService_: PaytmProviderService;
  private cartSevice_: CartService;

  constructor({
    eventBusService,
    cartService,
    paymentProviderService
  }: {
    eventBusService: EventBusService;
    cartService: CartService;
    paymentProviderService: PaytmProviderService;
  }) {
    this.cartSevice_ = cartService;
    this.paymentProviderService_ = paymentProviderService;
    eventBusService.subscribe('cart.customer_updated', this.handleCartUpdate);
  }

  handleCartUpdate = async (cart_id: string): Promise<void> => {
    const cart = await this.cartSevice_.retrieve(cart_id, {
      select: ['subtotal', 'tax_total', 'shipping_total', 'discount_total', 'total'],
      relations: [
        'items',
        'billing_address',
        'shipping_address',
        'region',
        'region.payment_providers',
        'payment_sessions',
        'customer'
      ]
    });
    if (cart.payment_sessions?.length) {
      // Find Paytm Payment Session
      const paymentSession = cart.payment_sessions.find((ps) => ps.provider_id === 'paytm').data;
      if (paymentSession) {
        this.paymentProviderService_.updatePayment(paymentSession, cart);
      }
    }
  };
}
export default CartSubscriber;
