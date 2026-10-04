import React from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { db } from '../lib/db';
import {
  CheckCircle2,
  Truck,
  ArrowRight,
} from 'lucide-react';

export const OrderSuccessPage: React.FC = () => {
  const { routeParams, navigate } = useStore();
  const { language } = useTranslation();
  const orderId = routeParams.orderId;
  const order = db.getOrderById(orderId || '');

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif-luxury text-2xl font-bold text-[#F5F5F5]">
          {language === 'ar' ? 'لم يتم العثور على مرجع الطلب' : 'Order Reference Not Found'}
        </h2>
        <button
          onClick={() => navigate('shop')}
          className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] font-semibold text-xs uppercase cursor-pointer"
        >
          {language === 'ar' ? 'العودة إلى التشكيلة' : 'Return to Collection'}
        </button>
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
