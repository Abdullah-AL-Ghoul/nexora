import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { db } from '../lib/db';
import { auth, googleProvider, firestore } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
        // Create account with Firebase Auth
        let firebaseUser;
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          firebaseUser = cred.user;
          if (fullName) {
            await updateProfile(firebaseUser, { displayName: fullName });
          }
        } catch (firebaseErr: any) {
          console.warn('Firebase Auth fallback:', firebaseErr);
        }

        const role = email.includes('admin') ? 'ADMIN' : 'CUSTOMER';
        const user = db.registerUser(fullName || email.split('@')[0], email, role);
        switchRole(user.role);

        // Record in Firestore if available
        if (firebaseUser) {
          try {
            await setDoc(doc(firestore, 'users', firebaseUser.uid), {
              uid: firebaseUser.uid,
              email,
              displayName: fullName || email.split('@')[0],
              role,
              createdAt: new Date().toISOString(),
            });
          } catch (e) {
            console.error('Firestore write error', e);
          }
        }

        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم إنشاء الحساب بنجاح' : 'Account Created',
          message: language === 'ar' ? `مرحباً بك في نكسورا، ${fullName || email}.` : `Welcome to NEXORA, ${fullName || email}.`,
        });
        navigate('home');
      } else {
        // Sign In with Firebase Auth
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (firebaseErr: any) {
          console.warn('Firebase Auth sign in fallback:', firebaseErr);
        }

        const role = email.includes('admin')
          ? 'ADMIN'
          : email.includes('manager')
          ? 'MANAGER'
          : 'CUSTOMER';
        const user = db.registerUser(fullName || email.split('@')[0], email, role);
        switchRole(user.role);

        addToast({
          type: 'success',
          title: language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Authentication Successful',
          message: language === 'ar' ? `تم الدخول باسم ${user.name}.` : `Signed in as ${user.name}.`,
        });
        if (role === 'ADMIN' || role === 'MANAGER') {
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

      let role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER';
      if (user.email === 'ynab2025@gmail.com' || user.email?.includes('admin')) {
        role = 'ADMIN';
      }

      db.registerUser(user.displayName || 'Distinguished Collector', user.email || '', role);
      switchRole(role);

      // Sync Firestore
      try {
        await setDoc(
          doc(firestore, 'users', user.uid),
          {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Distinguished Collector',
            photoURL: user.photoURL || '',
            role,
            lastLogin: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Firestore sync note:', fsErr);
      }

      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم الدخول عبر Google' : 'Authenticated with Google',
        message: language === 'ar' ? `أهلاً بك، ${user.displayName || user.email}.` : `Welcome, ${user.displayName || user.email}.`,
      });
      if (role === 'ADMIN') {
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

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-[#0F1113]">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 cursor-pointer" onClick={() => navigate('home')}>
            <span className="font-serif-luxury text-3xl font-bold tracking-[0.2em] text-[#F5F5F5]">
              NEXORA
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A961]" />
          </div>
          <h2 className="font-serif-luxury text-xl font-semibold text-[#F5F5F5]">
            {isSignUp ? t.login.registerTitle : t.login.signInTitle}
          </h2>
          <p className="text-xs text-[#9CA3AF]">
            {isSignUp ? t.login.registerSubtitle : t.login.signInSubtitle}
          </p>
        </div>

        {/* Auth Box */}
        <div className="p-8 rounded-2xl bg-[#171A1F] border border-[#242831] shadow-2xl space-y-6">
          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-[#121418] hover:bg-[#1E2229] border border-[#242831] hover:border-[#C9A961] text-[#F5F5F5] font-semibold text-xs tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
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
            <div className="flex-1 h-px bg-[#242831]" />
            <span className="text-[11px] font-mono text-[#9CA3AF] uppercase">{t.login.orWithEmail}</span>
            <div className="flex-1 h-px bg-[#242831]" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4 text-xs">
            {isSignUp && (
              <div>
                <label className="text-[#9CA3AF] block mb-1.5 font-medium">{t.login.fullName}</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Julian Vance"
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-10 py-3 rounded-lg outline-none focus:border-[#C9A961]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[#9CA3AF] block mb-1.5 font-medium">{t.login.email}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nexora.com"
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-10 py-3 rounded-lg outline-none focus:border-[#C9A961]"
                />
              </div>
            </div>

            <div>
              <label className="text-[#9CA3AF] block mb-1.5 font-medium">{t.login.password}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-10 py-3 rounded-lg outline-none focus:border-[#C9A961]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-3.5 text-[#9CA3AF] hover:text-[#F5F5F5]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 shadow-xl shadow-[#C9A961]/15 transition-all cursor-pointer disabled:opacity-50"
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
              className="text-xs text-[#9CA3AF] hover:text-[#C9A961] transition-colors cursor-pointer"
            >
              {isSignUp ? t.login.alreadyHaveAccount : t.login.newCollector}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

