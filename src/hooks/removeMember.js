import {
  doc, collection, getDocs, query, where,
  writeBatch, arrayRemove, getDoc, deleteField
} from "firebase/firestore";
import { db } from "../firebase.js";

/**
 * removeMember
 * Elimina un miembro de una cuenta compartida y reasigna sus gastos.
 *
 * Lógica de reasignación:
 * - paidBy = memberUid         → reasignar al owner de la cuenta
 * - forWhom incluye memberUid  → quitarlo del array (si queda vacío → owner)
 * - type="mio", owner=memberUid → reasignar owner al pagador (o al owner de cuenta)
 * - type="extraordinary"       → eliminar campo paid_{memberUid}
 * - settlements del mes actual → marcar como invalidados (requieren recálculo)
 * - memberIds y memberLabels   → quitar al miembro
 * - users/{memberUid}          → quitar accountId de su lista
 */
export async function removeMember({ accountId, memberUid, ownerUid, currentMonth }) {
  try {
    // 1. No se puede eliminar al owner de la cuenta
    if (memberUid === ownerUid) {
      return { success: false, error: "No se puede eliminar al creador de la cuenta." };
    }

    // 2. Cargar datos necesarios en paralelo
    const [expensesSnap, accountSnap, settlementsSnap, memberSnap] = await Promise.all([
      getDocs(query(
        collection(db, "expenses"),
        where("accountId", "==", accountId)
      )),
      getDoc(doc(db, "accounts", accountId)),
      getDocs(query(
        collection(db, "accounts", accountId, "settlements"),
        where("month", "==", currentMonth)
      )),
      getDoc(doc(db, "users", memberUid)),
    ]);

    if (!accountSnap.exists()) {
      return { success: false, error: "Cuenta no encontrada." };
    }
    const accountData = accountSnap.data();

    // 3. Batches múltiples (límite Firestore: 500 ops por batch)
    const batches = [];
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const addOp = (fn) => {
      if (opCount >= 490) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        opCount = 0;
      }
      fn(currentBatch);
      opCount++;
    };

    // 4. Reasignar gastos
    expensesSnap.docs.forEach(expDoc => {
      const e = expDoc.data();
      // Ignorar gastos eliminados (soft-delete)
      if (e.deleted) return;

      const ref = doc(db, "expenses", expDoc.id);
      const updates = {};
      let hasChanges = false;

      // paidBy → reasignar al owner de la cuenta (compatible con string y array)
      if (Array.isArray(e.paidBy)) {
        if (e.paidBy.some(p => p.uid === memberUid)) {
          const remaining = e.paidBy.filter(p => p.uid !== memberUid);
          updates.paidBy = remaining.length === 1 ? remaining[0].uid
                         : remaining.length === 0 ? ownerUid
                         : remaining;
          updates.reassignedFrom = memberUid;
          updates.reassignedAt = new Date().toISOString();
          hasChanges = true;
        }
      } else if (e.paidBy === memberUid) {
        updates.paidBy = ownerUid;
        updates.reassignedFrom = memberUid;
        updates.reassignedAt = new Date().toISOString();
        hasChanges = true;
      }

      // forWhom → quitar al miembro eliminado
      if (Array.isArray(e.forWhom) && e.forWhom.includes(memberUid)) {
        const newForWhom = e.forWhom.filter(uid => uid !== memberUid);
        updates.forWhom = newForWhom.length > 0 ? newForWhom : [ownerUid];
        hasChanges = true;
      }

      // type="mio" con owner = memberUid → reasignar
      if (e.type === "mio" && e.owner === memberUid) {
        const fallbackPayer = Array.isArray(e.paidBy)
          ? (e.paidBy.find(p => p.uid !== memberUid)?.uid || ownerUid)
          : (e.paidBy && e.paidBy !== memberUid ? e.paidBy : ownerUid);
        updates.owner = fallbackPayer;
        hasChanges = true;
      }

      // type="extraordinary" → eliminar campo paid_{memberUid}
      if (e.type === "extraordinary" && e[`paid_${memberUid}`] !== undefined) {
        updates[`paid_${memberUid}`] = deleteField();
        hasChanges = true;
      }

      if (hasChanges) {
        addOp(batch => batch.update(ref, updates));
      }
    });

    // 5. Invalidar settlements del mes actual para forzar recálculo
    settlementsSnap.docs.forEach(sDoc => {
      addOp(batch => batch.update(
        doc(db, "accounts", accountId, "settlements", sDoc.id),
        {
          invalidated: true,
          invalidatedReason: `Miembro eliminado: ${memberUid}`,
          invalidatedAt: new Date().toISOString(),
        }
      ));
    });

    // 6. Actualizar cuenta — quitar de memberIds y memberLabels
    const newMemberIds = (accountData.memberIds || []).filter(uid => uid !== memberUid);
    const newMemberLabels = (accountData.memberLabels || []).filter(
      l => l.linkedUid !== memberUid && l.id !== memberUid
    );
    addOp(batch => batch.update(doc(db, "accounts", accountId), {
      memberIds: newMemberIds,
      memberLabels: newMemberLabels,
    }));

    // 7. Quitar accountId del perfil del miembro eliminado
    if (memberSnap.exists()) {
      addOp(batch => batch.update(doc(db, "users", memberUid), {
        accountIds: arrayRemove(accountId),
      }));
    }

    // 8. Commit de todos los batches en paralelo
    batches.push(currentBatch);
    await Promise.all(batches.map(b => b.commit()));

    return { success: true };

  } catch (err) {
    console.error("Error eliminando miembro:", err);
    return { success: false, error: err.message };
  }
}