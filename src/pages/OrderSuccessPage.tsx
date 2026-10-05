import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { fetchOrderById } from '../lib/api';
import { Order, OrderItem, Address } from '../types';
import {
  CheckCircle2,
  Truck,
  ArrowRight,
  Loader2,
} from 'lucide-react';

// Map server-side snake_case order payloads to the camelCase Order shape the JSX expects.
const mapOrderItem = (raw: any): OrderItem => {
  const unitPrice = Number(raw.unit_price ?? raw.unitPrice ?? 0);
  const quantity = Number(raw.quantity ?? 0);
  return {
    id: raw.id ?? '',
    orderId: raw.order_id ?? raw.orderId ?? '',
    productId: raw.product_id ?? raw.productId ?? '',
    productName: raw.product_name ?? raw.productName ?? '',
    productImage: raw.product_image ?? raw.productImage ?? '',
    sku: raw.sku ?? '',
    variantName: raw.variant_name ?? raw.variantName,
    unitPrice,
    quantity,
    totalPrice: Number(raw.total_price ?? raw.totalPrice ?? unitPrice * quantity),
  };
};

const parseShippingAddress = (raw: any): Address => {
  let parsed: any = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (parsed && typeof parsed === 'object') {
    return {
      id: parsed.id ?? '',
      userId: parsed.user_id ?? parsed.userId ?? '',
      fullName: parsed.full_name ?? parsed.fullName ?? '',
      street: parsed.street ?? '',
      apartment: parsed.apartment,
      city: parsed.city ?? '',
      state: parsed.state ?? '',
      postalCode: parsed.postal_code ?? parsed.postalCode ?? '',
      country: parsed.country ?? '',
      isDefault: true,
    };
  }
  return {
    id: '', userId: '', fullName: '', street: '', city: '', state: '', postalCode: '', country: '', isDefault: true,
  };
};

const mapOrder = (raw: any): Order => ({
  id: raw.id ?? '',
  orderNumber: raw.order_number ?? raw.orderNumber ?? '',
  userId: raw.user_id ?? raw.userId ?? '',
  customerName: raw.customer_name ?? raw.customerName ?? '',
  customerEmail: raw.customer_email ?? raw.customerEmail ?? '',
  items: Array.isArray(raw.items) ? raw.items.map(mapOrderItem) : [],
  subtotal: Number(raw.subtotal ?? 0),
  discount: Number(raw.discount ?? 0),
  shipping: Number(raw.shipping ?? 0),
  tax: Number(raw.tax ?? 0),
  total: Number(raw.total ?? raw.total_price ?? 0),
  status: raw.status ?? 'PROCESSING',
  paymentStatus: raw.payment_status ?? raw.paymentStatus ?? 'PENDING',
  paymentMethod: raw.payment_method ?? raw.paymentMethod ?? 'Stripe Test Card (•••• 4242)',
  stripePaymentIntentId: raw.stripe_payment_intent_id ?? raw.stripePaymentIntentId,
  shippingAddress: parseShippingAddress(raw.shipping_address ?? raw.shippingAddress),
  trackingNumber: raw.tracking_number ?? raw.trackingNumber,
  shippingCarrier: raw.shipping_carrier ?? raw.shippingCarrier,
  notes: raw.notes,
  createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  updatedAt: raw.updated_at ?? raw.updatedAt ?? raw.created_at ?? new Date().toISOString(),
});

