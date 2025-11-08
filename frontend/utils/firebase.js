import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const getGlobalValue = (name, fallback = undefined) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  // eslint-disable-next-line no-undef
  return typeof window[name] !== 'undefined' ? window[name] : fallback;
};

const parseFirebaseConfig = () => {
  const rawConfig = getGlobalValue('__firebase_config', '{}');

  try {
    return JSON.parse(rawConfig);
  } catch (error) {
    console.error('Unable to parse Firebase configuration.', error);
    return {};
  }
};

let firebaseApp;

export const getOrInitializeFirebase = () => {
  if (!firebaseApp) {
    const config = parseFirebaseConfig();

    if (!config || !config.apiKey) {
      throw new Error('Firebase configuration is missing or incomplete.');
    }

    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      [firebaseApp] = getApps();
    }
  }

  return firebaseApp;
};

export const getFirebaseDependencies = () => {
  const app = getOrInitializeFirebase();
  return {
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
};

export const authenticateUser = async (authInstance) => {
  const providedToken = getGlobalValue('__initial_auth_token', null);

  if (providedToken) {
    await signInWithCustomToken(authInstance, providedToken);
    return;
  }

  await signInAnonymously(authInstance);
};

export const resolveAppId = () => {
  return getGlobalValue('__app_id', 'default-plant-tracker');
};
