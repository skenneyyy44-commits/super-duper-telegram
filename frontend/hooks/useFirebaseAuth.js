import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { authenticateUser, getFirebaseDependencies } from '../utils/firebase';

export const AUTH_STATUS = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  READY: 'READY',
  ERROR: 'ERROR',
};

export const useFirebaseAuth = () => {
  const [{ auth, firestore }, setFirebaseDeps] = useState({ auth: null, firestore: null });
  const [status, setStatus] = useState(AUTH_STATUS.IDLE);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const deps = getFirebaseDependencies();
      setFirebaseDeps(deps);
      setStatus(AUTH_STATUS.LOADING);

      const unsubscribe = onAuthStateChanged(deps.auth, async (authUser) => {
        if (authUser) {
          setUser(authUser);
          setStatus(AUTH_STATUS.READY);
          return;
        }

        try {
          await authenticateUser(deps.auth);
        } catch (authError) {
          setError(authError);
          setStatus(AUTH_STATUS.ERROR);
        }
      });

      return () => unsubscribe();
    } catch (initializationError) {
      setError(initializationError);
      setStatus(AUTH_STATUS.ERROR);
    }
  }, []);

  return {
    auth,
    firestore,
    status,
    user,
    error,
  };
};
