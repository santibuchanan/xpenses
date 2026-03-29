import { initializeApp } from "firebase/app";
import { getFirestore, writeBatch, collection, query, where, getDocs, getDoc, doc, arrayRemove } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = new EmailAuthProvider();
export const storage = getStorage(app);

export async function deleteUserData(uid) {
  const batch = writeBatch(db);

  // 1. Leer cuentas donde el usuario es miembro
  const accountsSnap = await getDocs(
    query(collection(db, "accounts"), where("memberIds", "array-contains", uid))
  );

  for (const accountDoc of accountsSnap.docs) {
    const account = accountDoc.data();
    const accountRef = doc(db, "accounts", accountDoc.id);

    // 2a. Remover uid de memberIds
    const updatedMemberIds = (account.memberIds || []).filter(id => id !== uid);

    // 2c. Si es cuenta personal y quedaría sin miembros, eliminarla
    if (account.type === "personal" && updatedMemberIds.length === 0) {
      batch.delete(accountRef);
    } else {
      // 2b. Desvincular label con linkedUid === uid
      const updatedLabels = (account.memberLabels || []).map(label =>
        label.linkedUid === uid ? { ...label, linkedUid: null } : label
      );
      batch.update(accountRef, {
        memberIds: arrayRemove(uid),
        memberLabels: updatedLabels,
      });
    }

    // 3. Eliminar notificaciones de esta cuenta dirigidas al uid
    const notifsSnap = await getDocs(
      query(
        collection(db, "accounts", accountDoc.id, "notifications"),
        where("toUid", "==", uid)
      )
    );
    notifsSnap.forEach(notifDoc => {
      batch.delete(doc(db, "accounts", accountDoc.id, "notifications", notifDoc.id));
    });
  }

  // 4. Eliminar documento del usuario (solo si existe)
  const userSnap = await getDoc(doc(db, "users", uid));
  if (userSnap.exists()) {
    batch.delete(doc(db, "users", uid));
  }

  // 5. Commit
  await batch.commit();
}
