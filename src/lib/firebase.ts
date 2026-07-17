import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Silencia logs internos do Firestore (como avisos de desconexão de streams gRPC inativos)
setLogLevel('error');

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();
// Request Google Calendar scopes and profile info
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

// Force account selection to ensure fresh token & permission prompt
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  console.log('initAuth called');
  return onAuthStateChanged(auth, async (user: User | null) => {
    console.log('onAuthStateChanged called, user:', user ? 'present' : 'null');
    
    // Attempt to recover token from localStorage if missing in memory
    if (user && !cachedAccessToken) {
      const savedToken = localStorage.getItem('google_access_token');
      const timestampStr = localStorage.getItem('google_token_timestamp');
      if (savedToken && timestampStr) {
        const timestamp = Number(timestampStr);
        const isExpired = Date.now() - timestamp > 55 * 60 * 1000; // 55 minutes
        if (!isExpired) {
          cachedAccessToken = savedToken;
          console.log('Token recovered from localStorage');
        }
      }
    }

    if (user) {
      if (cachedAccessToken) {
        console.log('User present, token cached');
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        console.log('User present, no token, not signing in');
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      console.log('No user present');
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    localStorage.setItem('google_token_timestamp', String(Date.now()));
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_timestamp');
};
export type { User };
