import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicamento, Procedure, HealthProvider, ProcedureType, Familiar, ProcedureCategory, Tratamento } from '../types';

/**
 * Envia todos os medicamentos do localStorage para a coleção 'medicamentos' no Firestore,
 * associando-os ao e-mail do usuário logado (ownerId).
 * Remove medicamentos no Firestore que já não existem no localStorage.
 */
export async function syncMedicamentosToFirestore(email: string, meds: Medicamento[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando medicamentos com o Firestore para:", email);
    
    // 1. Obter todos os medicamentos atuais deste owner no Firestore
    const q = query(collection(db, "medicamentos"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    
    const activeIds = new Set(meds.map(m => m.id));
    
    // 2. Apagar do Firestore os medicamentos que não existem mais localmente
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "medicamentos", docSnap.id));
        console.log(`[FirebaseSync] Medicamento antigo excluído do Firestore: ${docSnap.id}`);
      }
    }
    
    // 3. Salvar ou atualizar todos os medicamentos atuais no Firestore
    for (const med of meds) {
      const docRef = doc(db, "medicamentos", med.id);
      
      // Clean object before sending to Firestore to avoid 'undefined' field values
      const medData = { ...med, ownerId: email };
      const cleanedData = removeUndefined(medData);

      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de medicamentos finalizada com sucesso!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar medicamentos com Firestore:", err);
  }
}

/**
 * Busca todos os medicamentos da coleção 'medicamentos' no Firestore para o usuário informado.
 */
export async function fetchMedicamentosFromFirestore(email: string): Promise<Medicamento[] | null> {
  if (!email) return null;
  try {
    console.log("[FirebaseSync] Buscando medicamentos do Firestore para:", email);
    const q = query(collection(db, "medicamentos"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    
    const meds: Medicamento[] = [];
    querySnapshot.forEach((docSnap) => {
      meds.push({
        id: docSnap.id,
        ...docSnap.data()
      } as Medicamento);
    });
    
    console.log(`[FirebaseSync] Busca do Firestore finalizada. Encontrados: ${meds.length} medicamentos.`);
    return meds;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar medicamentos do Firestore:", err);
    return null;
  }
}

function removeUndefined(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(v => v !== undefined);
  }
  
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanedValue = removeUndefined(value);
    if (cleanedValue !== undefined) {
      cleaned[key] = cleanedValue;
    }
  }
  return cleaned;
}

// --- Sincronização de Procedimentos (Procedures) ---
export async function syncProceduresToFirestore(email: string, items: Procedure[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando procedimentos com o Firestore para:", email);
    const q = query(collection(db, "procedures"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const activeIds = new Set(items.map(p => p.id));
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "procedures", docSnap.id));
      }
    }
    for (const item of items) {
      const docRef = doc(db, "procedures", item.id);
      const data = { ...item, ownerId: email };
      const cleanedData = removeUndefined(data);
      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de procedimentos concluída!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar procedimentos:", err);
  }
}

export async function fetchProceduresFromFirestore(email: string): Promise<Procedure[] | null> {
  if (!email) return null;
  try {
    const q = query(collection(db, "procedures"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const list: Procedure[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Procedure);
    });
    return list;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar procedimentos:", err);
    return null;
  }
}

// --- Sincronização de Prestadores de Saúde (Providers) ---
export async function syncProvidersToFirestore(email: string, items: HealthProvider[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando prestadores com o Firestore para:", email);
    const q = query(collection(db, "providers"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const activeIds = new Set(items.map(p => p.id));
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "providers", docSnap.id));
      }
    }
    for (const item of items) {
      const docRef = doc(db, "providers", item.id);
      const data = { ...item, ownerId: email };
      const cleanedData = removeUndefined(data);
      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de prestadores concluída!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar prestadores:", err);
  }
}

export async function fetchProvidersFromFirestore(email: string): Promise<HealthProvider[] | null> {
  if (!email) return null;
  try {
    const q = query(collection(db, "providers"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const list: HealthProvider[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as HealthProvider);
    });
    return list;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar prestadores:", err);
    return null;
  }
}

