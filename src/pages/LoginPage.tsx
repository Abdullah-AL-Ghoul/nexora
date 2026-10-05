import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { fetchCurrentUser } from '../lib/api';
import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

type PersonaRole = 'CUSTOMER' | 'MANAGER' | 'ADMIN';

interface ServerUser {
  role: PersonaRole;
  name: string;
}

export const LoginPage: React.FC = () => {
  const { switchRole, navigate, addToast } = useStore();
  const { t, language } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Role is decided SERVER-SIDE only. After auth success we ask the server for
  // the canonical role (it upserts the Firebase user from the Bearer token).
  const resolveServerUser = async (): Promise<ServerUser | null> => {
    try {
      const u = await fetchCurrentUser();
      const role = u.role as PersonaRole;
      switchRole(role);
      return { role, name: u.name };
    } catch {
      // Server authorization unavailable — keep the guest customer persona.
      switchRole('CUSTOMER');
      addToast({
        type: 'info',
        title: language === 'ar' ? 'جلسة ضيف' : 'Guest Session',
        message: language === 'ar'
          ? 'تم الدخول كضيف — تعذّر التحقق من الصلاحيات عبر الخادم.'
          : 'Browsing as guest — server authorization unavailable.',
      });
      return null;
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
        // Create account with Firebase Auth
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          if (fullName) {
            await updateProfile(cred.user, { displayName: fullName });
          }
        } catch (firebaseErr: any) {
          console.warn('Firebase Auth fallback:', firebaseErr);
        }

        const serverUser = await resolveServerUser();
        if (serverUser) {
          addToast({
            type: 'success',
            title: language === 'ar' ? 'تم إنشاء الحساب بنجاح' : 'Account Created',
            message: language === 'ar' ? `مرحباً بك في نكسورا، ${fullName || email}.` : `Welcome to NEXORA, ${fullName || email}.`,
          });
        }
        navigate('home');
      } else {
        // Sign In with Firebase Auth
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (firebaseErr: any) {
          console.warn('Firebase Auth sign in fallback:', firebaseErr);
        }

        const serverUser = await resolveServerUser();
        if (serverUser) {
          addToast({
            type: 'success',
            title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Authentication Successful',
            message: language === 'ar' ? `تم الدخول باسم ${serverUser.name}.` : `Signed in as ${serverUser.name}.`,
          });
        }
        if (serverUser?.role === 'ADMIN' || serverUser?.role === 'MANAGER') {
          navigate('admin-dashboard');
        } else {
          navigate('home');
        }
      }
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const serverUser = await resolveServerUser();
      if (serverUser) {
        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم الدخول عبر Google' : 'Authenticated with Google',
          message: language === 'ar' ? `أهلاً بك، ${user.displayName || user.email}.` : `Welcome, ${user.displayName || user.email}.`,
        });
      }
      if (serverUser?.role === 'ADMIN' || serverUser?.role === 'MANAGER') {
        navigate('admin-dashboard');
      } else {
        navigate('home');
      }
    } catch (err: any) {
      setErrorMessage(
        language === 'ar'
          ? 'تم إلغاء تسجيل الدخول عبر Google أو غير متوفر حالياً.'
          : err?.message || 'Google Sign-In was cancelled or unavailable.'
      );
    } finally {
      setLoading(false);
    }
  };

  const personas: { role: PersonaRole; label: string }[] = [
    { role: 'CUSTOMER', label: language === 'ar' ? 'عميل' : 'Customer' },
    { role: 'MANAGER', label: language === 'ar' ? 'مدير' : 'Manager' },
    { role: 'ADMIN', label: language === 'ar' ? 'مسؤول' : 'Admin' },
  ];

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-ink">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 cursor-pointer" onClick={() => navigate('home')}>
            <span className="font-serif-luxury text-3xl font-bold tracking-[0.2em] text-fg">
              NEXORA
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          </div>
          <h2 className="font-serif-luxury text-xl font-semibold text-fg">
            {isSignUp ? t.login.registerTitle : t.login.signInTitle}
          </h2>
          <p className="text-xs text-fg-muted">
            {isSignUp ? t.login.registerSubtitle : t.login.signInSubtitle}
          </p>
        </div>

        {/* Auth Box */}
        <div className="p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-6">
          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-raised hover:bg-elevated border border-line hover:border-gold text-fg font-semibold text-xs tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{t.login.googleSignIn}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[11px] font-mono text-fg-muted uppercase">{t.login.orWithEmail}</span>
            <div className="flex-1 h-px bg-line" />
          </div>

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
                    placeholder="Julian Vance"
                    required
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
                  placeholder="admin@nexora.com"
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
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-danger/40 text-xs text-rose-300 flex items-start gap-2">
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

          {/* Toggle between Sign in & Sign up */}
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

        {/* Demo Persona Selector (local-only preview role, real privileges come from the server) */}
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold shrink-0" />
            <h3 className="font-serif-luxury text-sm font-semibold text-fg">
              {language === 'ar' ? 'دخول تجريبي' : 'Demo Access'}
            </h3>
          </div>
          <p className="text-[11px] text-fg-muted leading-relaxed">
            {language === 'ar'
              ? 'جرّب واجهة مختلفة (مدير / مسؤول) مباشرة دون الحاجة إلى تسجيل الدخول.'
              : 'Preview the Manager or Admin experience instantly, no sign-in required.'}
          </p>
          <div className="flex gap-2">
            {personas.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => switchRole(p.role)}
                disabled={loading}
                className="flex-1 py-2.5 px-3 rounded-lg bg-raised hover:bg-elevated border border-line hover:border-gold text-fg hover:text-fg font-semibold text-[11px] tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-fg-muted flex items-start gap-1.5 leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-fg-muted" />
            <span>
              {language === 'ar'
                ? 'الدور التجريبي محلي فقط — تتطلب إجراءات الكتابة (المسؤول/المدير) تفويضاً حقيقياً من الخادم.'
                : 'Demo persona is local only — admin/manager write actions require real server authorization.'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
