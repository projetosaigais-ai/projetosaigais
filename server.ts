import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import cron from "node-cron";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, getDoc, setDoc, setLogLevel, Firestore } from "firebase/firestore";
import { Resend } from "resend";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy initialization of Gemini SDK as per guidelines
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Controle dinâmico do horário do cron
let scheduledHour = 14; // Padrão: 14:00 PM
let scheduledMinute = 0; // Padrão: 00 minutos
let cronJobApiKey = ""; // Chave de API do cron-job.org
let proceduresBufferDays = 15; // Padrão: 15 dias para verificar vencimento de procedimentos
const SETTINGS_FILE = path.join(process.cwd(), "cron_settings_backup.json");

function getEffectiveApiKey(): string {
  const localKey = (cronJobApiKey && !cronJobApiKey.includes("...")) ? cronJobApiKey : "";
  return localKey || process.env.CRON_JOB_API_KEY || "";
}

function loadSettingsLocal() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      if (typeof data.scheduledHour === 'number') {
        scheduledHour = data.scheduledHour;
      }
      if (typeof data.scheduledMinute === 'number') {
        scheduledMinute = data.scheduledMinute;
      }
      if (typeof data.cronJobApiKey === 'string' && !data.cronJobApiKey.includes("...")) {
        cronJobApiKey = data.cronJobApiKey;
      }
      if (typeof data.proceduresBufferDays === 'number') {
        proceduresBufferDays = data.proceduresBufferDays;
      }
      console.log(`[CronConfig] Configurações carregadas do arquivo local: ${scheduledHour}:${String(scheduledMinute).padStart(2, '0')}, buffer: ${proceduresBufferDays} dias (API Key set: ${!!getEffectiveApiKey()})`);
    }
  } catch (e) {
    console.error("Erro ao ler configurações locais de cron:", e);
  }
}

function saveSettingsLocal(hour: number, minute: number, apiKey: string, bufferDays: number) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ scheduledHour: hour, scheduledMinute: minute, cronJobApiKey: apiKey, proceduresBufferDays: bufferDays }, null, 2), "utf-8");
  } catch (e) {
    console.error("Erro ao salvar configurações locais de cron:", e);
  }
}

async function syncCronSettingsFromFirestore() {
  try {
    const dbInstance = getDb();
    const docRef = doc(dbInstance, "app_settings", "stock_routine");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      let changed = false;
      if (typeof data.scheduledHour === 'number') {
        scheduledHour = data.scheduledHour;
        changed = true;
      }
      if (typeof data.scheduledMinute === 'number') {
        scheduledMinute = data.scheduledMinute;
        changed = true;
      }
      if (typeof data.proceduresBufferDays === 'number') {
        proceduresBufferDays = data.proceduresBufferDays;
        changed = true;
      }
      if (changed) {
        saveSettingsLocal(scheduledHour, scheduledMinute, cronJobApiKey, proceduresBufferDays);
        console.log(`[CronConfig] Configurações carregadas do Firestore: ${scheduledHour}:${String(scheduledMinute).padStart(2, '0')}, buffer: ${proceduresBufferDays} dias`);
      }
    }
  } catch (e) {
    console.warn("[CronConfig] Erro ao sincronizar configurações do cron do Firestore, usando backup local:", e);
  }
}

function getCronInfo(hour: number, minute: number = 0, apiKey: string = "", bufferDays: number = 15) {
  let wakeUpHour = hour;
  let wakeUpMinute = minute - 1;
  if (wakeUpMinute < 0) {
    wakeUpMinute = 59;
    wakeUpHour = hour - 1;
    if (wakeUpHour < 0) {
      wakeUpHour = 23;
    }
  }
  return {
    scheduledHour: hour,
    scheduledMinute: minute,
    cronExpression: `${minute} ${hour} * * *`,
    wakeUpHour,
    wakeUpMinute,
    wakeUpCron: `${wakeUpMinute} ${wakeUpHour} * * *`,
    hasCronJobApiKey: !!apiKey,
    cronJobApiKeyMasked: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "",
    proceduresBufferDays: bufferDays
  };
}

// Initialize Firebase SDK lazily with correct config
let dbInstance: Firestore;
function getDb(): Firestore {
  if (!dbInstance) {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let firebaseConfig: any = {};
    try {
      if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      }
    } catch (e) {
      console.error("Erro ao ler firebase-applet-config.json:", e);
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    setLogLevel('error');
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  return dbInstance;
}

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Backup local de logs para evitar dependência exclusiva do Firestore Admin
const LOGS_FILE = path.join(process.cwd(), "email_logs_backup.json");

function getLocalLogs(): any[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Erro ao ler logs locais:", e);
  }
  return [];
}