// --- Sincronização de Tipos de Procedimentos (ProcedureTypes) ---
export async function syncProcedureTypesToFirestore(email: string, items: ProcedureType[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando tipos de procedimento com o Firestore para:", email);
    const q = query(collection(db, "procedureTypes"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const activeIds = new Set(items.map(p => p.id));
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "procedureTypes", docSnap.id));
      }
    }
    for (const item of items) {
      const docRef = doc(db, "procedureTypes", item.id);
      const data = { ...item, ownerId: email };
      const cleanedData = removeUndefined(data);
      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de tipos concluída!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar tipos de procedimento:", err);
  }
}

export async function fetchProcedureTypesFromFirestore(email: string): Promise<ProcedureType[] | null> {
  if (!email) return null;
  try {
    const q = query(collection(db, "procedureTypes"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const list: ProcedureType[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ProcedureType);
    });
    return list;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar tipos de procedimento:", err);
    return null;
  }
}

// --- Sincronização de Familiares (Familiars) ---
export async function syncFamiliarsToFirestore(email: string, items: Familiar[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando familiares com o Firestore para:", email);
    const q = query(collection(db, "familiars"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const activeIds = new Set(items.map(p => p.id));
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "familiars", docSnap.id));
      }
    }
    for (const item of items) {
      const docRef = doc(db, "familiars", item.id);
      const data = { ...item, ownerId: email };
      const cleanedData = removeUndefined(data);
      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de familiares concluída!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar familiares:", err);
  }
}

export async function fetchFamiliarsFromFirestore(email: string): Promise<Familiar[] | null> {
  if (!email) return null;
  try {
    const q = query(collection(db, "familiars"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const list: Familiar[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Familiar);
    });
    return list;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar familiares:", err);
    return null;
  }
}

// --- Sincronização de Categorias (ProcedureCategory) ---
export async function syncCategoriesToFirestore(email: string, items: ProcedureCategory[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando categorias com o Firestore para:", email);
    const q = query(collection(db, "categories"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const activeIds = new Set(items.map(p => p.id));
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "categories", docSnap.id));
      }
    }
    for (const item of items) {
      const docRef = doc(db, "categories", item.id);
      const data = { ...item, ownerId: email };
      const cleanedData = removeUndefined(data);
      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de categorias concluída!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar categorias:", err);
  }
}

export async function fetchCategoriesFromFirestore(email: string): Promise<ProcedureCategory[] | null> {
  if (!email) return null;
  try {
    const q = query(collection(db, "categories"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const list: ProcedureCategory[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ProcedureCategory);
    });
    return list;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar categorias:", err);
    return null;
  }
}

// --- Sincronização de Tratamentos (Tratamento) ---
export async function syncTratamentosToFirestore(email: string, items: Tratamento[]) {
  if (!email) return;
  try {
    console.log("[FirebaseSync] Sincronizando tratamentos com o Firestore para:", email);
    const q = query(collection(db, "tratamentos"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const activeIds = new Set(items.map(p => p.id));
    for (const docSnap of querySnapshot.docs) {
      if (!activeIds.has(docSnap.id)) {
        await deleteDoc(doc(db, "tratamentos", docSnap.id));
      }
    }
    for (const item of items) {
      const docRef = doc(db, "tratamentos", item.id);
      const data = { ...item, ownerId: email };
      const cleanedData = removeUndefined(data);
      await setDoc(docRef, cleanedData);
    }
    console.log("[FirebaseSync] Sincronização de tratamentos concluída!");
  } catch (err) {
    console.error("[FirebaseSync] Erro ao sincronizar tratamentos:", err);
  }
}

export async function fetchTratamentosFromFirestore(email: string): Promise<Tratamento[] | null> {
  if (!email) return null;
  try {
    const q = query(collection(db, "tratamentos"), where("ownerId", "==", email));
    const querySnapshot = await getDocs(q);
    const list: Tratamento[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Tratamento);
    });
    return list;
  } catch (err) {
    console.error("[FirebaseSync] Erro ao buscar tratamentos:", err);
    return null;
  }
}
