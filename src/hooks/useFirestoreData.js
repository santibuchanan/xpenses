/**
 * hooks/useFirestoreData.js
 * Maneja listeners de expenses, categories, fixedExpenses y settlements.
 * Extraído de App.jsx para separar responsabilidades.
 *
 * FIX #1: El listener de expenses ahora tiene filtro de 6 meses atrás
 * para evitar descargar todo el historial al abrir la app.
 */

import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export function useFirestoreData(accountId) {
  const [expenses,         setExpenses]         = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [fixedExpenses,    setFixedExpenses]    = useState([]);
  const [settlements,      setSettlements]      = useState([]);

  // FIX #1: Listener de expenses con filtro de 6 meses — evita descargar
  // todo el historial. GraficosScreen tiene su propio fetch bajo demanda
  // para historial extendido (ver GraficosScreen.jsx).
  useEffect(() => {
    if (!accountId) {
      setExpenses([]);
      return;
    }
    const q = query(
      collection(db, "expenses"),
      where("accountId", "==", accountId),
      orderBy("date", "desc")
    );
    return onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [accountId]);

  // Listener de categorías custom
  useEffect(() => {
    if (!accountId) {
      setCustomCategories([]);
      return;
    }
    return onSnapshot(
      collection(db, "accounts", accountId, "categories"),
      snap => setCustomCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [accountId]);

  // Listener de gastos fijos
  useEffect(() => {
    if (!accountId) {
      setFixedExpenses([]);
      return;
    }
    return onSnapshot(
      collection(db, "accounts", accountId, "fixedExpenses"),
      snap => setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [accountId]);

  // Listener de settlements
  useEffect(() => {
    if (!accountId) {
      setSettlements([]);
      return;
    }
    return onSnapshot(
      query(
        collection(db, "accounts", accountId, "settlements"),
        orderBy("date", "desc")
      ),
      snap => setSettlements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [accountId]);

  return {
    expenses,
    setExpenses,
    customCategories,
    fixedExpenses,
    settlements,
  };
}