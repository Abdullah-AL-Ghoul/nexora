import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { loginAccount, registerAccount } from '../lib/api';
import { SealSvg } from '../components/brand/Logo';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface ServerSession {
  token: string;
  user: { id: string; email: string; name: string; role: string; phone?: string | null; avatar?: string | null; createdAt?: string };
}

export const LoginPage: React.FC = () => {
  const { setCurrentUser, navigate, addToast } = useStore();
  const { t, language } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applySession = (session: ServerSession) => {
    setCurrentUser({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as 'CUSTOMER' | 'MANAGER' | 'ADMIN',
      phone: session.user.phone ?? undefined,
      avatar: session.user.avatar ?? undefined,
      createdAt: session.user.createdAt ?? new Date().toISOString(),
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      let session: ServerSession;
      if (isSignUp) {
        session = await registerAccount(fullName.trim() || email, email, password);
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء الحساب بنجاح' : 'Account Created',
          message: language === 'ar'
            ? `مرحباً بك في نكسورا، ${fullName.trim() || email}.`
            : `Welcome to NEXORA, ${fullName.trim() || email}.`,
        });
      } else {
        session = await loginAccount(email, password);
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Authentication Successful',
          message: language === 'ar' ? `تم الدخول باسم ${session.user.name}.` : `Signed in as ${session.user.name}.`,
        });
      }
      applySession(session);
      navigate(session.user.role === 'ADMIN' ? 'admin-dashboard' : 'home');
    } catch (err: any) {
      setErrorMessage(
        language === 'ar'
          ? 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.'
          : err?.message || 'Authentication failed. Please verify credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordHint = isSignUp
    ? (language === 'ar' ? '8 أحرف على الأقل' : '8+ characters required')
    : '';

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-ink">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center cursor-pointer" onClick={() => navigate('home')}>
            <SealSvg size={64} title="NEXORA heritage seal" />
          </div>
          <div>
            <h2 className="font-serif-luxury text-2xl font-bold tracking-[0.2em] text-fg">NEXORA</h2>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.34em] text-fg-faint font-mono">
              {language === 'ar' ? 'أتلييه جنيف' : 'Atelier · Genève'}
            </p>
          </div>
          <h1 className="font-serif-luxury text-xl font-semibold text-fg">
            {isSignUp ? t.login.registerTitle : t.login.signInTitle}
          </h1>
          <p className="text-xs text-fg-muted">
            {isSignUp ? t.login.registerSubtitle : t.login.signInSubtitle}
          </p>
        </div>

        {/* Auth Box */}
        <div className="p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-6">
          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4 text-xs">
            {isSignUp && (
              <div>
                <label className="text-fg-muted block mb-1.5 font-medium">{t.login.fullName}</label>
                <div className="relative">
                  <User className="w-4 h-4 text-fg-muted absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={language === 'ar' ? '' : 'Your full name'}
                    required={isSignUp}
                    className="w-full bg-raised border border-line text-fg px-10 py-3 rounded-lg outline-none focus:border-gold"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-fg-muted block mb-1.5 font-medium">{t.login.email}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-fg-muted absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-raised border border-line text-fg px-10 py-3 rounded-lg outline-none focus:border-gold"
                />
              </div>
            </div>

            <div>
              <label className="text-fg-muted block mb-1.5 font-medium">{t.login.password}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-fg-muted absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={isSignUp ? 8 : undefined}
                  className="w-full bg-raised border border-line text-fg px-10 py-3 rounded-lg outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-3.5 text-fg-muted hover:text-fg"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordHint && (
                <p className="mt-1 text-[11px] text-fg-faint">{passwordHint}</p>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/40 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-gold text-ink hover:bg-gold-soft font-semibold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 shadow-xl shadow-gold/15 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isSignUp ? t.login.registerBtn : t.login.signInBtn}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          {/* Toggle between Sign in & Register */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage(null);
              }}
              className="text-xs text-fg-muted hover:text-gold transition-colors cursor-pointer"
            >
              {isSignUp ? t.login.alreadyHaveAccount : t.login.newCollector}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-fg-muted flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-gold" />
          <span>
            {language === 'ar'
              ? 'حسابك الشخصي يمنحك الوصول إلى سجل طلباتك والمقتنيات المفضلة. الوصول إلى لوحة التحكم مخصص للمسؤولين فقط.'
              : 'Your atelier account keeps your orders and wishlist. Management console access is reserved for administrators only.'}
          </span>
        </p>
      </div>
    </div>
  );
};
