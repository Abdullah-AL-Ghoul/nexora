import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import { X, Trash2, Plus, Minus, Tag, ShieldCheck, ArrowRight, ShoppingBag } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    couponError,
    getCartSubtotal,
    getCartDiscount,
    getCartShipping,
    getCartTax,
    getCartTotal,
    navigate,
  } = useStore();
  const { t, language } = useTranslation();

  const [couponCodeInput, setCouponCodeInput] = useState('');

  if (!isOpen) return null;

  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  const shipping = getCartShipping();
  const tax = getCartTax();
  const total = getCartTotal();

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCodeInput.trim()) {
      applyCoupon(couponCodeInput.trim());
      setCouponCodeInput('');
    }
  };

  const handleCheckoutClick = () => {
    onClose();
    navigate('checkout');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 rtl:right-auto rtl:left-0 max-w-full flex pl-10 rtl:pl-0 rtl:pr-10">
        <div className="w-screen max-w-md bg-[#171A1F] border-l rtl:border-l-0 rtl:border-r border-[#242831] shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-6 border-b border-[#242831] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#C9A961]" />
              <h2 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider">
                {t.cart.title} ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
              aria-label="Close bag"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#242831]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#121418] border border-[#242831] flex items-center justify-center text-[#9CA3AF]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#F5F5F5]">{t.cart.emptyTitle}</h3>
                  <p className="text-xs text-[#9CA3AF] mt-1 max-w-xs">
                    {t.cart.emptySubtitle}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    navigate('shop');
                  }}
                  className="px-5 py-2.5 rounded-md bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                >
                  {t.cart.exploreArtifacts}
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  <img
                    src={item.product.images[0]?.url}
                    alt={item.product.name}
                    className="w-20 h-20 rounded object-cover bg-[#121418] border border-[#242831] shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          onClick={() => {
                            onClose();
                            navigate('product', { slug: item.product.slug });
                          }}
                          className="text-xs font-medium text-[#F5F5F5] hover:text-[#C9A961] cursor-pointer transition-colors line-clamp-1"
                        >
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-[#9CA3AF] hover:text-rose-400 transition-colors p-1 cursor-pointer"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.variant && (
                        <p className="text-[11px] text-[#C9A961] mt-0.5">
                          {item.variant.name}
                        </p>
                      )}

                      <div className="text-xs font-semibold text-[#F5F5F5] mt-1">
                        ${item.price.toLocaleString()}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-[#242831] rounded bg-[#121418]">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1.5 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-medium text-[#F5F5F5]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-1.5 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-mono font-semibold text-[#F5F5F5]">
                        ${(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer with Calculations */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-[#242831] bg-[#121418] space-y-4">
              {/* Coupon Form */}
              <div className="space-y-1.5">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded bg-[#171A1F] border border-[#C9A961]/40 text-xs">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-[#C9A961]" />
                      <span className="font-mono font-semibold text-[#C9A961]">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-[#9CA3AF]">
                        (-${discount.toLocaleString()})
                      </span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-[#9CA3AF] hover:text-[#F5F5F5] text-[11px] underline cursor-pointer"
                    >
                      {t.cart.remove}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value)}
                      placeholder={t.cart.couponPlaceholder}
                      className="flex-1 bg-[#171A1F] border border-[#242831] text-xs text-[#F5F5F5] px-3 py-2 rounded outline-none focus:border-[#C9A961] uppercase placeholder:normal-case placeholder:text-gray-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-[#242831] hover:bg-[#C9A961] hover:text-[#0F1113] text-[#F5F5F5] text-xs font-semibold rounded transition-colors cursor-pointer"
                    >
                      {t.cart.apply}
                    </button>
                  </form>
                )}

                {couponError && (
                  <p className="text-[11px] text-rose-400">{couponError}</p>
                )}
              </div>

              {/* Summary Calculations */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>{t.cart.subtotal}</span>
                  <span className="font-mono text-[#F5F5F5]">${subtotal.toLocaleString()}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-[#C9A961]">
                    <span>{t.cart.discount}</span>
                    <span className="font-mono">-${discount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-[#9CA3AF]">
                  <span>{t.cart.shipping}</span>
                  <span className="font-mono text-[#F5F5F5]">
                    {shipping === 0 ? t.cart.complimentary : `$${shipping}`}
                  </span>
                </div>

                <div className="flex justify-between text-[#9CA3AF]">
                  <span>{t.cart.tax}</span>
                  <span className="font-mono text-[#F5F5F5]">${tax.toFixed(2)}</span>
                </div>

                <div className="pt-2 border-t border-[#242831] flex justify-between text-sm font-semibold text-[#F5F5F5]">
                  <span>{t.cart.total}</span>
                  <span className="font-mono text-[#C9A961]">${total.toLocaleString()}</span>
                </div>
              </div>

              {/* Checkout Action */}
              <button
                onClick={handleCheckoutClick}
                className="w-full py-3.5 px-4 rounded-md bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-xl shadow-[#C9A961]/10 transition-colors cursor-pointer"
              >
                <span>{t.cart.checkoutButton}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C9A961]" />
                <span>{language === 'ar' ? 'معاملة آمنة ومشفرة 256-Bit (وضع تجريبي)' : '256-Bit Encrypted Test Checkout'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
