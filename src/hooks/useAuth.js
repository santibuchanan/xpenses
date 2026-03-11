/**
 * hooks/useAuth.js
 * Maneja auth state, userProfile y accountIds.
 * Extraído de App.jsx para separar responsabilidades.
 */

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

export function useAuth() {
  const [authUser,      setAuthUser]      = useState(undefined); // undefined = cargando
  const [userProfile,   setUserProfile]   = useState(null);
  const [accountIds,    setAccountIds]    = useState([]);
  const [initializing,  setInitializing]  = useState(true);

  // Listener de auth — limpia todo el estado al cambiar de usuario
  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setUserProfile(null);
      setAccountIds([]);
      setAuthUser(user || null);
      if (!user) {
        setInitializing(false);
      }
    });
  }, []);

  // Listener de perfil de usuario
  useEffect(() => {
    if (!authUser) return;
    return onSnapshot(doc(db, "users", authUser.uid), snap => {
      const data = snap.data();
      setUserProfile(data || null);
      // Soporte para accounts múltiples y legacy (accountId singular)
      setAccountIds(
        data?.accountIds ||
        (data?.accountId ? [data.accountId] : [authUser.uid])
      );
      setInitializing(false);
    });
  }, [authUser]);

  return { authUser, userProfile, accountIds, initializing };
}