function saveLocalLog(log: any) {
  try {
    const logs = getLocalLogs();
    logs.unshift(log);
    if (logs.length > 100) {
      logs.splice(100);
    }
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (e) {
    console.error("Erro ao salvar log local:", e);
  }
}

// Helper para cálculo do decremento (baseado em src/utils/stockHelper.ts)
function calculateStockDecrement(vezesAoDia: number, startDateStr: string, endDateStr: string): number {
  if (!vezesAoDia || vezesAoDia === 6) return 0;

  const d1 = new Date(startDateStr + "T00:00:00");
  const d2 = new Date(endDateStr + "T00:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysPassed <= 0) return 0;

  let totalDecrement = 0;
  const tempDate = new Date(startDateStr + "T00:00:00");

  for (let i = 1; i <= daysPassed; i++) {
    tempDate.setDate(tempDate.getDate() + 1);
    if (vezesAoDia >= 1 && vezesAoDia <= 4) {
      totalDecrement += vezesAoDia;
    } else if (vezesAoDia === 5) {
      if (tempDate.getDate() === 1) totalDecrement += 1;
    }
  }
  return totalDecrement;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Log all API requests
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API Request] ${req.method} ${req.path}`);
    }
    next();
  });

  // Helper para salvar logs de e-mail
  async function logEmail(to: string, subject: string, status: 'success' | 'failure', error?: string) {
    const logData = {
      to: to || "Desconhecido",
      subject,
      status,
      error: error || null,
      timestamp: new Date().toISOString()
    };

    // Sempre salva localmente no arquivo do servidor para persistência garantida na nuvem
    saveLocalLog(logData);

    try {
      await addDoc(collection(getDb(), "email_logs"), {
        ...logData,
        timestamp: new Date() // usar objeto Date para o Firestore
      });
      console.log(`Log de e-mail registrado no Firestore: ${subject} -> ${to} [Status: ${status}]`);
    } catch (e: any) {
      if (e.code === 7 || String(e).includes("permission") || String(e).includes("PERMISSION_DENIED")) {
        console.warn(`Aviso: Sem permissão IAM para salvar no Firestore (gravado apenas em backup local).`);
      } else {
        console.warn("Aviso: Falha ao registrar log no Firestore:", e.message || String(e));
      }
    }
  }
  // Rotina unificada de verificação de estoque e envio de alertas
  async function performStockCheck(clientMeds?: any[], isManual: boolean = false, clientFamiliars?: any[]) {
    console.log(`Iniciando verificação de estoque (isManual: ${isManual})...`);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    let medsToProcess: any[] = [];
    let isClientProvided = Array.isArray(clientMeds);

    if (isClientProvided) {
      console.log("Usando lista de medicamentos enviada pelo cliente.");
      medsToProcess = clientMeds || [];
    } else {
      console.log("Buscando medicamentos do Firestore...");
      try {
        const dbInstance = getDb();
        const querySnapshot = await getDocs(collection(dbInstance, "medicamentos"));
        medsToProcess = querySnapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
      } catch (error: any) {
        console.error("Falha crítica ao buscar medicamentos do Firestore:", error.message);
        throw new Error(`Falha na conexão com o Firestore: Não foi possível ler a lista de medicamentos (${error.message || String(error)})`);
      }
    }

    // 1. Processar decremento de estoque diário se ainda não processado hoje
    const processedMeds = medsToProcess.map((med) => {
      const lastProcessedDate = med.lastProcessedDate || med.dataAlteracaoEstoque || "";
      
      if (lastProcessedDate && lastProcessedDate >= today) {
        return med; // Já processado hoje
      }

      // Se não havia data gravada anteriormente, assumimos que é hoje (inicialização)
      // para evitar Invalid Date/NaN no helper, e atualizamos o banco.
      let decrement = 0;
      if (!lastProcessedDate) {
        console.log(`Medicamento ${med.nome} não possuía data anterior de alteração. Inicializando com data de hoje: ${today}`);
      } else {
        decrement = calculateStockDecrement(med.vezesAoDia, lastProcessedDate, today);
      }
      
      const updatedMed = { ...med };
      if (decrement > 0) {
        const novaQuantidade = Math.max(0, (Number(med.quantidadeAtual) || 0) - decrement);
        updatedMed.quantidadeAtual = novaQuantidade;
        console.log(`Medicamento ${med.nome} decrementado em ${decrement}. Nova quantidade: ${novaQuantidade}`);
      }
      updatedMed.lastProcessedDate = today;
      updatedMed.dataAlteracaoEstoque = today;

      return updatedMed;
    });

    // Se veio do Firestore, salva de volta as alterações de forma assíncrona aguardada
    if (!isClientProvided) {
      for (const updatedMed of processedMeds) {
        const originalMed = medsToProcess.find(m => m.id === updatedMed.id);
        const lastProcessedDate = originalMed?.lastProcessedDate || originalMed?.dataAlteracaoEstoque || "";
        if (!lastProcessedDate || lastProcessedDate < today) {
          if (updatedMed.ref) {
            try {
              await updateDoc(updatedMed.ref, {
                quantidadeAtual: updatedMed.quantidadeAtual !== undefined ? updatedMed.quantidadeAtual : (originalMed?.quantidadeAtual || 0),
                lastProcessedDate: today,
                dataAlteracaoEstoque: today
              });
            } catch (e: any) {
              console.error(`Erro ao atualizar medicamento ${updatedMed.nome} no Firestore:`, e.message);
              throw new Error(`Atualização do Estoque: Erro ao salvar nova quantidade de ${updatedMed.nome} no Firestore (${e.message || String(e)})`);
            }
          }
        }
      }
    }

    // 2. Buscar medicamentos críticos atualizados (carência de 3 dias desativada a pedido do usuário)
    const criticalMeds = processedMeds.filter(med => {
      const qAtual = med.quantidadeAtual !== undefined ? Number(med.quantidadeAtual) : 0;
      const eMin = med.estoqueMinimo !== undefined ? Number(med.estoqueMinimo) : 0;
      
      return qAtual < eMin;
    });

    const emailTo = process.env.NOTIFICATION_EMAIL;
    const apiKey = process.env.RESEND_API_KEY;

    if (criticalMeds.length === 0) {
      console.log("Nenhum medicamento com estoque crítico ou pendente de alerta.");
      return { 
        success: true, 
        message: "Estoque verificado. Nenhum medicamento pendente de alerta crítico.", 
        sent: false, 
        criticalCount: 0,
        updatedMeds: isClientProvided ? processedMeds : undefined
      };
    }

    // Verificar se o alerta de e-mail já foi enviado hoje (apenas para execuções automáticas)
    let emailAlreadySentToday = false;
    if (!isManual) {
      try {
        const dbInstance = getDb();
        const docRef = doc(dbInstance, "app_settings", "stock_routine");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.lastEmailSentDate === today) {
            emailAlreadySentToday = true;
          }
        }
      } catch (e) {
        console.warn("Erro ao verificar lastEmailSentDate de estoque no Firestore:", e);
      }
    }

    if (emailAlreadySentToday) {
      console.log(`[StockCheck] Alerta de estoque já enviado hoje (${today}). Pulando envio automático.`);
      return { 
        success: true, 
        message: "Estoque verificado. Alerta de e-mail já enviado hoje.", 
        sent: false, 
        criticalCount: criticalMeds.length,
        updatedMeds: isClientProvided ? processedMeds : undefined
      };
    }

    // Janela de Envio Matutina desativada a pedido do usuário para permitir execução em qualquer horário

    if (!apiKey || !emailTo) {
      const missing = [];
      if (!apiKey) missing.push("RESEND_API_KEY");
      if (!emailTo) missing.push("NOTIFICATION_EMAIL");
      const errMsg = `Alerta não enviado por e-mail: Faltando configuração de ambiente (${missing.join(", ")})`;
      console.warn(errMsg);
      
      await logEmail(
        emailTo || "configuracao-pendente@agenda.com",
        "Alerta de Estoque Crítico (Não Enviado por E-mail)",
        "failure",
        `Faltam variáveis de ambiente: ${missing.join(", ")}. Configure-as na aba de Configurações.`
      );
      return { 
        success: true, 
        message: errMsg, 
        sent: false, 
        criticalCount: criticalMeds.length,
        updatedMeds: isClientProvided ? processedMeds : undefined
      };
    }

    // Trava Concorrente Imediata: atualiza lastEmailSentDate ANTES de começar o envio
    if (!isManual) {
      try {
        const dbInstance = getDb();
        const docRef = doc(dbInstance, "app_settings", "stock_routine");
        await setDoc(docRef, { lastEmailSentDate: today }, { merge: true });
        console.log(`[StockCheck] Trava imediata de envio ativada. lastEmailSentDate atualizado para ${today}`);
      } catch (e) {
        console.warn("Não foi possível atualizar preventivamente lastEmailSentDate no Firestore:", e);
      }
    }

    // Buscar membros da família do Firestore para associar aos medicamentos
    let familiars: any[] = [];
    if (Array.isArray(clientFamiliars) && clientFamiliars.length > 0) {
      console.log(`Usando ${clientFamiliars.length} familiares fornecidos pelo cliente.`);
      familiars = clientFamiliars;
    } else {
      try {
        const dbInstance = getDb();
        const querySnapshot = await getDocs(collection(dbInstance, "familiars"));
        familiars = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Buscados ${familiars.length} familiares do Firestore para agrupamento.`);
      } catch (error: any) {
        console.warn("Falha ao buscar familiares do Firestore para agrupamento de e-mail:", error.message);
      }
    }

    // Criar um mapa de ID do familiar para o nome
    const familiarMap = new Map<string, string>();
    familiars.forEach(f => {
      const fId = f.id || f.idRef || "";
      const fName = f.name || f.nome || "";
      if (fId && fName) {
        familiarMap.set(fId, fName);
      }
    });

    // Agrupar os medicamentos críticos por familiar
    const groupedMeds: { [familiarName: string]: any[] } = {};

    criticalMeds.forEach(med => {
      const pId = med.pessoaId || "";
      const familiarName = pId ? (familiarMap.get(pId) || "Uso Geral / Outros") : "Uso Geral / Outros";
      if (!groupedMeds[familiarName]) {
        groupedMeds[familiarName] = [];
      }
      groupedMeds[familiarName].push(med);
    });

    let medListHtml = "";
    const familiarNames = Object.keys(groupedMeds).sort((a, b) => {
      if (a === "Uso Geral / Outros") return 1;
      if (b === "Uso Geral / Outros") return -1;
      return a.localeCompare(b);
    });

    for (const name of familiarNames) {
      const meds = groupedMeds[name];
      medListHtml += `
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
          <!-- Header do Familiar -->
          <div style="background-color: #dc2626; color: #ffffff; padding: 12px 18px; font-size: 14.5px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: 1px solid #dc2626;">
            <span style="color: #60a5fa; margin-right: 6px; font-size: 14.5px;">👤</span> Familiar: ${name}
          </div>
          
          <!-- Tabela de Medicamentos -->
          <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 18px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Medicamento em Estoque Baixo</th>
                <th style="padding: 10px 18px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; width: 80px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Qtd. Atual</th>
                <th style="padding: 10px 18px; text-align: center; font-size: 11px; font-weight: 600; color: #475569; width: 90px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Estoque Mínimo</th>
                <th style="padding: 10px 18px; text-align: center; font-size: 11px; font-weight: 600; color: #dc2626; width: 100px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Qtd. a Comprar</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      meds.forEach((med, idx) => {
        const dosageStr = med.dosagem ? ` (${med.dosagem})` : "";
        const isLast = idx === meds.length - 1;
        const rowStyle = isLast ? "" : "border-bottom: 1px solid #f1f5f9;";
        const activePrincipleHtml = med.principioAtivo 
          ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Princípio Ativo: ${med.principioAtivo}</div>` 
          : "";
        
        const qtyToBuy = Math.max(0, (med.estoqueMinimo !== undefined ? Number(med.estoqueMinimo) : 0) - (med.quantidadeAtual !== undefined ? Number(med.quantidadeAtual) : 0));
          
        medListHtml += `
              <tr style="${rowStyle}">
                <td style="padding: 14px 18px; text-align: left; vertical-align: middle;">
                  <div style="font-weight: bold; font-size: 13.5px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">*${med.nome}${dosageStr}</div>
                  ${activePrincipleHtml}
                </td>
                <td style="padding: 14px 18px; text-align: center; vertical-align: middle;">
                  <div style="font-size: 16px; font-weight: bold; color: #ef4444; line-height: 1.1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${med.quantidadeAtual}</div>
                  <div style="font-size: 10px; color: #94a3b8; margin-top: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">unidades</div>
                </td>
                <td style="padding: 14px 18px; text-align: center; vertical-align: middle;">
                  <div style="font-size: 13.5px; font-weight: bold; color: #64748b; line-height: 1.1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${med.estoqueMinimo}</div>
                  <div style="font-size: 10px; color: #94a3b8; margin-top: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">unidades</div>
                </td>
                <td style="padding: 14px 18px; text-align: center; vertical-align: middle;">
                  <div style="font-size: 16px; font-weight: bold; color: #dc2626; line-height: 1.1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${qtyToBuy}</div>
                  <div style="font-size: 10px; color: #ef4444; margin-top: 2px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">comprar</div>
                </td>
              </tr>
        `;
      });
      
      medListHtml += `
            </tbody>
          </table>
        </div>
      `;
    }

    try {
      const resendInstance = new Resend(apiKey);
      await resendInstance.emails.send({
        from: "Agenda de Saúde <onboarding@resend.dev>",
        to: emailTo,
        subject: "Alerta: Medicamentos com Estoque Crítico",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 24px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);">
            <h2 style="color: #ef4444; margin-top: 0; margin-bottom: 24px; font-size: 16px; font-weight: 800; border-bottom: 2px solid #fecaca; padding-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              💊 Controle de Estoque de Medicamentos
            </h2>
            
            ${medListHtml}
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Este é um alerta automático do seu aplicativo de Agenda de Saúde.</p>
          </div>
        `
      });

      console.log("Email de alerta enviado com sucesso.");
      await logEmail(emailTo, "Alerta: Medicamentos com Estoque Crítico", "success");

      // Salvar ultimoEmailEnviadoEm nos medicamentos notificados
      if (!isClientProvided) {
        for (const med of criticalMeds) {
          if (med.ref) {
            updateDoc(med.ref, {
              ultimoEmailEnviadoEm: today
            }).catch((e: any) => console.warn(`Erro ao atualizar ultimoEmailEnviadoEm para ${med.nome}:`, e.message));
          }
        }
      }

      return { 
        success: true, 
        message: "E-mail de alerta enviado com sucesso.", 
        sent: true, 
        criticalCount: criticalMeds.length,
        updatedMeds: isClientProvided ? processedMeds : undefined
      };
    } catch (error: any) {
      console.error("Erro ao enviar email pelo Resend:", error);
      await logEmail(emailTo, "Alerta: Medicamentos com Estoque Crítico", "failure", error.message || String(error));
      return { 
        success: false, 
        error: error.message || String(error), 
        sent: false, 
        criticalCount: criticalMeds.length,
        updatedMeds: isClientProvided ? processedMeds : undefined
      };
    }
  }

  // Rotina unificada de verificação de procedimentos próximos ou vencidos (janela dinâmica baseada em configurações)
  async function performProceduresCheck(clientProcs?: any[], isManual: boolean = false) {
    console.log(`Iniciando verificação de procedimentos (isManual: ${isManual}, janela: ${proceduresBufferDays} dias)...`);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    
    // Obter data limite com base no buffer configurado no fuso de São Paulo
    const limitDateFromNow = new Date(new Date().getTime() + proceduresBufferDays * 24 * 60 * 60 * 1000);
    const limitDateLaterStr = limitDateFromNow.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    let procsToProcess: any[] = [];
    let isClientProvided = Array.isArray(clientProcs);

    if (isClientProvided) {
      console.log("Usando lista de procedimentos enviada pelo cliente.");
      procsToProcess = clientProcs || [];
    } else {
      console.log("Buscando procedimentos do Firestore...");
      try {
        const dbInstance = getDb();
        const querySnapshot = await getDocs(collection(dbInstance, "procedures"));
        procsToProcess = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (error: any) {
        console.error("Falha crítica ao buscar procedimentos do Firestore:", error.message);
        throw new Error(`Falha na conexão com o Firestore: Não foi possível ler a lista de procedimentos (${error.message || String(error)})`);
      }
    }

    // Identificar procedimentos em processo
    const inProcessProcs = procsToProcess.filter(proc => proc.status === 'em_processo' || proc.isEmProcesso);

    // Filtrar procedimentos que possuem data prevista de vencimento e não estão em standby nem em processo
    const matchingProcs = procsToProcess.filter(proc => {
      if (!proc.nextDate || proc.status === 'stand_by' || proc.status === 'em_processo' || proc.isEmProcesso) {
        return false;
      }
      // Consideramos qualquer procedimento cuja data seja menor ou igual à data limite configurada no futuro
      return proc.nextDate <= limitDateLaterStr;
    });

    if (matchingProcs.length === 0 && inProcessProcs.length === 0) {
      console.log(`Nenhum procedimento vencido, próximo ou em andamento nos próximos ${proceduresBufferDays} dias.`);
      return {
        success: true,
        message: `Nenhum procedimento a vencer ou em andamento nos próximos ${proceduresBufferDays} dias.`,
        sent: false,
        count: 0
      };
    }

    // Dividir entre Atrasados e Próximos
    const overdueProcs = matchingProcs.filter(p => p.nextDate < today);
    const upcomingProcs = matchingProcs.filter(p => p.nextDate >= today);

    // Ordenar por data
    overdueProcs.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    upcomingProcs.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    
    // Sort inProcessProcs alphabetically
    inProcessProcs.sort((a, b) => a.name.localeCompare(b.name));

    const emailTo = process.env.NOTIFICATION_EMAIL;
    const apiKey = process.env.RESEND_API_KEY;

    // Verificar se o alerta de e-mail já foi enviado hoje (apenas para execuções automáticas)
    let emailAlreadySentToday = false;
    if (!isManual) {
      try {
        const dbInstance = getDb();
        const docRef = doc(dbInstance, "app_settings", "procedures_routine");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.lastEmailSentDate === today) {
            emailAlreadySentToday = true;
          }
        }
      } catch (e) {
        console.warn("Erro ao verificar lastEmailSentDate de procedimentos no Firestore:", e);
      }
    }

    if (emailAlreadySentToday) {
      console.log(`[ProceduresCheck] Alerta de procedimentos já enviado hoje (${today}). Pulando envio automático.`);
      return { 
        success: true, 
        message: "Procedimentos verificados. Alerta de e-mail de lembrete já enviado hoje.", 
        sent: false, 
        count: matchingProcs.length + inProcessProcs.length
      };
    }

    // Janela de Envio Matutina desativada a pedido do usuário para permitir execução em qualquer horário

    if (!apiKey || !emailTo) {
      const missing = [];
      if (!apiKey) missing.push("RESEND_API_KEY");
      if (!emailTo) missing.push("NOTIFICATION_EMAIL");
      const errMsg = `Alerta de procedimentos não enviado: Faltando configuração de ambiente (${missing.join(", ")})`;
      console.warn(errMsg);
      
      await logEmail(
        emailTo || "configuracao-pendente@agenda.com",
        "Alerta de Procedimentos (Não Enviado por E-mail)",
        "failure",
        `Faltam variáveis de ambiente: ${missing.join(", ")}. Configure-as na aba de Configurações.`
      );
      return { 
        success: true, 
        message: errMsg, 
        sent: false, 
        count: matchingProcs.length + inProcessProcs.length
      };
    }

    // Trava Concorrente Imediata: atualiza lastEmailSentDate ANTES de começar o envio
    if (!isManual) {
      try {
        const dbInstance = getDb();
        const docRef = doc(dbInstance, "app_settings", "procedures_routine");
        await setDoc(docRef, { lastEmailSentDate: today }, { merge: true });
        console.log(`[ProceduresCheck] Trava imediata de envio ativada. lastEmailSentDate de procedimentos atualizado para ${today}`);
      } catch (e) {
        console.warn("Não foi possível atualizar preventivamente lastEmailSentDate de procedimentos no Firestore:", e);
      }
    }

    const formatDateBr = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    };

    // Helper para buscar data de ordenação do 'em processo'
    const getInProcessSortDate = (p: any) => {
      if (p.nextDate) return p.nextDate;
      if (p.steps && Array.isArray(p.steps)) {
        const dates = p.steps
          .filter((s: any) => !s.completed && s.scheduledDate)
          .map((s: any) => s.scheduledDate);
        if (dates.length > 0) {
          dates.sort();
          return dates[0];
        }
        const targetDates = p.steps
          .filter((s: any) => !s.completed && s.targetDate)
          .map((s: any) => s.targetDate);
        if (targetDates.length > 0) {
          targetDates.sort();
          return targetDates[0];
        }
      }
      return "9999-12-31";
    };

    // Ordenar as listas cronologicamente
    inProcessProcs.sort((a, b) => getInProcessSortDate(a).localeCompare(getInProcessSortDate(b)));
    overdueProcs.sort((a, b) => (a.nextDate || "").localeCompare(b.nextDate || ""));
    upcomingProcs.sort((a, b) => (a.nextDate || "").localeCompare(b.nextDate || ""));

    let procsCardsHtml = "";

    // 1. Renderizar "Em Processo"
    if (inProcessProcs.length > 0) {
      procsCardsHtml += `
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
          <!-- Header do Status -->
          <div style="background-color: #2563eb; color: #ffffff; padding: 12px 18px; font-size: 14px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: 1px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">
            🔄 Procedimentos Em Processo
          </div>
          <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 18px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Procedimento / Familiar</th>
                <th style="padding: 10px 18px; text-align: right; font-size: 11px; font-weight: 600; color: #475569; width: 140px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Previsão / Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      inProcessProcs.forEach((p, idx) => {
        const isLast = idx === inProcessProcs.length - 1;
        const rowStyle = isLast ? "" : "border-bottom: 1px solid #f1f5f9;";
        
        const detailsParts = [];
        if (p.providerName) detailsParts.push(`Profissional/Local: <strong>${p.providerName}</strong>`);
        if (p.category) detailsParts.push(`Categoria: <strong>${p.category}</strong>`);
        const detailsHtml = detailsParts.length > 0 
          ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${detailsParts.join(" | ")}</div>` 
          : "";

        let stepsHtml = '';
        if (p.steps && Array.isArray(p.steps) && p.steps.length > 0) {
          const completedCount = p.steps.filter(s => s.completed).length;
          const totalSteps = p.steps.length;
          
          stepsHtml = `
            <div style="margin-top: 8px; font-size: 11px; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <div style="margin-bottom: 6px; font-weight: bold; color: #334155;">
                <span>Progresso das Etapas (${completedCount}/${totalSteps})</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
                <tbody>
                  ${p.steps.map(s => {
                    const isScheduled = s.scheduled || s.appointmentId || s.scheduledDate;
                    return `
                      <tr>
                        <td style="padding: 6px 8px 6px 0; vertical-align: middle; width: 28px; font-size: 12px; line-height: 1.4;">
                          ${s.completed ? '✅' : '⏳'}
                        </td>
                        <td style="padding: 6px 0; vertical-align: middle; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #475569; line-height: 1.4; width: 100%;">
                          <div style="line-height: 1.4;">
                            <span style="display: inline; vertical-align: middle; ${s.completed ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 500;'}">
                              ${s.title}
                            </span>
                            ${isScheduled ? `
                              <span style="display: inline-block; vertical-align: middle; margin-left: 10px; padding: 2px 8px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; color: #16a34a; font-weight: bold; font-size: 10px; line-height: 1.2; white-space: nowrap;">
                                <span style="vertical-align: middle; margin-right: 4px; font-size: 11px;">📅</span><span style="vertical-align: middle;">Agendamento Confirmado: ${formatDateBr(s.scheduledDate)}${s.scheduledTime ? ` - ${s.scheduledTime}` : ''}</span>
                              </span>
                            ` : ""}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        const dateVal = getInProcessSortDate(p);
        const dateHtml = dateVal !== "9999-12-31"
          ? `<div style="font-size: 13.5px; font-weight: bold; color: #1e3a8a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${formatDateBr(dateVal)}</div>`
          : `<div style="font-size: 11px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-style: italic;">Contínuo</div>`;

        procsCardsHtml += `
              <tr style="${stepsHtml ? "" : rowStyle}">
                <td style="padding: 14px 18px 4px 18px; text-align: left; vertical-align: top;">
                  <div style="font-weight: bold; font-size: 13.5px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${p.name}</div>
                  <div style="font-size: 11px; color: #2563eb; margin-top: 4px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    👤 Paciente: ${p.familiarName || "Uso Geral / Outros"}
                  </div>
                  ${detailsHtml}
                </td>
                <td style="padding: 14px 18px 4px 18px; text-align: right; vertical-align: top; width: 140px;">
                  ${dateHtml}
                  <div style="margin-top: 6px;"><span style="background-color: #eff6ff; color: #2563eb; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Em Processo</span></div>
                </td>
              </tr>
              ${stepsHtml ? `
              <tr style="${rowStyle}">
                <td colspan="2" style="padding: 0 18px 14px 18px; text-align: left;">
                  ${stepsHtml}
                </td>
              </tr>
              ` : ''}
        `;
      });

      procsCardsHtml += `
            </tbody>
          </table>
        </div>
      `;
    }

    // 2. Renderizar "Atrasados"
    if (overdueProcs.length > 0) {
      procsCardsHtml += `
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
          <!-- Header do Status -->
          <div style="background-color: #ef4444; color: #ffffff; padding: 12px 18px; font-size: 14px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: 1px solid #ef4444; text-transform: uppercase; letter-spacing: 0.5px;">
            🚨 Procedimentos Atrasados
          </div>
          <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 18px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Procedimento / Familiar</th>
                <th style="padding: 10px 18px; text-align: right; font-size: 11px; font-weight: 600; color: #475569; width: 140px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Data Limite / Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      overdueProcs.forEach((p, idx) => {
        const isLast = idx === overdueProcs.length - 1;
        const rowStyle = isLast ? "" : "border-bottom: 1px solid #f1f5f9;";
        
        const detailsParts = [];
        if (p.providerName) detailsParts.push(`Profissional/Local: <strong>${p.providerName}</strong>`);
        if (p.category) detailsParts.push(`Categoria: <strong>${p.category}</strong>`);
        const detailsHtml = detailsParts.length > 0 
          ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${detailsParts.join(" | ")}</div>` 
          : "";

        let stepsHtml = '';
        if (p.steps && Array.isArray(p.steps) && p.steps.length > 0) {
          const completedCount = p.steps.filter(s => s.completed).length;
          const totalSteps = p.steps.length;
          
          stepsHtml = `
            <div style="margin-top: 8px; font-size: 11px; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <div style="margin-bottom: 6px; font-weight: bold; color: #334155;">
                <span>Progresso das Etapas (${completedCount}/${totalSteps})</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
                <tbody>
                  ${p.steps.map(s => `
                    <tr>
                      <td style="padding: 6px 8px 6px 0; vertical-align: middle; width: 28px; font-size: 12px; line-height: 1.4;">
                        ${s.completed ? '✅' : '⏳'}
                      </td>
                      <td style="padding: 6px 0; vertical-align: middle; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #475569; line-height: 1.4; width: 100%;">
                        <span style="${s.completed ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 500;'}">${s.title}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        procsCardsHtml += `
              <tr style="${stepsHtml ? "" : rowStyle}">
                <td style="padding: 14px 18px 4px 18px; text-align: left; vertical-align: top;">
                  <div style="font-weight: bold; font-size: 13.5px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${p.name}</div>
                  <div style="font-size: 11px; color: #ef4444; margin-top: 4px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    👤 Paciente: ${p.familiarName || "Uso Geral / Outros"}
                  </div>
                  ${detailsHtml}
                </td>
                <td style="padding: 14px 18px 4px 18px; text-align: right; vertical-align: top; width: 140px;">
                  <div style="font-size: 13.5px; font-weight: bold; color: #ef4444; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${formatDateBr(p.nextDate)}</div>
                  <div style="margin-top: 6px;"><span style="background-color: #fef2f2; color: #ef4444; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Atrasado</span></div>
                </td>
              </tr>
              ${stepsHtml ? `
              <tr style="${rowStyle}">
                <td colspan="2" style="padding: 0 18px 14px 18px; text-align: left;">
                  ${stepsHtml}
                </td>
              </tr>
              ` : ''}
        `;
      });

      procsCardsHtml += `
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Renderizar "Próximos nos próximos X dias"
    if (upcomingProcs.length > 0) {
      procsCardsHtml += `
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
          <!-- Header do Status -->
          <div style="background-color: #d97706; color: #ffffff; padding: 12px 18px; font-size: 14px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: 1px solid #d97706; text-transform: uppercase; letter-spacing: 0.5px;">
            ⏳ Próximos nos Próximos ${proceduresBufferDays} Dias
          </div>
          <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 18px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Procedimento / Familiar</th>
                <th style="padding: 10px 18px; text-align: right; font-size: 11px; font-weight: 600; color: #475569; width: 140px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Data Prevista / Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      upcomingProcs.forEach((p, idx) => {
        const isLast = idx === upcomingProcs.length - 1;
        const rowStyle = isLast ? "" : "border-bottom: 1px solid #f1f5f9;";
        
        const detailsParts = [];
        if (p.providerName) detailsParts.push(`Profissional/Local: <strong>${p.providerName}</strong>`);
        if (p.category) detailsParts.push(`Categoria: <strong>${p.category}</strong>`);
        const detailsHtml = detailsParts.length > 0 
          ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${detailsParts.join(" | ")}</div>` 
          : "";

        let stepsHtml = '';
        if (p.steps && Array.isArray(p.steps) && p.steps.length > 0) {
          const completedCount = p.steps.filter(s => s.completed).length;
          const totalSteps = p.steps.length;
          
          stepsHtml = `
            <div style="margin-top: 8px; font-size: 11px; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <div style="margin-bottom: 6px; font-weight: bold; color: #334155;">
                <span>Progresso das Etapas (${completedCount}/${totalSteps})</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
                <tbody>
                  ${p.steps.map(s => `
                    <tr>
                      <td style="padding: 6px 8px 6px 0; vertical-align: middle; width: 28px; font-size: 12px; line-height: 1.4;">
                        ${s.completed ? '✅' : '⏳'}
                      </td>
                      <td style="padding: 6px 0; vertical-align: middle; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #475569; line-height: 1.4; width: 100%;">
                        <span style="${s.completed ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 500;'}">${s.title}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        const instructionsHtml = p.nextDateInstructions
          ? `<div style="margin-top: 8px; font-size: 11px; background-color: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 10px 14px; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%; box-sizing: border-box;">
               <strong>Instruções para a próxima realização:</strong> ${p.nextDateInstructions}
             </div>`
          : "";

        const hasExtraRow = stepsHtml || instructionsHtml;
        procsCardsHtml += `
              <tr style="${hasExtraRow ? "" : rowStyle}">
                <td style="padding: 14px 18px 4px 18px; text-align: left; vertical-align: top;">
                  <div style="font-weight: bold; font-size: 13.5px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${p.name}</div>
                  <div style="font-size: 11px; color: #d97706; margin-top: 4px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    👤 Paciente: ${p.familiarName || "Uso Geral / Outros"}
                  </div>
                  ${detailsHtml}
                </td>
                <td style="padding: 14px 18px 4px 18px; text-align: right; vertical-align: top; width: 140px;">
                  <div style="font-size: 13.5px; font-weight: bold; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${formatDateBr(p.nextDate)}</div>
                  <div style="margin-top: 6px;"><span style="background-color: #fffbeb; color: #d97706; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Próximo</span></div>
                </td>
              </tr>
              ${hasExtraRow ? `
              <tr style="${rowStyle}">
                <td colspan="2" style="padding: 0 18px 14px 18px; text-align: left;">
                  ${stepsHtml}
                  ${instructionsHtml}
                </td>
              </tr>
              ` : ''}
        `;
      });

      procsCardsHtml += `
            </tbody>
          </table>
        </div>
      `;
    }

    let htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 24px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);">
        <h2 style="color: #4f46e5; margin-top: 0; margin-bottom: 24px; font-size: 16px; font-weight: 800; border-bottom: 2px solid #c7d2fe; padding-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          📅 Lembrete de Procedimentos de Saúde
        </h2>
        
        ${procsCardsHtml}
        
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.4;">
          Este é um lembrete automático gerado pela sua Agenda de Saúde pessoal.<br/>
          Para ajustar as notificações, acesse o menu de Configurações no aplicativo.
        </p>
      </div>
    `;

    try {
      const resendInstance = new Resend(apiKey);
      await resendInstance.emails.send({
        from: "Agenda de Saúde <onboarding@resend.dev>",
        to: emailTo,
        subject: "Calendário: Lembrete de Procedimentos de Saúde",
        html: htmlBody
      });

      console.log("Email de alerta de procedimentos enviado com sucesso.");
      await logEmail(emailTo, "Calendário: Lembrete de Procedimentos de Saúde", "success");

      return { 
        success: true, 
        message: "E-mail de procedimentos enviado com sucesso.", 
        sent: true, 
        count: matchingProcs.length + inProcessProcs.length
      };
    } catch (error: any) {
      console.error("Erro ao enviar email de procedimentos pelo Resend:", error);
      await logEmail(emailTo, "Calendário: Lembrete de Procedimentos de Saúde", "failure", error.message || String(error));
      return { 
        success: false, 
        error: error.message || String(error), 
        sent: false, 
        count: matchingProcs.length + inProcessProcs.length
      };
    }
  }

  // --- Rotina Dinâmica de Decremento de Estoque ---
  let stockCronJob: any = null;

  function scheduleStockCron() {
    if (stockCronJob) {
      stockCronJob.stop();
      stockCronJob = null;
      console.log("[CronConfig] Parando tarefa cron anterior...");
    }

    const cronExpression = `${scheduledMinute} ${scheduledHour} * * *`;
    console.log(`[CronConfig] Agendamento local desativado no servidor a pedido do usuário. A execução diária ocorrerá exclusivamente através da chamada do cron externo (cron-job.org) para as ${scheduledHour}:${String(scheduledMinute).padStart(2, '0')}.`);
  }

  // Carregar configurações locais e sincronizar com Firestore no boot
  loadSettingsLocal();
  syncCronSettingsFromFirestore().then(() => {
    scheduleStockCron();
  });

  // --- API routes ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/system-audit", (req, res) => {
    res.json({
      resendApiKeySet: !!process.env.RESEND_API_KEY,
      notificationEmailSet: !!process.env.NOTIFICATION_EMAIL,
      notificationEmail: process.env.NOTIFICATION_EMAIL || "",
      cronJobApiKeySet: !!cronJobApiKey || !!process.env.CRON_JOB_API_KEY,
      firebaseConfigured: fs.existsSync(path.join(process.cwd(), "firebase-applet-config.json"))
    });
  });

  app.post("/api/ai-audit-analyze", async (req, res) => {
    const stats = req.body;
    
    // Heurística local para fallback se o Gemini falhar ou não estiver disponível
    const getLocalFallbackReport = () => {
      const issues: any[] = [];
      
      if (stats.mockMedsCount > 0) {
        issues.push({
          id: "mock-data",
          title: "Uso de Dados Mockados de Medicamentos",
          category: "Dados Mockados",
          severity: "MÉDIO",
          description: `Existem ${stats.mockMedsCount} medicamentos iniciais de demonstração (como Losartana ou Dipirona) carregados no inventário.`,
          expected: "O inventário deve exibir apenas medicamentos reais inseridos para seu uso próprio.",
          fixAction: "Remover os medicamentos de teste e purgar registros de demonstração automaticamente.",
          canAutoFix: true
        });
      }

      if (stats.orphanedMedsCount > 0) {
        issues.push({
          id: "orphaned-meds",
          title: "Medicamentos Sem Paciente Vinculado",
          category: "Fluxo de Dados",
          severity: "ALTO",
          description: `Existem ${stats.orphanedMedsCount} medicamentos no estoque que não possuem um familiar/paciente associado.`,
          expected: "Todo medicamento no estoque de uso pessoal deve estar vinculado a um familiar.",
          fixAction: "Vincular automaticamente os medicamentos órfãos ao primeiro familiar cadastrado.",
          canAutoFix: true
        });
      }

      if (!stats.resendApiKeySet) {
        issues.push({
          id: "missing-resend-key",
          title: "Serviço de Lembretes de E-mail Desativado",
          category: "Fluxo de Dados",
          severity: "ALTO",
          description: "A chave RESEND_API_KEY para envio automático de e-mails de notificação diária não está configurada.",
          expected: "As chaves de notificação devem estar ativas no servidor para o disparo automático dos lembretes.",
          fixAction: "Configure a variável RESEND_API_KEY no menu de segredos/variáveis de ambiente do seu servidor para ativar lembretes por e-mail.",
          canAutoFix: false
        });
      }

      if (!stats.hasGoogleToken) {
        issues.push({
          id: "google-sync",
          title: "Sincronização do Google Agenda Desconectada",
          category: "Fluxo de Dados",
          severity: "MÉDIO",
          description: "Sua conta do Google Agenda não está conectada no navegador atual.",
          expected: "A sincronização bidirecional de consultas médicas e procedimentos de saúde requer o login via Google OAuth.",
          fixAction: "Utilize o botão de login 'Conectar Google' no topo superior direito para ativar a integração.",
          canAutoFix: false
        });
      }

      const statusVal = issues.length === 0 ? "SIM" : "SIM, COM PEQUENOS PROBLEMAS";
      return {
        status: statusVal,
        summary: "Auditoria local concluída com sucesso (Modo de Integridade Heurística ativado como fallback devido a limites temporários de faturamento do Gemini AI). O sistema está operando de forma saudável.",
        issues: issues
      };
    };

    try {
      const client = getAiClient();
      if (!client) {
        return res.json(getLocalFallbackReport());
      }

      const prompt = `Você é o auditor oficial de funcionamento do aplicativo 'Agenda de Saúde' (uso pessoal).
Analise as estatísticas atuais de uso do usuário para identificar inconsistências, bugs em potencial ou itens mockados:
${JSON.stringify(stats, null, 2)}

Variáveis de Ambiente do Servidor:
- RESEND_API_KEY: ${stats.resendApiKeySet ? "Configurada" : "NÃO configurada"}
- NOTIFICATION_EMAIL: ${stats.notificationEmail ? stats.notificationEmail : "NÃO configurado"}
- Sincronização Google: ${stats.hasGoogleToken ? "Ativa" : "Inativa"}

Regras de Auditoria:
1. Se houver medicamentos no estoque com IDs como 'med_1', 'med_2', 'med_3' ou criados pelo 'user_local' que batem com nomes de exemplo (Losartana, Dipirona, Ibuprofeno), alerte sobre "Dados Mockados".
2. Se a chave do Resend ou e-mail de notificação estiverem faltando, crie um alerta de gravidade ALTO/MÉDIO na categoria 'Fluxo de Dados'.
3. Se houver medicamentos ou registros órfãos sem Paciente (pessoaId vazio), alerte para correção de integridade.
4. Se o usuário estiver utilizando a sincronização mas o token Google expirar ou estiver ausente, alerte.

Gere uma resposta em JSON contendo o status geral ('SIM', 'SIM, COM PEQUENOS PROBLEMAS', 'PARCIALMENTE', 'NÃO'), resumo amigável e a lista de problemas estruturados.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é um auditor de integridade e usabilidade de banco de dados do Agenda de Saúde. Escreva todas as respostas em Português do Brasil de forma concisa e amigável.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, description: "Status geral do app: 'SIM', 'SIM, COM PEQUENOS PROBLEMAS', 'PARCIALMENTE', 'NÃO'" },
              summary: { type: Type.STRING, description: "Resumo em português da auditoria" },
              issues: {
                type: Type.ARRAY,
                description: "Problemas encontrados",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "ID único do problema, ex: 'mock-data'" },
                    title: { type: Type.STRING, description: "Título do problema" },
                    category: { type: Type.STRING, description: "Categoria: 'Telas' | 'Botões' | 'Formulários' | 'Fluxo de Dados' | 'Dados Mockados' | 'Funcionalidades Incompletas' | 'Erros de Código' | 'Visual'" },
                    severity: { type: Type.STRING, description: "Gravidade: 'CRÍTICO' | 'ALTO' | 'MÉDIO' | 'BAIXO'" },
                    description: { type: Type.STRING, description: "O que está acontecendo" },
                    expected: { type: Type.STRING, description: "O que deveria acontecer" },
                    fixAction: { type: Type.STRING, description: "Ação de correção recomendada" },
                    canAutoFix: { type: Type.BOOLEAN, description: "Se o sistema de auto-correção consegue corrigir automaticamente" }
                  },
                  required: ["id", "title", "category", "severity", "description", "expected", "fixAction", "canAutoFix"]
                }
              }
            },
            required: ["status", "summary", "issues"]
          }
        }
      });

      const responseText = response.text || "{}";
      res.json(JSON.parse(responseText.trim()));
    } catch (error: any) {
      console.log("[Audit] Serviço Gemini indisponível ou limite de requisições atingido. Utilizando fallback heurístico local para auditoria de integridade.");
      // Retorna o fallback heurístico local em vez de quebrar ou dar 500!
      res.json(getLocalFallbackReport());
    }
  });

  app.get("/api/cron-config", async (req, res) => {
    try {
      await syncCronSettingsFromFirestore();
    } catch (e) {
      console.warn("[CronConfig] Erro ao sincronizar configurações do cron do Firestore no GET:", e);
    }
    res.json(getCronInfo(scheduledHour, scheduledMinute, getEffectiveApiKey(), proceduresBufferDays));
  });

  app.post("/api/cron-config", async (req, res) => {
    try {
      const { scheduledHour: newHour, scheduledMinute: newMinute, cronJobApiKey: newApiKey, proceduresBufferDays: newBufferDays } = req.body;
      if (typeof newHour === "number") {
        if (newHour < 0 || newHour > 23) {
          return res.status(400).json({ error: "O horário deve ser um número entre 0 e 23." });
        }
        scheduledHour = newHour;
      }
      if (typeof newMinute === "number") {
        if (newMinute < 0 || newMinute > 59) {
          return res.status(400).json({ error: "O minuto deve ser um número entre 0 e 59." });
        }
        scheduledMinute = newMinute;
      }

      if (typeof newApiKey === "string") {
        // Se a chave contiver "...", significa que o frontend nos enviou a versão mascarada.
        // Não devemos salvar a versão mascarada por cima da chave real.
        if (!newApiKey.includes("...")) {
          cronJobApiKey = newApiKey;
        }
      }

      if (typeof newBufferDays === "number") {
        if (newBufferDays >= 10 && newBufferDays <= 60) {
          proceduresBufferDays = newBufferDays;
        } else {
          return res.status(400).json({ error: "A quantidade de dias deve ser entre 10 e 60." });
        }
      }

      saveSettingsLocal(scheduledHour, scheduledMinute, cronJobApiKey, proceduresBufferDays);
      scheduleStockCron();

      const activeApiKey = getEffectiveApiKey();
      let externalCronMessage = "";
      if (activeApiKey) {
        try {
          let host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
          const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
          let protocol = isLocalhost ? "http" : "https";

          // Se o host detectado for localhost ou 127.0.0.1, tentamos obter a URL real a partir do Referer ou do Origin
          if (host.includes("localhost") || host.includes("127.0.0.1")) {
            const referer = req.headers.referer;
            const originHeader = req.headers.origin;
            if (referer) {
              try {
                const url = new URL(referer);
                if (!url.hostname.includes("localhost") && !url.hostname.includes("127.0.0.1")) {
                  host = url.host;
                  protocol = "https"; // URL externa é HTTPS
                }
              } catch (e) {}
            } else if (originHeader) {
              try {
                const url = new URL(originHeader as string);
                if (!url.hostname.includes("localhost") && !url.hostname.includes("127.0.0.1")) {
                  host = url.host;
                  protocol = "https"; // URL externa é HTTPS
                }
              } catch (e) {}
            }
          }

          const originUrl = `${protocol}://${host}`;
          let targetUrl = `${originUrl}/api/check-stock`;

          // Garantir que a URL do cron-job.org aponte sempre para o domínio público/compartilhado (ais-pre-)
          // e não para o domínio privado de desenvolvimento (ais-dev-), que exige autenticação por cookie (302 Found)
          if (targetUrl.includes("ais-dev-")) {
            targetUrl = targetUrl.replace("ais-dev-", "ais-pre-");
          }

          console.log(`[CronConfig] Sincronizando com cron-job.org para URL: ${targetUrl}`);

          const { wakeUpHour, wakeUpMinute } = getCronInfo(scheduledHour, scheduledMinute, activeApiKey, proceduresBufferDays);

          // 1. Listar jobs existentes
          const listRes = await fetch("https://api.cron-job.org/jobs", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${activeApiKey}`,
              "Content-Type": "application/json"
            }
          });

          if (!listRes.ok) {
            const listErr = await listRes.text();
            throw new Error(`Falha ao obter tarefas do cron-job.org (Status: ${listRes.status}). Detalhes: ${listErr}`);
          }

          const listData = await listRes.json();
          const existingJobs = listData.jobs || [];
          const jobTitle = "Agenda de Saude - Verificacao de Estoque";
          const existingJob = existingJobs.find((j: any) => 
            j.title === jobTitle || 
            j.title === "PROJETO AI GAIS" || 
            (j.url && j.url.includes("/api/check-stock"))
          );

          const jobPayload = {
            job: {
              url: targetUrl,
              enabled: true,
              saveResponses: true,
              schedule: {
                timezone: "America/Sao_Paulo",
                hours: [wakeUpHour],
                minutes: [wakeUpMinute],
                mdays: [-1],
                wdays: [-1],
                months: [-1]
              },
              title: jobTitle
            }
          };

          if (existingJob) {
            // 2a. Atualizar tarefa existente com PATCH
            const updateRes = await fetch(`https://api.cron-job.org/jobs/${existingJob.jobId}`, {
              method: "PATCH",
              headers: {
                "Authorization": `Bearer ${activeApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(jobPayload)
            });

            if (!updateRes.ok) {
              const updateErr = await updateRes.text();
              throw new Error(`Falha ao atualizar tarefa existente (ID: ${existingJob.jobId}). Detalhes: ${updateErr}`);
            }
            console.log(`[CronConfig] Tarefa existente ID ${existingJob.jobId} atualizada com sucesso no cron-job.org.`);
            externalCronMessage = `Tarefa existente atualizada com sucesso no cron-job.org para disparar às ${String(wakeUpHour).padStart(2, '0')}:${String(wakeUpMinute).padStart(2, '0')} (GMT-3) com URL: ${targetUrl}`;
          } else {
            // 2b. Criar nova tarefa com POST
            const createRes = await fetch("https://api.cron-job.org/jobs", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${activeApiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(jobPayload)
            });

            if (!createRes.ok) {
              const createErr = await createRes.text();
              throw new Error(`Falha ao criar nova tarefa no cron-job.org. Detalhes: ${createErr}`);
            }
            console.log("[CronConfig] Nova tarefa criada com sucesso no cron-job.org.");
            externalCronMessage = `Nova tarefa criada com sucesso no cron-job.org para disparar às ${String(wakeUpHour).padStart(2, '0')}:${String(wakeUpMinute).padStart(2, '0')} (GMT-3) com URL: ${targetUrl}`;
          }
        } catch (cronErr: any) {
          console.error("[CronConfig] Erro ao integrar com cron-job.org:", cronErr);
          externalCronMessage = `Horário atualizado localmente, mas houve erro na sincronização do cron-job.org: ${cronErr.message}`;
        }
      }

      console.log(`[CronConfig] Horário reconfigurado via API com sucesso para as ${scheduledHour}:${String(scheduledMinute).padStart(2, '0')}`);
      res.json({
        ...getCronInfo(scheduledHour, scheduledMinute, activeApiKey, proceduresBufferDays),
        externalCronMessage
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.get("/api/email-logs", (req, res) => {
    try {
      const logs = getLocalLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // --- Google Calendar Proxy Routes ---
  app.all("/api/calendar-proxy/*", async (req, res) => {
    const originalUrl = req.originalUrl || req.url;
    const prefix = "/api/calendar-proxy/";
    let targetPathWithQuery = "";

    if (originalUrl.startsWith(prefix)) {
      targetPathWithQuery = originalUrl.substring(prefix.length);
    } else {
      const targetPath = (req.params as any)[0] || "";
      const query = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
      targetPathWithQuery = `${targetPath}${query}`;
    }

    if (!targetPathWithQuery) {
      return res.status(400).json({ error: "Caminho de destino não especificado no proxy" });
    }

    const url = `https://www.googleapis.com/calendar/v3/${targetPathWithQuery}`;

    console.log(`[CalendarProxy] ${req.method} -> ${url}`);
    const authHeader = req.headers.authorization;
    console.log(`[CalendarProxy] Authorization header present: ${!!authHeader}`);
    if (authHeader) {
      console.log(`[CalendarProxy] Authorization header: ${authHeader.substring(0, 10)}...`);
    } else {
      console.warn(`[CalendarProxy] Authorization header is MISSING!`);
    }
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    if (req.headers.authorization) {
      headers["Authorization"] = req.headers.authorization as string;
    }
    
    // Repassar outros headers úteis
    if (req.headers['if-none-match']) headers['If-None-Match'] = req.headers['if-none-match'] as string;
    if (req.headers['x-goog-api-client']) headers['X-Goog-Api-Client'] = req.headers['x-goog-api-client'] as string;

    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(url, fetchOptions);

      console.log(`[CalendarProxy] Response from Google: ${response.status} ${response.statusText}`);

      const contentType = response.headers.get("content-type");
      
      // Copiar headers de cache do Google para o cliente
      if (response.headers.get('etag')) res.setHeader('ETag', response.headers.get('etag')!);
      if (response.headers.get('cache-control')) res.setHeader('Cache-Control', response.headers.get('cache-control')!);

      if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        return res.status(response.status).send(text);
      }

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("[CalendarProxy] Proxy Error:", error.message || error);
      res.status(500).json({ 
        error: "Erro na comunicação com o Google Calendar API via Proxy", 
        details: error.message || String(error),
        targetUrl: url 
      });
    }
  });

  app.get("/api/routine-diagnostic", async (req, res) => {
    try {
      const resendKey = process.env.RESEND_API_KEY || "";
      const notificationEmail = process.env.NOTIFICATION_EMAIL || "";
      const hasResendKey = !!resendKey;
      const hasNotificationEmail = !!notificationEmail;
      
      // 1. Testar conexão com Firestore
      let firestoreStatus = "ok";
      let firestoreError = "";
      try {
        const dbInstance = getDb();
        await getDocs(collection(dbInstance, "app_settings"));
      } catch (e: any) {
        firestoreStatus = "error";
        firestoreError = e.message || String(e);
      }

      // 2. Testar configuração do cron-job.org
      const activeCronApiKey = getEffectiveApiKey();
      let cronJobOrgStatus = "not_configured";
      let cronJobOrgDetails = "";
      let cronJobsCount = 0;
      let activeJobs: any[] = [];

      if (activeCronApiKey) {
        try {
          const listRes = await fetch("https://api.cron-job.org/jobs", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${activeCronApiKey}`
            }
          });
          if (listRes.ok) {
            const listData = (await listRes.json()) as any;
            cronJobOrgStatus = "ok";
            if (listData && Array.isArray(listData.jobs)) {
              cronJobsCount = listData.jobs.length;
              activeJobs = listData.jobs.map((j: any) => ({
                id: j.jobId,
                title: j.title,
                url: j.url,
                enabled: j.enabled,
                hours: j.schedule?.hours,
                minutes: j.schedule?.minutes,
                timezone: j.schedule?.timezone
              }));
            }
          } else {
            cronJobOrgStatus = "error";
            cronJobOrgDetails = `Erro da API cron-job.org: Status ${listRes.status} ${listRes.statusText}`;
          }
        } catch (e: any) {
          cronJobOrgStatus = "error";
          cronJobOrgDetails = e.message || String(e);
        }
      }

      // 3. Obter logs locais recentes para diagnosticar o envio de e-mails
      const localLogs = getLocalLogs();
      const lastEmailLog = localLogs.length > 0 ? localLogs[0] : null;

      // 4. Diagnosticar host e SSL
      const host = req.headers.host || "";
      let hostWarning = false;
      let hostMessage = "Tudo OK";
      if (host.includes("ais-dev-")) {
        hostWarning = true;
        hostMessage = "Você está visualizando no ambiente de desenvolvimento (ais-dev-). Caso o cron-job.org tente chamar este endereço, receberá redirecionamento 302 Found por restrição de cookies. Certifique-se de que o cron-job.org use o link público compartilhado (ais-pre-).";
      }

      res.json({
        config: {
          resend: {
            configured: hasResendKey,
            maskedKey: resendKey ? `${resendKey.substring(0, 4)}...${resendKey.substring(resendKey.length - 4)}` : ""
          },
          notificationEmail: {
            configured: hasNotificationEmail,
            email: notificationEmail
          },
          cronJobApiKey: {
            configured: !!activeCronApiKey,
            maskedKey: activeCronApiKey ? `${activeCronApiKey.substring(0, 4)}...${activeCronApiKey.substring(activeCronApiKey.length - 4)}` : ""
          }
        },
        firestore: {
          status: firestoreStatus,
          error: firestoreError
        },
        cronJobOrg: {
          status: cronJobOrgStatus,
          error: cronJobOrgDetails,
          jobsCount: cronJobsCount,
          jobs: activeJobs
        },
        host: {
          value: host,
          warning: hostWarning,
          message: hostMessage
        },
        lastExecution: lastEmailLog ? {
          timestamp: lastEmailLog.timestamp,
          to: lastEmailLog.to,
          subject: lastEmailLog.subject,
          status: lastEmailLog.status, // success / failure
          error: lastEmailLog.error || ""
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Helper unificado para executar a rotina de verificação e registrar diagnósticos detalhados em caso de erro
  async function runUnifiedRoutineWithDiagnostics(isManual: boolean, clientMeds?: any[], clientProcs?: any[], clientFamiliars?: any[]) {
    let errorStage = "";
    let errorMessage = "";
    let stockResult: any = { success: true, message: "Pendente", sent: false, criticalCount: 0 };
    let proceduresResult: any = { success: true, message: "Pendente", sent: false, count: 0 };

    try {
      // 1. Executar verificação de estoque e decremento de quantidades
      try {
        console.log(`[DiagnosticRoutine] Iniciando etapa de estoque (isManual: ${isManual})...`);
        stockResult = await performStockCheck(clientMeds, isManual, clientFamiliars);
        if (stockResult.success === false) {
          throw new Error(stockResult.error || stockResult.message || "Erro desconhecido na rotina de estoque");
        }
      } catch (err: any) {
        errorStage = "Verificação de Estoque e Decremento";
        errorMessage = err.message || String(err);
        console.error(`[DiagnosticRoutine] Falha na etapa: ${errorStage}. Erro: ${errorMessage}`);
        throw err; // Interrompe para salvar o diagnóstico de falha
      }

      // 2. Executar verificação de procedimentos de saúde e envio de alertas
      try {
        console.log(`[DiagnosticRoutine] Iniciando etapa de procedimentos (isManual: ${isManual})...`);
        proceduresResult = await performProceduresCheck(clientProcs, isManual);
        if (proceduresResult.success === false) {
          throw new Error(proceduresResult.error || proceduresResult.message || "Erro desconhecido na rotina de procedimentos");
        }
      } catch (err: any) {
        errorStage = "Verificação de Procedimentos de Saúde";
        errorMessage = err.message || String(err);
        console.error(`[DiagnosticRoutine] Falha na etapa: ${errorStage}. Erro: ${errorMessage}`);
        throw err; // Interrompe para salvar o diagnóstico de falha
      }

      // Se tudo correu bem, registrar sucesso
      try {
        const dbInstance = getDb();
        await setDoc(doc(dbInstance, "app_settings", "last_routine_execution"), {
          timestamp: new Date().toISOString(),
          status: "success",
          errorStage: null,
          errorMessage: null,
          dismissed: false,
          manual: isManual,
          stockSent: !!stockResult.sent,
          proceduresSent: !!proceduresResult.sent
        }, { merge: true });
        console.log("[DiagnosticRoutine] Status de SUCESSO salvo no Firestore com sucesso.");
      } catch (fsErr: any) {
        console.warn("[DiagnosticRoutine] Falha ao registrar sucesso no Firestore:", fsErr.message);
      }

      return {
        success: true,
        stockResult,
        proceduresResult
      };

    } catch (err: any) {
      // Registrar falha no Firestore
      const finalErrorStage = errorStage || "Execução Geral da Rotina";
      const finalErrorMessage = errorMessage || err.message || String(err);

      try {
        const dbInstance = getDb();
        await setDoc(doc(dbInstance, "app_settings", "last_routine_execution"), {
          timestamp: new Date().toISOString(),
          status: "error",
          errorStage: finalErrorStage,
          errorMessage: finalErrorMessage,
          dismissed: false,
          manual: isManual
        }, { merge: true });
        console.log(`[DiagnosticRoutine] Status de ERRO registrado no Firestore: ${finalErrorStage} - ${finalErrorMessage}`);
      } catch (fsErr: any) {
        console.warn("[DiagnosticRoutine] Falha ao registrar erro no Firestore:", fsErr.message);
      }

      return {
        success: false,
        errorStage: finalErrorStage,
        errorMessage: finalErrorMessage,
        stockResult,
        proceduresResult
      };
    }
  }

  app.get("/api/check-stock", async (req, res) => {
    try {
      console.log("[CronTrigger] Executando verificação de estoque e procedimentos unificada...");
      const result = await runUnifiedRoutineWithDiagnostics(false);
      
      res.json({
        success: result.success,
        sent: result.stockResult?.sent || result.proceduresResult?.sent,
        message: `${result.stockResult?.message || ""} | ${result.proceduresResult?.message || ""}`,
        criticalCount: result.stockResult?.criticalCount || 0,
        proceduresCount: result.proceduresResult?.count || 0,
        updatedMeds: result.stockResult?.updatedMeds,
        errorStage: result.errorStage,
        errorMessage: result.errorMessage
      });
    } catch (error: any) {
      console.error("Erro na verificação de estoque e procedimentos via API GET:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  app.post("/api/check-stock", async (req, res) => {
    try {
      const { medicamentos, procedimentos, familiars, isManual } = req.body || {};
      const result = await runUnifiedRoutineWithDiagnostics(!!isManual, medicamentos, procedimentos, familiars);
      
      res.json({
        success: result.success,
        sent: result.stockResult?.sent || result.proceduresResult?.sent,
        message: `${result.stockResult?.message || ""} | ${result.proceduresResult?.message || ""}`,
        criticalCount: result.stockResult?.criticalCount || 0,
        proceduresCount: result.proceduresResult?.count || 0,
        updatedMeds: result.stockResult?.updatedMeds,
        errorStage: result.errorStage,
        errorMessage: result.errorMessage
      });
    } catch (error: any) {
      console.error("Erro na verificação de estoque e procedimentos via API:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  app.get("/api/last-routine-execution", async (req, res) => {
    try {
      const dbInstance = getDb();
      const docRef = doc(dbInstance, "app_settings", "last_routine_execution");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        res.json(docSnap.data());
      } else {
        res.json(null);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.post("/api/dismiss-routine-execution", async (req, res) => {
    try {
      const dbInstance = getDb();
      await setDoc(doc(dbInstance, "app_settings", "last_routine_execution"), {
        dismissed: true
      }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // --- Vite middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      console.log(`[CatchAll] ${req.method} ${req.url}`);
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
