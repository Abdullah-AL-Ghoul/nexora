import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { createOrder } from '../lib/api';
import {
  ShieldCheck,
  CreditCard,
  Truck,
  Lock,
  ArrowRight,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    appliedCoupon,
    getCartSubtotal,
    getCartDiscount,
    getCartTax,
    clearCart,
    navigate,
    addToast,
    currentUser,
  } = useStore();
  const { t, language } = useTranslation();

  // Address inputs
  const [fullName, setFullName] = useState(currentUser.name || 'Alexander Hayes');
  const [email, setEmail] = useState(currentUser.email || 'customer@nexora.com');
  const [street, setStreet] = useState('742 Evergreen Terrace, Suite 400');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('San Francisco');
  const [state, setState] = useState('CA');
  const [postalCode, setPostalCode] = useState('94107');
  const [country, setCountry] = useState('United States');

  // Shipping Method
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'priority'>('standard');

  // Stripe Test Card details
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#171A1F] border border-[#242831] flex items-center justify-center mx-auto text-[#9CA3AF]">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="font-serif-luxury text-2xl font-bold text-[#F5F5F5]">{t.cart.emptyTitle}</h2>
        <p className="text-xs text-[#9CA3AF]">
          {t.cart.emptySubtitle}
        </p>
        <button
          onClick={() => navigate('shop')}
          className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] font-semibold text-xs uppercase cursor-pointer"
        >
          {t.cart.exploreArtifacts}
        </button>
      </div>
    );
  }

  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  const baseShipping = subtotal - discount >= 200 ? 0 : 25;
  const shippingFee = shippingMethod === 'priority' ? baseShipping + 35 : baseShipping;
  const tax = getCartTax();
  const grandTotal = Math.max(0, subtotal - discount + shippingFee + tax);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);

    // Form validation
    if (!fullName || !street || !city || !state || !postalCode) {
      setErrorMessage(language === 'ar' ? 'يرجى إكمال جميع حقول عنوان الشحن المطلوبة.' : 'Please complete all required shipping address fields.');
      setIsProcessing(false);
      return;
    }

    // Server-side atomic checkout (createOrder posts to /api/orders;
    // the server owns stock/order validation and reads the applied coupon).
    try {
      const order = await createOrder({
        items: cart.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        shippingAddress: {
          fullName,
          street: apartment ? `${street}, ${apartment}` : street,
          city,
          state,
          postalCode,
          country,
        },
        couponCode: appliedCoupon?.code,
        paymentMethod: `Stripe Test Card (${cardNumber.slice(-9)})`,
      });

      clearCart();
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم تأكيد الطلب بنجاح' : 'Order Confirmed',
        message: language === 'ar'
          ? `تم تسجيل طلبك رقم ${order.orderNumber} في السجل الرسمي بنجاح.`
          : `Order ${order.orderNumber} successfully processed via Stripe Test Mode.`,
      });
      navigate('order-success', { orderId: order.id });
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (language === 'ar' ? 'فشل معالجة الطلب. يرجى مراجعة المخزون.' : 'Failed to process order. Please check inventory.');
      setErrorMessage(msg);
      addToast({
        type: 'error',
        title: language === 'ar' ? 'فشل معالجة الطلب' : 'Order Failed',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-[#242831] pb-6 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
            {t.checkout.title}
          </span>
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#F5F5F5] mt-1">
            {t.checkout.subtitle}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <Lock className="w-4 h-4 text-[#C9A961]" />
          <span>256-Bit TLS · Stripe Sandbox</span>
        </div>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Forms (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. Shipping Address */}
          <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5]">
              <div className="w-6 h-6 rounded-full bg-[#C9A961] text-[#0F1113] text-xs font-bold flex items-center justify-center">
                1
              </div>
              <span>{t.checkout.shippingHeader}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.fullName}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.street}</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">{language === 'ar' ? 'رقم الشقة / الجناح (اختياري)' : 'Apartment, Suite (Optional)'}</label>
                <input
                  type="text"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.city}</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.state}</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.postalCode}</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>
            </div>
          </div>

          {/* 2. Shipping Carrier Selection */}
          <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5]">
              <div className="w-6 h-6 rounded-full bg-[#C9A961] text-[#0F1113] text-xs font-bold flex items-center justify-center">
                2
              </div>
              <span>{t.checkout.shippingMethod}</span>
            </div>

            <div className="space-y-3">
              <label
                onClick={() => setShippingMethod('standard')}
                className={`flex items-center justify-between p-4 rounded-lg border text-xs cursor-pointer transition-colors ${
                  shippingMethod === 'standard'
                    ? 'border-[#C9A961] bg-[#C9A961]/10'
                    : 'border-[#242831] bg-[#121418]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-[#C9A961]" />
                  <div>
                    <div className="font-semibold text-[#F5F5F5]">{t.checkout.methodStandard}</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {language === 'ar' ? '3–5 أيام عمل · تغليف فاخر مؤمن' : '3–5 Business Days · Vault Packaging'}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-[#F5F5F5]">
                  {baseShipping === 0 ? (language === 'ar' ? 'مجاني' : 'FREE') : `$${baseShipping}`}
                </div>
              </label>

              <label
                onClick={() => setShippingMethod('priority')}
                className={`flex items-center justify-between p-4 rounded-lg border text-xs cursor-pointer transition-colors ${
                  shippingMethod === 'priority'
                    ? 'border-[#C9A961] bg-[#C9A961]/10'
                    : 'border-[#242831] bg-[#121418]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#C9A961]" />
                  <div>
                    <div className="font-semibold text-[#F5F5F5]">{t.checkout.methodExpress}</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {language === 'ar' ? 'تسليم سريع في اليوم التالي · تسليم مباشر باليد' : 'Next-Day Priority Delivery · Direct Handover'}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-[#F5F5F5]">
                  ${baseShipping + 35}
                </div>
              </label>
            </div>
          </div>

          {/* 3. Stripe Payment (Test Mode) */}
          <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F5]">
                <div className="w-6 h-6 rounded-full bg-[#C9A961] text-[#0F1113] text-xs font-bold flex items-center justify-center">
                  3
                </div>
                <span>{t.checkout.paymentHeader}</span>
              </div>
              <div className="px-2 py-0.5 bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/30 rounded text-[10px] font-mono uppercase tracking-wider">
                {language === 'ar' ? 'وضع تجريبي' : 'Test Mode'}
              </div>
            </div>

            <p className="text-xs text-[#9CA3AF]">
              {t.checkout.testNotice}
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[#9CA3AF] block mb-1">{t.checkout.cardNumber}</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-[#C9A961] absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] pl-9 pr-3.5 rtl:pl-3.5 rtl:pr-9 py-2.5 rounded font-mono outline-none focus:border-[#C9A961]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#9CA3AF] block mb-1">{t.checkout.cardExpiry}</label>
                  <input
                    type="text"
                    value={cardExp}
                    onChange={(e) => setCardExp(e.target.value)}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded font-mono outline-none focus:border-[#C9A961]"
                  />
                </div>
                <div>
                  <label className="text-[#9CA3AF] block mb-1">{t.checkout.cardCvc}</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded font-mono outline-none focus:border-[#C9A961]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-6 sticky top-28">
            <h3 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider border-b border-[#242831] pb-3">
              {t.checkout.orderSummary} ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h3>

            {/* Items List Preview */}
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1 divide-y divide-[#242831]/50 text-xs">
              {cart.map((item) => (
                <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-3">
                  <img
                    src={item.product.images[0]?.url}
                    alt={item.product.name}
                    className="w-12 h-12 rounded object-cover border border-[#242831] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-[#F5F5F5] truncate">{item.product.name}</h5>
                    <div className="text-[11px] text-[#9CA3AF] flex items-center gap-2">
                      <span>{language === 'ar' ? `الكمية: ${item.quantity}` : `Qty: ${item.quantity}`}</span>
                      {item.variant && <span>· {item.variant.name}</span>}
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-[#F5F5F5] shrink-0">
                    ${(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-[#242831] pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-[#9CA3AF]">
                <span>{t.cart.subtotal}</span>
                <span className="font-mono text-[#F5F5F5]">${subtotal.toLocaleString()}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-[#C9A961]">
                  <span>{t.cart.discount} ({appliedCoupon?.code})</span>
                  <span className="font-mono">-${discount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-[#9CA3AF]">
                <span>{t.cart.shipping}</span>
                <span className="font-mono text-[#F5F5F5]">
                  {shippingFee === 0 ? t.cart.complimentary : `$${shippingFee}`}
                </span>
              </div>

              <div className="flex justify-between text-[#9CA3AF]">
                <span>{t.cart.tax}</span>
                <span className="font-mono text-[#F5F5F5]">${tax.toFixed(2)}</span>
              </div>

              <div className="pt-3 border-t border-[#242831] flex justify-between text-base font-bold text-[#F5F5F5]">
                <span>{t.cart.total}</span>
                <span className="font-mono text-[#C9A961]">${grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-500/50 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Place Order CTA */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 rounded-md bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 shadow-xl shadow-[#C9A961]/15 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <span>{t.checkout.processing}</span>
              ) : (
                <>
                  <span>{t.checkout.placeOrder} (${grandTotal.toLocaleString()})</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-[#9CA3AF]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A961]" />
              <span>{language === 'ar' ? 'سجل مدفوعات معتمد ومؤمن بالكامل' : 'Full-Stack Atomic Ledger Fulfillment Active'}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
