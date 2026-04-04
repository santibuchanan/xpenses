/**
 * hooks/useAccountData.js
 * Maneja userAccounts, account seleccionada y members.
 * Extraído de App.jsx para separar responsabilidades.
 *
 * FIX PROBLEMA RAÍZ B2/B7:
 * members[] se seedea inmediatamente con el usuario actual (authUser)
 * antes de que arranquen los listeners de Firestore. Esto elimina la
 * ventana de tiempo en la que allMembers llegaba vacío a AddExpenseModal
 * y EditExpenseModal, causando que las secciones "Pagó" y "Para quién"
 * no se renderizaran en cuentas nuevas.
 *
 * El seed usa authUser + userProfile para tener nombre y color reales
 * desde el primer render. Cuando el onSnapshot resuelve, el miembro
 * real reemplaza el seed con los datos completos de Firestore.
 */

import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export function useAccountData(accountIds, selectedAccountId, authUser, userProfile) {
  const [userAccounts, setUserAccounts] = useState([]);
  const [account,      setAccount]      = useState(null);
  const [members,      setMembers]      = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountOrder,    setAccountOrder]    = useState(null);

  // Si userProfile ya cargó y accountIds sigue vacío, el usuario no tiene cuentas.
  // Separado del efecto principal para no re-crear listeners cuando cambia userProfile.
  useEffect(() => {
    if (accountIds.length === 0 && userProfile !== null) {
      setAccountsLoading(false);
    }
  }, [accountIds, userProfile]);

  // Listener para accountOrder en users/{uid}
  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", authUser.uid), snap => {
      if (snap.exists()) {
        setAccountOrder(snap.data().accountOrder ?? null);
      }
    });
    return () => unsub();
  }, [authUser?.uid]);

  // Listeners de accounts — uno por cada accountId del usuario
  useEffect(() => {
    if (!accountIds.length) {
      setUserAccounts([]);
      return;
    }
    // Marcar loading hasta que todos los listeners hayan respondido al menos una vez
    setAccountsLoading(true);
    const resolved = new Set();
    const unsubs = accountIds.map(id =>
      onSnapshot(doc(db, "accounts", id), snap => {
        if (snap.exists()) {
          setUserAccounts(prev => {
            const filtered = prev.filter(a => a.id !== id);
            return [...filtered, { id: snap.id, ...snap.data() }];
          });
        } else {
          setUserAccounts(prev => prev.filter(a => a.id !== id));
        }
        // Marcar este id como resuelto
        resolved.add(id);
        if (resolved.size === accountIds.length) setAccountsLoading(false);
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
      // Sincronizar fontSize solo si la cuenta tiene uno explícito
      // No sobreescribir la preferencia del usuario si la cuenta no tiene fontSize
      if (acc.fontSize) {
        localStorage.setItem("expenseFontSize", acc.fontSize);
        window.dispatchEvent(new CustomEvent("expenseFontSizeChange", { detail: acc.fontSize }));
      }
    }
  }, [selectedAccountId, userAccounts]);

  // Listeners de members — uno por cada memberIds del account activo
  useEffect(() => {
    if (!account?.memberIds) {
      setMembers([]);
      return;
    }

    setMembers([]);

    const ids = [...account.memberIds];
    const unsubs = ids.map(uid =>
      onSnapshot(doc(db, "users", uid), snap => {
        setMembers(prev => [
          // Reemplaza el seed o cualquier entrada previa del mismo uid
          ...prev.filter(m => m.uid !== uid),
          snap.exists()
            ? { uid, ...snap.data() }
            : { uid, name: "Usuario desconocido", color: "#999" },
        ]);
      })
    );
    return () => unsubs.forEach(u => u());
  }, [[...(account?.memberIds || [])].sort().join(",")]);

  const saveAccountOrder = async (orderedIds) => {
    if (!authUser?.uid) return;
    await updateDoc(doc(db, "users", authUser.uid), { accountOrder: orderedIds });
  };

  return { userAccounts, account, members, accountsLoading, accountOrder, saveAccountOrder };
}