/**
 * hooks/useAccountData.js
 * Maneja userAccounts, account seleccionada y members.
 * Extraído de App.jsx para separar responsabilidades.
 */

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useAccountData(accountIds, selectedAccountId) {
  const [userAccounts, setUserAccounts] = useState([]);
  const [account,      setAccount]      = useState(null);
  const [members,      setMembers]      = useState([]);

  // Listeners de accounts — uno por cada accountId del usuario
  useEffect(() => {
    if (!accountIds.length) {
      setUserAccounts([]);
      return;
    }
    const unsubs = accountIds.map(id =>
      onSnapshot(doc(db, "accounts", id), snap => {
        if (snap.exists()) {
          setUserAccounts(prev => {
            const filtered = prev.filter(a => a.id !== id);
            return [...filtered, { id: snap.id, ...snap.data() }];
          });
        } else {
          // La cuenta fue eliminada — quitarla de la lista
          setUserAccounts(prev => prev.filter(a => a.id !== id));
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }, [accountIds]);

  // Resolver account activa desde userAccounts
  useEffect(() => {
    if (!selectedAccountId) {
      setAccount(null);
      setMembers([]);
      return;
    }
    if (!userAccounts.length) return;

    const acc = userAccounts.find(a => a.id === selectedAccountId);
    if (acc) {
      setAccount(acc);
      // Sincronizar fontSize al account
      const fs = acc.fontSize || "medium";
      localStorage.setItem("expenseFontSize", fs);
      window.dispatchEvent(new CustomEvent("expenseFontSizeChange", { detail: fs }));
    }
  }, [selectedAccountId, userAccounts]);

  // Listeners de members — uno por cada memberIds del account activo
  useEffect(() => {
    if (!account?.memberIds) {
      setMembers([]);
      return;
    }
    const ids = [...account.memberIds];
    const unsubs = ids.map(uid =>
      onSnapshot(doc(db, "users", uid), snap => {
        if (snap.exists()) {
          setMembers(prev => [
            ...prev.filter(m => m.uid !== uid),
            { uid, ...snap.data() },
          ]);
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }, [account?.memberIds?.join(",")]);

  return { userAccounts, account, members };
}