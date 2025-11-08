import { useEffect, useState } from 'react';
import { onSnapshot, query, orderBy, collection } from 'firebase/firestore';

export const useFirestoreCollection = ({ firestore, path, orderByField = 'createdAt', orderDirection = 'desc', enabled }) => {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !firestore || !path) {
      return undefined;
    }

    setIsLoading(true);
    const collectionRef = collection(firestore, path);
    const snapshotQuery = query(collectionRef, orderBy(orderByField, orderDirection));

    const unsubscribe = onSnapshot(
      snapshotQuery,
      (snapshot) => {
        setDocuments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled, firestore, orderByField, orderDirection, path]);

  return {
    documents,
    isLoading,
    error,
  };
};
