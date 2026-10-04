import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase app singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Sync user document in Firestore
    const userRef = doc(firestore, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    let role: 'CUSTOMER' | 'MANAGER' | 'ADMIN' = 'CUSTOMER';
    // Admin designation for primary email if applicable
    if (user.email === 'ynab2025@gmail.com' || user.email?.includes('admin')) {
      role = 'ADMIN';
    }

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Distinguished Collector',
        photoURL: user.photoURL || '',
        role,
        createdAt: new Date().toISOString(),
      });
    } else {
      role = userSnap.data()?.role || role;
    }

    return { user, role };
  } catch (error) {
    console.error('Google Sign-in failed', error);
    throw error;
  }
}

export async function signOutUser() {
  await firebaseSignOut(auth);
}

/**
 * Ensures a valid Firebase user UID exists, either from current auth or anonymous sign-in.
 */
export async function ensureAuthenticatedUserId(): Promise<string> {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  try {
    const anon = await signInAnonymously(auth);
    return anon.user.uid;
  } catch {
    return 'user_customer_01';
  }
}

/**
 * Saves wishlist items to the user's document in Firestore.
 */
export async function syncWishlistToFirestore(
  userId: string,
  wishlistItems: { productId: string; addedAt: string }[]
) {
  try {
    const userRef = doc(firestore, 'users', userId);
    await setDoc(
      userRef,
      {
        uid: userId,
        wishlist: wishlistItems.map((item) => item.productId),
        wishlistDetails: wishlistItems,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Failed to sync wishlist to Firestore:', error);
  }
}

/**
 * Loads wishlist items from Firestore.
 */
export async function loadWishlistFromFirestore(userId: string): Promise<string[] | null> {
  try {
    const userRef = doc(firestore, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.wishlist)) {
        return data.wishlist;
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to load wishlist from Firestore:', error);
    return null;
  }
}

export { onAuthStateChanged };
export type { FirebaseUser };
