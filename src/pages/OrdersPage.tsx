import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { fetchOrders } from '../lib/api';
import { Order, OrderItem, Address } from '../types';
import { Package, Truck, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

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

export const OrdersPage: React.FC = () => {
  const { navigate } = useStore();
  const { t, language } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOrders = () => {
    setLoading(true);
    setLoadError(null);
    fetchOrders()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setOrders(list.map(mapOrder));
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : 'Unable to load orders');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchOrders()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setOrders(list.map(mapOrder));
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Unable to load orders');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const getLocalizedStatus = (status: string) => {
    if (language !== 'ar') return status;
    switch (status) {
      case 'DELIVERED':
        return 'تم التسليم';
      case 'SHIPPED':
        return 'في الطريق والشحن';
      case 'PROCESSING':
        return 'قيد التجهيز';
      default:
        return 'قيد المعالجة';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="border-b border-[#242831] pb-6 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
            {language === 'ar' ? 'سجل المقتنيات الرسمي' : 'Registry Portfolio'}
          </span>
          <h1 className="font-serif-luxury text-3xl font-bold text-[#F5F5F5] mt-1">
            {t.orders.title}
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            {t.orders.subtitle}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#C9A961] bg-[#171A1F] border border-[#242831] px-3 py-1.5 rounded">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{orders.length} {language === 'ar' ? 'طلبات مسجلة' : 'Commissions'}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A961]" />
        </div>
      ) : loadError ? (
        <div className="p-12 text-center rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
          <Package className="w-12 h-12 text-[#9CA3AF] mx-auto opacity-50" />
          <h3 className="text-base font-semibold text-[#F5F5F5]">{t.orders.title}</h3>
          <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
            {loadError}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={loadOrders}
              className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
            </button>
            <button
              onClick={() => navigate('shop')}
              className="px-6 py-2.5 rounded bg-[#171A1F] border border-[#242831] hover:border-[#C9A961] text-[#F5F5F5] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {t.home.exploreFullCatalog}
            </button>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
          <Package className="w-12 h-12 text-[#9CA3AF] mx-auto opacity-50" />
          <h3 className="text-base font-semibold text-[#F5F5F5]">{t.orders.noOrdersTitle}</h3>
          <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto">
            {t.orders.noOrdersSubtitle}
          </p>
          <button
            onClick={() => navigate('shop')}
            className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {t.home.exploreFullCatalog}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-6"
            >
              {/* Top metadata */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#242831] pb-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-[#C9A961]">
                    {order.orderNumber}
                  </span>
                  <span className="text-[#9CA3AF]">
                    {new Date(order.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase font-semibold ${
                      order.status === 'DELIVERED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : order.status === 'SHIPPED'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/30'
                    }`}
                  >
                    {getLocalizedStatus(order.status)}
                  </span>

                  <span className="font-mono text-sm font-bold text-[#F5F5F5]">
                    ${order.total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-[#242831]/50 text-xs">
                {order.items.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-14 h-14 rounded object-cover border border-[#242831]"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[#F5F5F5]">{item.productName}</h4>
                      {item.variantName && (
                        <div className="text-[11px] text-[#C9A961]">{item.variantName}</div>
                      )}
                      <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                        {language === 'ar' ? `الكمية: ${item.quantity} · الرمز: ${item.sku}` : `Qty: ${item.quantity} · SKU: ${item.sku}`}
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-[#F5F5F5]">
                      ${item.totalPrice.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom Shipping & Tracking info */}
              <div className="pt-4 border-t border-[#242831] flex flex-wrap items-center justify-between gap-4 text-xs text-[#9CA3AF]">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#C9A961]" />
                  <span>
                    {language === 'ar' ? 'الشحن المباشر:' : 'Carrier:'} {order.shippingCarrier || 'FedEx Luxury'} · {language === 'ar' ? 'رقم التتبع:' : 'Tracking:'}{' '}
                    <strong className="text-[#F5F5F5] font-mono">{order.trackingNumber}</strong>
                  </span>
                </div>

                <button
                  onClick={() => navigate('order-success', { orderId: order.id })}
                  className="text-xs text-[#C9A961] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>{language === 'ar' ? 'عرض الإيصال الكامل والشهادة' : 'View Full Receipt & Dossier'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
