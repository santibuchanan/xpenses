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
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useAccountData(accountIds, selectedAccountId, authUser, userProfile) {
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

    // FIX PROBLEMA RAÍZ: seed inmediato con el usuario actual.
    // members[] nunca queda vacío mientras Firestore carga —
    // el usuario actual está disponible sincrónicamente desde authUser.
    const seedMember = authUser ? {
      uid:   authUser.uid,
      name:  userProfile?.name || authUser.displayName || "Vos",
      color: userProfile?.color || "#4F7FFA",
      _seed: true, // marcador temporal, se sobreescribe cuando llega el snap real
    } : null;

    setMembers(seedMember ? [seedMember] : []);

    const ids = [...account.memberIds];
    const unsubs = ids.map(uid =>
      onSnapshot(doc(db, "users", uid), snap => {
        if (snap.exists()) {
          setMembers(prev => [
            // Reemplaza el seed o cualquier entrada previa del mismo uid
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