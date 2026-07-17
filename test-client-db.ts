import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

async function test() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let firebaseConfig: any = {};
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  console.log("Conectando via Client SDK ao Firestore db:", firebaseConfig.firestoreDatabaseId);

  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const docRef = doc(db, "app_settings", "stock_routine");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("Documento stock_routine encontrado no Firestore:", docSnap.data());
    } else {
      console.log("Documento stock_routine NAO encontrado no Firestore!");
    }
  } catch (err) {
    console.error("Erro ao ler documento específico app_settings/stock_routine:", err);
  }

  const querySnapshot = await getDocs(collection(db, "medicamentos"));
  console.log(`Total de medicamentos cadastrados: ${querySnapshot.size}`);

  querySnapshot.forEach((doc) => {
    console.log(`${doc.id} =>`, doc.data());
  });

  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