export const OrderSuccessPage: React.FC = () => {
  const { navigate } = useStore();
  const { language } = useTranslation();
  // Read orderId from the URL directly (react-router); fall back to the store
  // routeParams only if the param is absent (legacy deep-link path).
  const urlOrderId = useParams<{ orderId: string }>().orderId;
  const storeOrderId = useStore((s) => s.routeParams.orderId);
  const orderId = urlOrderId || storeOrderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setOrder(null);

    if (!orderId) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    fetchOrderById(orderId)
      .then((data) => {
        if (!cancelled) setOrder(mapOrder(data));
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Unable to load order');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A961]" />
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif-luxury text-2xl font-bold text-[#F5F5F5]">
          {language === 'ar' ? 'لم يتم العثور على مرجع الطلب' : 'Order Reference Not Found'}
        </h2>
        {loadError && (
          <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">{loadError}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              if (orderId) {
                setLoading(true);
                setLoadError(null);
                setOrder(null);
                fetchOrderById(orderId)
                  .then((data) => setOrder(mapOrder(data)))
                  .catch((e) => setLoadError(e instanceof Error ? e.message : 'Unable to load order'))
                  .finally(() => setLoading(false));
              }
            }}
            className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] font-semibold text-xs uppercase cursor-pointer"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
          </button>
          <button
            onClick={() => navigate('orders')}
            className="px-6 py-2.5 rounded bg-[#171A1F] border border-[#242831] text-[#F5F5F5] font-semibold text-xs uppercase cursor-pointer"
          >
            {language === 'ar' ? 'عرض سجل طلباتي الكامل' : 'View My Order History'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Confirmation Banner */}
      <div className="text-center space-y-3 pb-8 border-b border-[#242831]">
        <div className="w-16 h-16 rounded-full bg-[#C9A961]/10 border border-[#C9A961] flex items-center justify-center mx-auto text-[#C9A961]">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#C9A961]">
          {language === 'ar' ? 'تم تأكيد الدفع بنجاح · تحديث السجل الرسمي' : 'Payment Confirmed · Atomic Ledger Updated'}
        </span>
        <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
          {language === 'ar' ? 'تهانينا، تم تأكيد عملية الاقتناء' : 'Commission Acquired'}
        </h1>
        <p className="text-xs text-[#9CA3AF] max-w-md mx-auto leading-relaxed">
          {language === 'ar'
            ? `تم تسجيل طلبك رسمياً وتخصيص القطع. تم إرسال الإيصال وشهادة المنشأ إلى `
            : `Your order has been recorded into the master registry. An encrypted receipt and certificate of authenticity have been dispatched to `}
          <strong className="text-[#F5F5F5]">{order.customerEmail}</strong>.
        </p>
      </div>

      {/* Order Identification Box */}
      <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
        <div>
          <span className="text-[#9CA3AF] block mb-1">{language === 'ar' ? 'رقم الطلب' : 'Order Reference'}</span>
          <span className="font-mono text-sm font-bold text-[#C9A961]">{order.orderNumber}</span>
        </div>
        <div>
          <span className="text-[#9CA3AF] block mb-1">{language === 'ar' ? 'تاريخ التسجيل' : 'Date Committed'}</span>
          <span className="text-sm font-medium text-[#F5F5F5]">
            {new Date(order.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
          </span>
        </div>
        <div>
          <span className="text-[#9CA3AF] block mb-1">{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</span>
          <span className="text-sm font-medium text-[#F5F5F5]">{order.paymentMethod}</span>
        </div>
        <div>
          <span className="text-[#9CA3AF] block mb-1">{language === 'ar' ? 'المبلغ المعتمد' : 'Total Authorized'}</span>
          <span className="font-mono text-sm font-bold text-[#F5F5F5]">
            ${order.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Simulated Tracking Timeline */}
      <div className="p-6 sm:p-8 rounded-xl bg-[#121418] border border-[#242831] space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#C9A961]" />
            <h3 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
              {language === 'ar' ? 'حالة الشحن والتسليم المباشر' : 'Transit & Vault Courier Status'}
            </h3>
          </div>
          <span className="text-xs font-mono text-[#C9A961]">
            {language === 'ar' ? 'رقم التتبع:' : 'Tracking:'} {order.trackingNumber}
          </span>
        </div>

        {/* 4-step progress line */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#C9A961] text-[#0F1113] font-bold flex items-center justify-center mx-auto text-xs">
              ✓
            </div>
            <div className="font-semibold text-[#F5F5F5]">{language === 'ar' ? 'تم الدفع بنجاح' : 'Payment Succeeded'}</div>
            <div className="text-[10px] text-[#9CA3AF]">{language === 'ar' ? 'معتمد عبر Stripe' : 'Stripe Verified'}</div>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#C9A961] text-[#0F1113] font-bold flex items-center justify-center mx-auto text-xs">
              ✓
            </div>
            <div className="font-semibold text-[#F5F5F5]">{language === 'ar' ? 'سجل في النظام' : 'Ledger Recorded'}</div>
            <div className="text-[10px] text-[#9CA3AF]">{language === 'ar' ? 'تخصيص المخزون' : 'Inventory Allocated'}</div>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#242831] text-[#C9A961] border border-[#C9A961] font-bold flex items-center justify-center mx-auto text-xs">
              3
            </div>
            <div className="font-semibold text-[#C9A961]">{language === 'ar' ? 'تجهيز الشحن الفاخر' : 'White-Glove Packing'}</div>
            <div className="text-[10px] text-[#9CA3AF]">{language === 'ar' ? 'فحص الجودة' : 'In Inspection'}</div>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#171A1F] border border-[#242831] text-[#9CA3AF] flex items-center justify-center mx-auto text-xs">
              4
            </div>
            <div className="font-semibold text-[#9CA3AF]">{language === 'ar' ? 'تسليم باليد' : 'Courier Handover'}</div>
            <div className="text-[10px] text-[#9CA3AF]">{language === 'ar' ? 'توقيع المستلم' : 'Signature Required'}</div>
          </div>
        </div>
      </div>

      {/* Items in this Order */}
      <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
        <h3 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
          {language === 'ar' ? 'القطع المقتناة في هذا الطلب' : 'Acquired Artifacts'}
        </h3>

        <div className="divide-y divide-[#242831] text-xs">
          {order.items.map((item) => (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
              <img
                src={item.productImage}
                alt={item.productName}
                className="w-16 h-16 rounded object-cover border border-[#242831]"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-[#F5F5F5] text-sm">{item.productName}</h4>
                <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                  {language === 'ar' ? `الكمية: ${item.quantity}` : `Qty: ${item.quantity}`}
                  {item.variantName && ` · ${item.variantName}`}
                </div>
              </div>
              <div className="font-mono text-sm font-semibold text-[#F5F5F5]">
                ${item.totalPrice.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
        <button
          onClick={() => navigate('orders')}
          className="px-6 py-3 rounded bg-[#171A1F] border border-[#242831] hover:border-[#C9A961] text-[#F5F5F5] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
        >
          {language === 'ar' ? 'عرض سجل طلباتي الكامل' : 'View My Order History'}
        </button>

        <button
          onClick={() => navigate('shop')}
          className="px-6 py-3 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>{language === 'ar' ? 'متابعة التصفح في التشكيلة' : 'Continue Exploring Collection'}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
