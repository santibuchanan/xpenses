/**
 * hooks/useInvite.js
 * Maneja el flujo completo de invitaciones:
 * - Detectar ?invite= en la URL
 * - Procesar la invitación al autenticarse
 * - Claim de identidad (ClaimIdentityModal)
 * - Join atómico via runTransaction (FIX #5: evita race condition)
 *
 * Extraído de App.jsx para separar responsabilidades.
 */

import { useState, useEffect } from "react";
import {
  doc, getDoc, updateDoc, setDoc, arrayUnion, runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";

export function useInvite({ authUser, onJoined }) {
  const [pendingInviteId, setPendingInviteId] = useState(null);
  const [claimData,       setClaimData]       = useState(null);

  // Detectar invite en URL al montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get("invite");
    if (inviteId) {
      setPendingInviteId(inviteId);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Procesar invitación cuando hay usuario autenticado
  useEffect(() => {
    if (!pendingInviteId || !authUser) return;

    const processInvite = async () => {
      try {
        const inviteSnap = await getDoc(doc(db, "invites", pendingInviteId));
        if (!inviteSnap.exists() || inviteSnap.data().used) return;

        const invite = inviteSnap.data();
        const accountSnap = await getDoc(doc(db, "accounts", invite.accountId));
        if (!accountSnap.exists()) return;

        const accountData = accountSnap.data();
        const unlinked = (accountData.memberLabels || []).filter(l => !l.linkedUid);

        if (unlinked.length > 0) {
          setClaimData({
            inviteId: pendingInviteId,
            accountId: invite.accountId,
            accountData,
            memberLabels: unlinked,
          });
          setPendingInviteId(null);
          return;
        }

        await finishJoinAccount({
          inviteId: pendingInviteId,
          accountId: invite.accountId,
          accountData,
          claimedLabelId: null,
        });
        setPendingInviteId(null);
      } catch (err) {
        console.error("Error procesando invitación:", err);
      }
    };

    processInvite();
  }, [pendingInviteId, authUser]);

  /**
   * FIX #5: Join atómico via runTransaction.
   * Antes: 4-5 writes secuenciales sin atomicidad — si fallaba cualquiera
   * el usuario podía quedar en un estado inconsistente, y dos usuarios
   * podían reclamar el mismo label simultáneamente.
   */
  const finishJoinAccount = async ({ inviteId, accountId, accountData, claimedLabelId }) => {
    try {
      await runTransaction(db, async (transaction) => {
        const inviteRef  = doc(db, "invites", inviteId);
        const accountRef = doc(db, "accounts", accountId);
        const userRef    = doc(db, "users", authUser.uid);

        // Leer dentro de la transacción para garantizar consistencia
        const [inviteSnap, userSnap] = await Promise.all([
          transaction.get(inviteRef),
          transaction.get(userRef),
        ]);

        // Verificar que la invitación no fue usada por otro mientras tanto
        if (inviteSnap.data()?.used) {
          throw new Error("Esta invitación ya fue utilizada.");
        }

        const existingIds = userSnap.exists()
          ? (userSnap.data().accountIds || [])
          : [];

        // Marcar invite como usada
        transaction.update(inviteRef, { used: true });

        // Agregar usuario a la cuenta
        transaction.update(accountRef, { memberIds: arrayUnion(authUser.uid) });

        // Actualizar perfil del usuario
        const userUpdate = {
          accountIds: existingIds.includes(accountId)
            ? existingIds
            : [...existingIds, accountId],
        };

        // Vincular label si se eligió uno
        if (claimedLabelId) {
          const label = accountData.memberLabels?.find(l => l.id === claimedLabelId);
          if (label?.name) userUpdate.name = label.name;

          const updatedLabels = (accountData.memberLabels || []).map(l =>
            l.id === claimedLabelId ? { ...l, linkedUid: authUser.uid } : l
          );
          transaction.update(accountRef, { memberLabels: updatedLabels });
        }

        transaction.set(userRef, userUpdate, { merge: true });
      });

      setClaimData(null);
      onJoined(accountId);
    } catch (err) {
      if (err.message === "Esta invitación ya fue utilizada.") {
        console.warn("Invitación ya usada — posible doble submit.");
        // Igual intentar unirse si el usuario no está en la cuenta
        try {
          const accountSnap = await getDoc(doc(db, "accounts", accountId));
          if (accountSnap.data()?.memberIds?.includes(authUser.uid)) {
            setClaimData(null);
            onJoined(accountId);
          }
        } catch (_) {}
      } else {
        console.error("Error al unirse a la cuenta:", err);
      }
    }
  };

  return { claimData, setClaimData, finishJoinAccount };
}