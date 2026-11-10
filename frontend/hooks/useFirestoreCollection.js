import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, orderBy, collection } from 'firebase/firestore';

export const useFirestoreCollection = ({ firestore, path, orderByField = 'createdAt', orderDirection = 'desc', enabled }) => {
  const source = useMemo(() => ({}), [enabled, firestore, orderByField, orderDirection, path]);
  const activeSource = Boolean(enabled && firestore && path);
  const [state, setState] = useState({ source: null, documents: [], isLoading: false, error: null });

  useEffect(() => {
    setState({ source, documents: [], isLoading: activeSource, error: null });
    if (!activeSource) return undefined;

    let active = true;
    let unsubscribe;
    try {
      const collectionRef = collection(firestore, path);
      const snapshotQuery = query(collectionRef, orderBy(orderByField, orderDirection));
      unsubscribe = onSnapshot(
        snapshotQuery,
        (snapshot) => {
          if (!active) return;
          setState({ source, documents: snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })), isLoading: false, error: null });
        },
        (error) => {
          if (!active) return;
          setState({ source, documents: [], isLoading: false, error });
        },
      );
    } catch (error) {
      setState({ source, documents: [], isLoading: false, error });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [activeSource, firestore, orderByField, orderDirection, path, source]);

  // Do not expose the previous collection while the new effect is pending.
  if (!activeSource || state.source !== source) {
    return { documents: [], isLoading: activeSource, error: null };
  }
  return { documents: state.documents, isLoading: state.isLoading, error: state.error };
};
