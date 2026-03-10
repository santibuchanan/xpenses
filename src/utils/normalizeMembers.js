/**
 * normalizeMembers.js
 * Fuente única de normalización de miembros.
 *
 * Problema que resuelve: allMembers se construye en App.jsx combinando usuarios
 * reales (members) con labels no vinculados (memberLabels). Varios componentes
 * re-normalizaban el array internamente (uid = m.uid || m.id) porque no podían
 * confiar en su forma. Esto ocultaba bugs en lugar de exponerlos.
 *
 * Uso:
 *   import { buildAllMembers, normalizeMember } from "../utils/normalizeMembers";
 *
 *   // En App.jsx — reemplaza la construcción inline de allMembers
 *   const allMembers = buildAllMembers(members, account?.memberLabels);
 *
 *   // En cualquier componente que recibe allMembers — ya no es necesario
 *   // re-normalizar. Pero si se recibe un member suelto, usar normalizeMember().
 */

/**
 * Normaliza un member individual garantizando que uid, name y color siempre existan.
 * @param {object} m - Member o MemberLabel
 * @returns {{ uid: string, name: string, color: string, _isLabel: boolean }}
 */
export function normalizeMember(m) {
  return {
    ...m,
    uid:      m.uid || m.id,
    name:     m.name || m.displayName || "Sin nombre",
    color:    m.color || "#4F7FFA",
    _isLabel: m._isLabel || false,
  };
}

/**
 * Construye el array allMembers combinando usuarios reales con labels no vinculados.
 * Garantiza que todos los elementos tengan uid, name y color.
 *
 * Reglas:
 * - Los usuarios reales (members) siempre se incluyen primero.
 * - Los labels se incluyen solo si: (1) no tienen linkedUid, y (2) su id no
 *   coincide con el uid de un miembro real ya incluido (evita duplicados).
 *
 * @param {object[]} members       - Usuarios reales de Firestore
 * @param {object[]} memberLabels  - Labels del account (account.memberLabels)
 * @returns {object[]}             - Array normalizado
 */
export function buildAllMembers(members = [], memberLabels = []) {
  const normalizedMembers = members.map(normalizeMember);

  const normalizedLabels = memberLabels
    .filter(l => !l.linkedUid && !members.some(m => m.uid === l.id))
    .map(l => normalizeMember({ uid: l.id, name: l.name, color: l.color, _isLabel: true }));

  return [...normalizedMembers, ...normalizedLabels];
}