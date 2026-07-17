import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, orderBy, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Settings, Layers, Globe, Mail, Clock, AlertCircle, CheckCircle, Download, Upload, Database, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, Wrench, Sparkles, Trash2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  syncMedicamentosToFirestore, 
  syncProceduresToFirestore,
  syncFamiliarsToFirestore,
  syncTratamentosToFirestore
} from '../utils/firebaseSync';

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: 'success' | 'failure';
  error?: string;
  timestamp: any;
}

function getTimestampMs(timestamp: any): number {
  if (!timestamp) return 0;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  const seconds = timestamp.seconds !== undefined ? timestamp.seconds : timestamp._seconds;
  if (seconds !== undefined) {
    return seconds * 1000;
  }
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  return 0;
}

function formatLogDate(timestamp: any): string {
  if (!timestamp) return '';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleString();
  }
  const seconds = timestamp.seconds !== undefined ? timestamp.seconds : timestamp._seconds;
  if (seconds !== undefined) {
    return new Date(seconds * 1000).toLocaleString();
  }
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }
  return '';
}

export default function ConfiguracoesView({ 
  user, 
  timezone, 
  selectedCalendarId, 
  calendars, 
  handleCalendarChange,
  autoSyncEnabled,
  setAutoSyncEnabled,
  autoSyncInterval,
  setAutoSyncInterval,
  medicamentos = [],
  onSaveMedicamentos,
  procedures = [],
  onSaveProcedures,
  familiars = [],
  onSaveFamiliars,
  tratamentos = [],
  onSaveTratamentos,
  isSyncing,
  onRefresh,
  proceduresBufferDays = 15,
  onSaveProceduresBufferDays
}: any) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 5;

  const [inputBufferDays, setInputBufferDays] = useState<number>(proceduresBufferDays);

  useEffect(() => {
    setInputBufferDays(proceduresBufferDays);
  }, [proceduresBufferDays]);

  const totalPages = Math.ceil(logs.length / logsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const startIndex = (safeCurrentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentLogs = logs.slice(startIndex, endIndex);

  const [checkingStock, setCheckingStock] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info'; title: string; desc: string } | null>(null);
  
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [scheduledHour, setScheduledHour] = useState<number>(14);
  const [scheduledMinute, setScheduledMinute] = useState<number>(0);
  const [cronJobApiKey, setCronJobApiKey] = useState<string>("");
  const [cronInfo, setCronInfo] = useState<any>(null);
  const [savingHour, setSavingHour] = useState(false);

  // Diagnostic state variables
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);

  // Audit state variables
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCronConfig = async () => {
      try {
        const res = await fetch('/api/cron-config');
        if (res.ok) {
          const data = await res.json();
          setScheduledHour(data.scheduledHour);
          if (typeof data.scheduledMinute === 'number') {
            setScheduledMinute(data.scheduledMinute);
          }
          setCronInfo(data);
          
          let apiKeyToUse = "";
          if (data.hasCronJobApiKey) {
            apiKeyToUse = data.cronJobApiKeyMasked || "";
            setCronJobApiKey(apiKeyToUse);
          } else {
            // Se o servidor não tem, tentamos ler do Firestore de forma segura (já que o frontend está autenticado!)
            try {
              const { getDoc } = await import('firebase/firestore');
              const secretsDocRef = doc(db, "app_settings", "stock_routine_secrets");
              const secretsSnap = await getDoc(secretsDocRef);
              if (secretsSnap.exists()) {
                const secData = secretsSnap.data();
                if (secData.cronJobApiKey) {
                  const key = secData.cronJobApiKey;
                  apiKeyToUse = key;
                  setCronJobApiKey(`${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
                  
                  // Envia para o servidor via POST silencioso para carregar a memória do servidor
                  fetch('/api/cron-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      scheduledHour: data.scheduledHour,
                      scheduledMinute: typeof data.scheduledMinute === 'number' ? data.scheduledMinute : 0,
                      cronJobApiKey: key,
                      proceduresBufferDays: data.proceduresBufferDays || 15
                    })
                  }).then(async (postRes) => {
                    if (postRes.ok) {
                      const postData = await postRes.json();
                      setCronInfo(postData);
                    }
                  }).catch(() => {});
                }
              }
            } catch (fireErr) {
              console.warn("Não foi possível carregar segredos do Firestore:", fireErr);
            }
          }
          
          if (typeof data.proceduresBufferDays === 'number') {
            setInputBufferDays(data.proceduresBufferDays);
            if (onSaveProceduresBufferDays) {
              onSaveProceduresBufferDays(data.proceduresBufferDays);
            }
          }
        }
      } catch (e) {
        console.error("Erro ao carregar configurações de cron:", e);
      }
    };
    fetchCronConfig();
  }, []);

  const handleSaveCronHour = async (hour: number, minute: number) => {
    setSavingHour(true);
    setStatusMessage(null);
    try {
      // 1. Salva no Firestore
      try {
        const docRef = doc(db, "app_settings", "stock_routine");
        await setDoc(docRef, { 
          scheduledHour: hour, 
          scheduledMinute: minute,
          proceduresBufferDays: inputBufferDays,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.email || 'unknown'
        }, { merge: true });

        // Salva a chave de API de forma segura separadamente apenas se ela não estiver mascarada
        if (cronJobApiKey && !cronJobApiKey.includes("...")) {
          const secretsDocRef = doc(db, "app_settings", "stock_routine_secrets");
          await setDoc(secretsDocRef, {
            cronJobApiKey: cronJobApiKey,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || 'unknown'
          });
        }
        console.log("Horário salvo no Firestore com sucesso.");
      } catch (dbErr) {
        console.warn("Aviso: Falha ao salvar no Firestore, continuando com a API do servidor:", dbErr);
      }

      // 2. Salva no servidor via API
      const response = await fetch('/api/cron-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          scheduledHour: hour,
          scheduledMinute: minute,
          cronJobApiKey: cronJobApiKey,
          proceduresBufferDays: inputBufferDays
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCronInfo(data);
        if (onSaveProceduresBufferDays) {
          onSaveProceduresBufferDays(inputBufferDays);
        }
        const timeFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        setStatusMessage({
          type: 'success',
          title: 'Configuração Atualizada',
          desc: data.externalCronMessage 
            ? `O horário da rotina foi alterado para as ${timeFormatted}! ${data.externalCronMessage}`
            : `O horário da rotina foi alterado com sucesso para as ${timeFormatted}!`
        });
      } else {
        throw new Error("Erro ao atualizar o horário no servidor.");
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'info',
        title: 'Erro ao Salvar',
        desc: err.message || 'Não foi possível atualizar o horário no servidor.'
      });
    } finally {
      setSavingHour(false);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticResult(null);
    try {
      const res = await fetch('/api/routine-diagnostic');
      if (res.ok) {
        const data = await res.json();
        setDiagnosticResult(data);
      } else {
        throw new Error(`Erro do servidor ao obter diagnóstico: Status ${res.status}`);
      }
    } catch (err: any) {
      console.error("Erro ao rodar diagnóstico:", err);
      setDiagnosticResult({
        error: err.message || String(err)
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setAuditMessage("Iniciando auditoria de integridade completa...");
    setAuditResult(null);

    try {
      // 1. Obter status do sistema do servidor
      setAuditMessage("Verificando chaves de API do servidor...");
      let systemAudit = {
        resendApiKeySet: false,
        notificationEmailSet: false,
        notificationEmail: "",
        cronJobApiKeySet: false,
        firebaseConfigured: false
      };
      try {
        const sysRes = await fetch('/api/system-audit');
        if (sysRes.ok) {
          systemAudit = await sysRes.json();
        }
      } catch (sysErr) {
        console.warn("Erro ao obter auditoria do sistema:", sysErr);
      }

      // 2. Executar validações locais
      setAuditMessage("Analisando registros locais do banco de dados...");
      const mockMeds = medicamentos.filter((m: any) => 
        m.id === 'med_1' || m.id === 'med_2' || m.id === 'med_3' || 
        m.ownerId === 'user_local' || 
        ['losartana potássica', 'losartana', 'dipirona sódica', 'dipirona', 'ibuprofeno'].includes(m.nome.toLowerCase())
      );
      const orphanedMeds = medicamentos.filter((m: any) => !m.pessoaId);
      const invalidProcedures = procedures.filter((p: any) => 
        !p.frequencyValue || p.frequencyValue <= 0 || !p.frequencyUnit
      );
      const googleToken = localStorage.getItem('google_access_token');

      // Compilar estatísticas para o Gemini
      const stats = {
        medCount: medicamentos.length,
        procCount: procedures.length,
        famCount: familiars.length,
        tratCount: tratamentos.length,
        mockMedsCount: mockMeds.length,
        orphanedMedsCount: orphanedMeds.length,
        invalidProceduresCount: invalidProcedures.length,
        hasGoogleToken: !!googleToken,
        resendApiKeySet: systemAudit.resendApiKeySet,
        notificationEmail: systemAudit.notificationEmail,
        cronJobApiKeySet: systemAudit.cronJobApiKeySet,
        firebaseConfigured: systemAudit.firebaseConfigured
      };

      setAuditMessage("Invocando Inteligência Artificial (Gemini 3.5 Flash) para auditoria...");
      const aiRes = await fetch('/api/ai-audit-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stats)
      });

      let finalResult = {
        status: "SIM, COM PEQUENOS PROBLEMAS",
        summary: "Auditoria local e de rede concluída.",
        issues: [] as any[]
      };

      if (aiRes.ok) {
        finalResult = await aiRes.json();
      } else {
        // Fallback local se o servidor de IA falhar ou estiver offline
        const fallbackIssues = [];
        if (mockMeds.length > 0) {
          fallbackIssues.push({
            id: "mock-data",
            title: "Uso de Dados Mockados de Medicamentos",
            category: "Dados Mockados",
            severity: "MÉDIO",
            description: `Existem ${mockMeds.length} medicamentos iniciais de demonstração (como Losartana, Dipirona) carregados no inventário.`,
            expected: "O inventário deve exibir apenas medicamentos reais inseridos por você.",
            fixAction: "Remover os medicamentos de teste e purgar registros mockados.",
            canAutoFix: true
          });
        }
        if (orphanedMeds.length > 0) {
          fallbackIssues.push({
            id: "orphaned-meds",
            title: "Medicamentos Sem Paciente Vinculado",
            category: "Fluxo de Dados",
            severity: "ALTO",
            description: `Existem ${orphanedMeds.length} medicamentos no estoque que estão órfãos de paciente (campo Paciente vazio).`,
            expected: "Todo medicamento de uso pessoal deve estar vinculado a um familiar/paciente.",
            fixAction: "Vincular automaticamente os medicamentos órfãos ao primeiro familiar cadastrado.",
            canAutoFix: true
          });
        }
        if (!systemAudit.resendApiKeySet) {
          fallbackIssues.push({
            id: "missing-resend-key",
            title: "Serviço de Lembretes de E-mail Desativado",
            category: "Fluxo de Dados",
            severity: "ALTO",
            description: "A chave RESEND_API_KEY do servidor de e-mail de notificação não está configurada.",
            expected: "As chaves de notificação devem estar ativas no servidor para disparos de lembretes diários.",
            fixAction: "Configure a variável RESEND_API_KEY no menu de segredos do ambiente para ativar lembretes.",
            canAutoFix: false
          });
        }
        if (!googleToken) {
          fallbackIssues.push({
            id: "google-sync",
            title: "Sincronização com Google Calendar Inativa",
            category: "Fluxo de Dados",
            severity: "MÉDIO",
            description: "Nenhuma conta Google está conectada atualmente neste navegador.",
            expected: "A sincronização bidirecional de consultas médicas requer login via Google OAuth.",
            fixAction: "Realizar login usando o botão 'Conectar Google' no canto superior direito para sincronizar agendamentos.",
            canAutoFix: false
          });
        }

        finalResult = {
          status: fallbackIssues.length === 0 ? "SIM" : "SIM, COM PEQUENOS PROBLEMAS",
          summary: "Auditoria local de integridade executada. Detalhes de infraestrutura pendentes de verificação de rede.",
          issues: fallbackIssues
        };
      }

      setAuditResult(finalResult);
    } catch (err: any) {
      console.error("Erro na auditoria:", err);
      setAuditResult({
        status: "NÃO",
        summary: `Erro ao executar rotina de auditoria: ${err.message || String(err)}`,
        issues: []
      });
    } finally {
      setIsAuditing(false);
      setAuditMessage(null);
    }
  };

  const handleApplyFix = async (issueId: string) => {
    setFixingId(issueId);
    try {
      if (issueId === 'mock-data') {
        const cleanedMeds = medicamentos.filter((m: any) => 
          m.id !== 'med_1' && m.id !== 'med_2' && m.id !== 'med_3' && 
          m.ownerId !== 'user_local' && 
          !['losartana potássica', 'losartana', 'dipirona sódica', 'dipirona', 'ibuprofeno'].includes(m.nome.toLowerCase())
        );
        await onSaveMedicamentos(cleanedMeds);
        
        // Sincroniza localmente
        if (auditResult) {
          const updatedIssues = auditResult.issues.map((issue: any) => {
            if (issue.id === issueId) {
              return { ...issue, isResolved: true };
            }
            return issue;
          });
          setAuditResult({
            ...auditResult,
            issues: updatedIssues
          });
        }
      } 
      else if (issueId === 'orphaned-meds') {
        if (familiars.length > 0) {
          const firstFamId = familiars[0].id;
          const fixedMeds = medicamentos.map((m: any) => {
            if (!m.pessoaId) {
              return { ...m, pessoaId: firstFamId };
            }
            return m;
          });
          await onSaveMedicamentos(fixedMeds);
          
          if (auditResult) {
            const updatedIssues = auditResult.issues.map((issue: any) => {
              if (issue.id === issueId) {
                return { ...issue, isResolved: true };
              }
              return issue;
            });
            setAuditResult({
              ...auditResult,
              issues: updatedIssues
            });
          }
        } else {
          alert("Nenhum familiar cadastrado! Cadastre pelo menos um familiar na aba 'Cadastros' para poder vincular estes medicamentos.");
        }
      }
    } catch (err) {
      console.error("Erro ao aplicar auto-correção:", err);
      alert("Falha ao aplicar correção automática de dados.");
    } finally {
      setFixingId(null);
    }
  };

  const handleExportDatabase = () => {
    const emailKey = user?.email || 'default';
    
    // Coleta todas as chaves do localStorage associadas ao usuário
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userEmail: user?.email || '',
      data: {
        procedures: JSON.parse(localStorage.getItem(`procedures_${emailKey}`) || '[]'),
        medicamentos: JSON.parse(localStorage.getItem(`medicamentos_${emailKey}`) || '[]'),
        tratamentos: JSON.parse(localStorage.getItem(`tratamentos_${emailKey}`) || '[]'),
        providers: JSON.parse(localStorage.getItem(`providers_${emailKey}`) || '[]'),
        procedureTypes: JSON.parse(localStorage.getItem(`procedureTypes_${emailKey}`) || '[]'),
        familiars: JSON.parse(localStorage.getItem(`familiars_${emailKey}`) || '[]'),
        categories: JSON.parse(localStorage.getItem(`categories_${emailKey}`) || '[]'),
        email_logs: JSON.parse(localStorage.getItem(`email_logs_${emailKey}`) || '[]'),
        taken_doses_log: JSON.parse(localStorage.getItem('taken_doses_log') || '[]'),
      }
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const dateFormatted = new Date().toISOString().split('T')[0];
    const filename = `backup_agenda_saude_${emailKey.replace(/[@.]/g, '_')}_${dateFormatted}.json`;
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);
    
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // Validação simples de formato
        if (!json || typeof json !== 'object' || !json.data) {
          throw new Error("Formato de arquivo inválido. O arquivo de backup selecionado não é compatível.");
        }
        
        const emailKey = user?.email || 'default';
        const backupData = json.data;
        
        // Gravar as chaves no localStorage mapeando-as para o usuário logado atualmente
        if (backupData.procedures) localStorage.setItem(`procedures_${emailKey}`, JSON.stringify(backupData.procedures));
        if (backupData.medicamentos) localStorage.setItem(`medicamentos_${emailKey}`, JSON.stringify(backupData.medicamentos));
        if (backupData.tratamentos) localStorage.setItem(`tratamentos_${emailKey}`, JSON.stringify(backupData.tratamentos));
        if (backupData.providers) localStorage.setItem(`providers_${emailKey}`, JSON.stringify(backupData.providers));
        if (backupData.procedureTypes) localStorage.setItem(`procedureTypes_${emailKey}`, JSON.stringify(backupData.procedureTypes));
        if (backupData.familiars) localStorage.setItem(`familiars_${emailKey}`, JSON.stringify(backupData.familiars));
        if (backupData.categories) localStorage.setItem(`categories_${emailKey}`, JSON.stringify(backupData.categories));
        if (backupData.email_logs) localStorage.setItem(`email_logs_${emailKey}`, JSON.stringify(backupData.email_logs));
        if (backupData.taken_doses_log) localStorage.setItem('taken_doses_log', JSON.stringify(backupData.taken_doses_log));
        
        setImportSuccess("Dados importados com sucesso! Reiniciando o aplicativo para atualizar tudo...");
        
        // Recarrega a página após 1.5 segundos para garantir atualização limpa dos contextos
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } catch (err: any) {
        setImportError(err.message || "Erro ao processar o arquivo de backup. Verifique se o arquivo JSON está correto.");
      }
    };
    
    reader.readAsText(file);
  };

  const fetchServerLogs = async () => {
    try {
      const response = await fetch('/api/email-logs');
      if (response.ok) {
        const serverLogs = await response.json();
        setLogs(prev => {
          const merged = [...prev];
          serverLogs.forEach((sLog: any) => {
            const isDuplicate = merged.some(mLog => {
              if (mLog.id === sLog.id) return true;
              const mTime = getTimestampMs(mLog.timestamp);
              const sTime = getTimestampMs(sLog.timestamp);
              return Math.abs(mTime - sTime) < 5000 && mLog.to === sLog.to && mLog.subject === sLog.subject;
            });
            if (!isDuplicate) {
              merged.push({
                id: sLog.id || `server_log_${Date.now()}_${Math.random()}`,
                ...sLog
              });
            }
          });
          merged.sort((a, b) => {
            const timeA = getTimestampMs(a.timestamp);
            const timeB = getTimestampMs(b.timestamp);
            return timeB - timeA;
          });
          localStorage.setItem(`email_logs_${user?.email || 'default'}`, JSON.stringify(merged));
          return merged;
        });
      }
    } catch (e) {
      console.warn("Não foi possível carregar os logs do servidor:", e);
    }
  };

  useEffect(() => {
    // Carregar logs locais como fallback de início
    const localLogsStr = localStorage.getItem(`email_logs_${user?.email || 'default'}`);
    if (localLogsStr) {
      try {
        setLogs(JSON.parse(localLogsStr));
      } catch (e) {
        console.error("Erro ao fazer parse dos logs locais:", e);
      }
    }

    const fetchFirestoreLogs = async () => {
      try {
        const q = query(collection(db, "email_logs"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const emailLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLog));
        setLogs(prev => {
          const merged = [...prev];
          emailLogs.forEach((fLog) => {
            const exists = merged.some(mLog => mLog.id === fLog.id);
            if (!exists) {
              merged.push(fLog);
            }
          });
          merged.sort((a, b) => {
            const timeA = getTimestampMs(a.timestamp);
            const timeB = getTimestampMs(b.timestamp);
            return timeB - timeA;
          });
          localStorage.setItem(`email_logs_${user?.email || 'default'}`, JSON.stringify(merged));
          return merged;
        });
      } catch (error) {
        console.warn("Aviso: Falha ao carregar logs do Firestore devido a regras ou restrições de rede. Usando cache local.");
      }
    };

    fetchFirestoreLogs();

    // Buscar logs do servidor
    fetchServerLogs();
  }, [db, user?.email]);

  const handleManualCheckStock = async () => {
    setCheckingStock(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/check-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ medicamentos, procedimentos: procedures, familiars, isManual: true })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStatusMessage({
          type: 'success',
          title: 'Verificação Concluída',
          desc: data.message || 'O estoque de medicamentos e procedimentos próximos foram verificados.'
        });

        // Se o servidor retornou medicamentos atualizados (após decremento), salvamos localmente
        if (data.updatedMeds && onSaveMedicamentos) {
          onSaveMedicamentos(data.updatedMeds);
        }

        // Criar log local para garantir visibilidade instantânea
        const newLog: EmailLog = {
          id: `local_log_${Date.now()}`,
          to: user?.email || 'usuario@agenda.com',
          subject: data.criticalCount > 0 ? 'Alerta: Medicamentos com Estoque Crítico' : 'Verificação de Estoque: Todos os itens abastecidos',
          status: data.sent ? 'success' : 'failure',
          error: data.sent ? undefined : (data.criticalCount > 0 ? 'Falta configurar RESEND_API_KEY ou NOTIFICATION_EMAIL' : undefined),
          timestamp: new Date().toISOString()
        };

        setLogs(prev => {
          const filtered = prev.filter(p => !p.id.startsWith('local_log_'));
          const updated = [newLog, ...filtered];
          localStorage.setItem(`email_logs_${user?.email || 'default'}`, JSON.stringify(updated));
          return updated;
        });

        // Atualizar logs com o backup do servidor também
        await fetchServerLogs();

      } else {
        setStatusMessage({
          type: 'info',
          title: 'Aviso da Verificação',
          desc: data.message || data.error || 'A rotina executou, mas o e-mail não foi enviado por falta de configuração ou falta de itens críticos.'
        });
      }
    } catch (error: any) {
      console.error(error);
      setStatusMessage({
        type: 'info',
        title: 'Erro de Conectividade',
        desc: error.message || 'Não foi possível se conectar com a rotina do servidor.'
      });
    } finally {
      setCheckingStock(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3 text-slate-800 mb-6">
        <Settings className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold">Configurações e Logs</h2>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
        {/* Google Account Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center space-x-3.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">Sincronização com Google Agenda</span>
                <h4 className="text-sm font-semibold text-slate-700 truncate">{user?.email}</h4>
              </div>
            </div>
            {timezone && (
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Fuso Horário: <strong className="text-slate-600">{timezone}</strong></span>
              </span>
            )}
          </div>
          
          <div className="min-w-0 flex-1 text-left">
            {calendars && calendars.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Agenda Sincronizada:</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCalendarId || 'primary'}
                    onChange={(e) => handleCalendarChange(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none cursor-pointer hover:border-slate-300 text-slate-700 transition-colors shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {calendars.map((cal: any) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary} {cal.primary ? '(Principal)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={onRefresh}
                    disabled={isSyncing}
                    className="p-2 shrink-0 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sincronizar agora"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sync Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-slate-700 block">Sincronização Contínua</span>
              <span className="text-xs text-slate-400">Verificar atualizações no Google em segundo plano</span>
            </div>
            <div className="flex items-center gap-4">
              {autoSyncEnabled && (
                <div className="flex items-center gap-2 bg-blue-50/40 p-2 rounded-xl border border-blue-100/50">
                  <span className="text-xs font-medium text-blue-800">Frequência:</span>
                  <select
                    value={autoSyncInterval}
                    onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
                    className="px-2.5 py-1.5 border border-blue-200 rounded-lg text-xs font-medium text-blue-800 bg-white outline-none cursor-pointer hover:border-blue-300"
                  >
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1min</option>
                    <option value={300}>5min</option>
                  </select>
                </div>
              )}
              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Configuração do Horário da Rotina de Estoque */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-center space-x-3 text-slate-800">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Horário da Rotina de Estoque</h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed text-left">
          Defina o horário em que o servidor irá processar o decremento de estoque diário dos medicamentos e enviar o e-mail de alerta de estoque crítico. Essa alteração se sincroniza dinamicamente entre o seu aplicativo e o servidor de tarefas agendadas (cron).
        </p>

        {/* Janela de Aviso de Procedimentos */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-left space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Dias para aviso de vencimento de procedimentos (10 a 60 dias):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={10}
                max={60}
                value={inputBufferDays}
                onChange={(e) => {
                  const val = Math.max(10, Math.min(60, Number(e.target.value)));
                  setInputBufferDays(val);
                }}
                className="w-24 text-xs p-2.5 border border-slate-200 rounded-lg bg-white outline-none hover:border-slate-300 text-slate-700 transition-colors shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
              />
              <span className="text-xs text-slate-500">
                Procedimentos a vencer nos próximos <strong className="text-blue-600">{inputBufferDays} dias</strong> serão considerados "Próximos" na tela de procedimentos, no dashboard, e no e-mail diário.
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Configuração do Horário de Execução</h4>
              <p className="text-[11px] text-slate-400">Escolha um horário sugerido de 30 em 30 min, ou digite livremente a hora e o minuto desejados.</p>
            </div>
            
            <button
              onClick={() => handleSaveCronHour(scheduledHour, scheduledMinute)}
              disabled={savingHour}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs md:self-center shrink-0 ${
                savingHour
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              }`}
            >
              {savingHour ? 'Salvando...' : 'Salvar Horário'}
            </button>
          </div>

          <div className="pt-2 max-w-md">
            {/* Seletor Rápido de 30 em 30 min */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 block">Escolha o horário:</label>
              <select
                value={`${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinute).padStart(2, '0')}`}
                onChange={(e) => {
                  const val = e.target.value;
                  const [h, m] = val.split(":").map(Number);
                  setScheduledHour(h);
                  setScheduledMinute(m);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white outline-none cursor-pointer hover:border-slate-300 transition-colors shadow-2xs"
              >
                {Array.from({ length: 24 }).flatMap((_, h) => [
                  <option key={`${h}-00`} value={`${String(h).padStart(2, '0')}:00`}>
                    {String(h).padStart(2, '0')}:00
                  </option>,
                  <option key={`${h}-30`} value={`${String(h).padStart(2, '0')}:30`}>
                    {String(h).padStart(2, '0')}:30
                  </option>
                ])}
                {!(scheduledMinute === 0 || scheduledMinute === 30) && (
                  <option key="custom-val" value={`${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinute).padStart(2, '0')}`}>
                    {String(scheduledHour).padStart(2, '0')}:{String(scheduledMinute).padStart(2, '0')}
                  </option>
                )}
              </select>
            </div>
          </div>
        </div>


      </div>

      {/* Backup e Migração de Dados */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-center space-x-3 text-slate-800">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold">Backup e Migração de Dados</h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed text-left">
          Use esta área para exportar toda a sua base de dados local (procedimentos, medicamentos, familiares, prestadores de serviço e histórico) e importá-la em outra instalação ou no aplicativo publicado. Os dados importados serão associados diretamente ao seu e-mail atual (<strong className="text-slate-700">{user?.email || 'default'}</strong>).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Exportar */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-700">
                <Download className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Exportar Dados</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                Gera um arquivo JSON contendo todos os seus registros cadastrados neste navegador para que você possa migrar seus dados para o ambiente publicado.
              </p>
            </div>
            <button
              onClick={handleExportDatabase}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shadow-blue-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Banco de Dados</span>
            </button>
          </div>

          {/* Card Importar */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-700">
                <Upload className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Importar Dados</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                Selecione o arquivo de backup (.json) para restaurar ou migrar seus dados. <span className="text-amber-600 font-medium">Atenção:</span> Isso substituirá os registros locais atuais deste usuário.
              </p>
            </div>
            
            <label className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer text-slate-600">
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Selecionar Arquivo de Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportDatabase}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Feedback de Importação */}
        {importError && (
          <div className="p-3.5 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-100 flex items-start gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Erro na Importação</p>
              <p className="mt-1 text-[11px] leading-relaxed text-opacity-90">{importError}</p>
            </div>
          </div>
        )}

        {importSuccess && (
          <div className="p-3.5 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-start gap-2.5 text-left">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-bold">Sucesso!</p>
              <p className="mt-1 text-[11px] leading-relaxed text-opacity-90">{importSuccess}</p>
            </div>
          </div>
        )}
      </div>

      {/* Auditoria Geral e Auto-Correção de Funcionamento */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-center space-x-3 text-slate-800">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold">Auditoria Geral e Auto-Correção (Console de Saúde)</h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed text-left">
          Execute uma auditoria completa de funcionamento sob demanda para verificar a integridade do seu banco de dados local, chaves de API, variáveis de ambiente e fluxos de dados de uso próprio. Caso algum problema ou dado de simulação/mockado seja encontrado, você poderá autorizar e executar a auto-correção imediata diretamente pelo painel.
        </p>

        {!auditResult && !isAuditing && (
          <div className="flex justify-start">
            <button
              onClick={handleRunAudit}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-slate-200"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Iniciar Auditoria de Funcionamento</span>
            </button>
          </div>
        )}

        {isAuditing && (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center space-y-3.5">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">Analisando Sistema...</p>
              <p className="text-[11px] text-slate-400 animate-pulse font-mono">{auditMessage}</p>
            </div>
          </div>
        )}

        {auditResult && (
          <div className="space-y-5 text-left">
            {/* Status Banner */}
            <div className={`p-4.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-4 justify-between ${
              auditResult.status === 'SIM'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : auditResult.status === 'SIM, COM PEQUENOS PROBLEMAS'
                ? 'bg-amber-50 border-amber-100 text-amber-800'
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {auditResult.status === 'SIM' ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold font-mono uppercase tracking-wider">Status Geral de Integridade</span>
                </div>
                <h4 className="text-sm font-bold mt-1">{auditResult.status}</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{auditResult.summary}</p>
              </div>

              <button
                onClick={handleRunAudit}
                className="shrink-0 py-2 px-3.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auditar Novamente</span>
              </button>
            </div>

            {/* Issues List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Itens de Auditoria Encontrados ({auditResult.issues.filter((i: any) => !i.isResolved).length})</h4>

              {auditResult.issues.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Nenhum problema encontrado!</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">O aplicativo está operando com perfeita integridade de dados e infraestrutura.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/20">
                  {auditResult.issues.map((issue: any) => (
                    <div key={issue.id} className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white transition-colors hover:bg-slate-50/40">
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono tracking-wider ${
                            issue.severity === 'CRÍTICO'
                              ? 'bg-rose-100 text-rose-800'
                              : issue.severity === 'ALTO'
                              ? 'bg-orange-100 text-orange-800'
                              : issue.severity === 'MÉDIO'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {issue.severity}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">{issue.category}</span>
                        </div>

                        <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {issue.title}
                          {issue.isResolved && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Corrigido
                            </span>
                          )}
                        </h5>

                        <p className="text-xs text-slate-500 leading-normal">{issue.description}</p>
                        
                        {!issue.isResolved && (
                          <div className="text-[10px] text-slate-400 space-y-0.5">
                            <p><strong>Comportamento Esperado:</strong> {issue.expected}</p>
                            <p className="text-blue-600"><strong>Correção Proposta:</strong> {issue.fixAction}</p>
                          </div>
                        )}
                      </div>

                      {!issue.isResolved && (
                        <div className="shrink-0 w-full md:w-auto flex md:justify-end">
                          {issue.canAutoFix ? (
                            <button
                              onClick={() => handleApplyFix(issue.id)}
                              disabled={fixingId === issue.id}
                              className="w-full md:w-auto py-1.5 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white disabled:text-slate-400 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                            >
                              {fixingId === issue.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Wrench className="w-3 h-3" />
                              )}
                              <span>Autorizar Auto-Correção</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/50 block text-center w-full md:w-auto">
                              Requer Configuração Manual
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Diagnóstico em Tempo Real da Rotina do Servidor (Cron) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 text-left">
          <div className="flex items-center space-x-3 text-slate-800">
            <Clock className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold">Diagnóstico de Integridade da Rotina (Cron & E-mails)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Verifique o status de execução de ponta a ponta e localize falhas de envio instantaneamente.</p>
            </div>
          </div>
          <button
            onClick={handleRunDiagnostic}
            disabled={isRunningDiagnostic}
            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isRunningDiagnostic
                ? 'bg-slate-100 text-slate-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 active:scale-95'
            }`}
          >
            {isRunningDiagnostic ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span>Analisando Servidor...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Executar Diagnóstico</span>
              </>
            )}
          </button>
        </div>

        {/* Sequência Operacional da Rotina Ilustrada */}
        <div className="bg-slate-50/80 border border-slate-100/80 rounded-2xl p-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3.5 text-left font-mono">Sequência Operacional da Rotina (Fluxo Automático):</h4>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-left">
            {[
              { step: "1", title: "Acionamento", desc: "cron-job.org dispara chamada às 4:00 AM (GMT-3)" },
              { step: "2", title: "Leitura", desc: "Servidor lê medicamentos e familiares no Firestore" },
              { step: "3", title: "Cálculo", desc: "Calcula e decrementa estoques desde a última rodada" },
              { step: "4", title: "Verificação", desc: "Identifica quais itens estão abaixo do estoque mínimo" },
              { step: "5", title: "Agenda", desc: "Analisa procedimentos próximos do vencimento" },
              { step: "6", title: "Notificação", desc: "Dispara o relatório consolidado por e-mail via Resend" }
            ].map((s, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 relative shadow-2xs">
                <span className="absolute -top-2.5 -left-1.5 w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black font-mono">
                  {s.step}
                </span>
                <p className="text-xs font-bold text-slate-700 mt-1">{s.title}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Resultado do Diagnóstico */}
        {diagnosticResult && (
          <div className="space-y-5 text-left animate-in fade-in duration-200">
            {diagnosticResult.error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Falha ao Conectar com a Rota de Diagnóstico</p>
                  <p className="mt-1 font-mono text-[10px] bg-white/50 p-2 rounded-lg border border-rose-100/50">{diagnosticResult.error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Host warning card */}
                {diagnosticResult.host?.warning && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-2.5 shadow-xs">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">⚠️ Atenção: Ambiente de Desenvolvimento Detectado</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        O painel de controle está aberto no link de desenvolvimento privado (<strong>{diagnosticResult.host.value}</strong>). 
                        Se você salvar ou reconfigurar o horário usando este endereço de desenvolvimento, o cron-job.org receberá um <strong>redirecionamento 302 Found</strong> por falta de cookies.
                      </p>
                      <p className="mt-2 font-semibold text-amber-800">
                        💡 Solução: Utilize sempre o endereço publicado/compartilhado (ais-pre-...) para configurar o cron-job.org e garantir que os e-mails sejam disparados automaticamente todos os dias às 4:00 AM!
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Resend Key */}
                  <div className="p-4 rounded-2xl border bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Ambiente: Resend</span>
                        {diagnosticResult.config?.resend?.configured ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">ATIVO</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">Pendente</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-700">Chave do Servidor (RESEND_API_KEY)</h4>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        {diagnosticResult.config?.resend?.configured 
                          ? `Chave configurada: ${diagnosticResult.config.resend.maskedKey}`
                          : "Chave não configurada no servidor!"}
                      </p>
                    </div>
                    {diagnosticResult.config?.notificationEmail?.configured && (
                      <div className="mt-3 pt-3 border-t border-slate-200/50">
                        <span className="text-[8px] font-bold text-slate-400 uppercase font-mono">E-mail de Envio:</span>
                        <p className="text-[10px] font-semibold text-slate-600 truncate">{diagnosticResult.config.notificationEmail.email}</p>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Firestore connection */}
                  <div className="p-4 rounded-2xl border bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Banco de Dados</span>
                        {diagnosticResult.firestore?.status === 'ok' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">CONECTADO</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">FALHA</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-700">Firebase Firestore</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        {diagnosticResult.firestore?.status === 'ok'
                          ? "Conexão com a base de dados do Firestore está funcionando perfeitamente."
                          : `Erro ao conectar: ${diagnosticResult.firestore?.error}`}
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Cron Jobs list */}
                  <div className="p-4 rounded-2xl border bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">cron-job.org</span>
                        {diagnosticResult.cronJobOrg?.status === 'ok' ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">SINCRONIZADO</span>
                        ) : diagnosticResult.cronJobOrg?.status === 'not_configured' ? (
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full">Não Configurado</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">ERRO API</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-700">Tarefas Externas</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        {diagnosticResult.cronJobOrg?.status === 'ok'
                          ? `Encontrada(s) ${diagnosticResult.cronJobOrg.jobsCount} tarefa(s) ativa(s) na sua conta.`
                          : diagnosticResult.cronJobOrg?.status === 'not_configured'
                          ? "Insira o token de API do cron-job.org nas configurações acima para sincronizar."
                          : `Falha na sincronização: ${diagnosticResult.cronJobOrg?.error}`}
                      </p>
                    </div>
                    {diagnosticResult.cronJobOrg?.jobs && diagnosticResult.cronJobOrg.jobs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase font-mono block">Tarefa Ativa:</span>
                        {diagnosticResult.cronJobOrg.jobs.map((job: any, idx: number) => (
                          <div key={idx} className="text-[9px] font-mono text-slate-500 truncate" title={job.url}>
                            ● {job.title} às {job.hours?.[0]}:{String(job.minutes?.[0] || 0).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card 4: Last Execution details */}
                  <div className="p-4 rounded-2xl border bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Última Execução</span>
                        {diagnosticResult.lastExecution ? (
                          diagnosticResult.lastExecution.status === 'success' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">SUCESSO</span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full">FALHA</span>
                          )
                        ) : (
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full">Sem Histórico</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-700">Status do Último Disparo</h4>
                      {diagnosticResult.lastExecution ? (
                        <div className="space-y-1 mt-1.5 text-[10px] text-slate-500 leading-normal">
                          <p><strong>Horário:</strong> {new Date(diagnosticResult.lastExecution.timestamp).toLocaleString('pt-BR')}</p>
                          <p className="truncate"><strong>Assunto:</strong> {diagnosticResult.lastExecution.subject}</p>
                          {diagnosticResult.lastExecution.error && (
                            <p className="text-rose-600 font-bold bg-rose-50 p-1.5 rounded border border-rose-100 mt-1 text-[9px] font-mono leading-tight">
                              <strong>Motivo do Erro:</strong> {diagnosticResult.lastExecution.error}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          Nenhum e-mail foi disparado hoje ou a rotina ainda não foi ativada automaticamente.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Logs */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            Logs de Notificações
          </h3>
          <button
            onClick={handleManualCheckStock}
            disabled={checkingStock}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              checkingStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 cursor-pointer shadow-sm shadow-blue-100'
            }`}
          >
            {checkingStock ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>Verificar Estoque Agora</span>
              </>
            )}
          </button>
        </div>

        {statusMessage && (
          <div className={`p-3.5 rounded-xl text-xs mb-4 flex items-start gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
              : 'bg-blue-50 text-blue-800 border-blue-100'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${statusMessage.type === 'success' ? 'text-emerald-600' : 'text-blue-600'}`} />
            <div className="text-left">
              <p className="font-bold">{statusMessage.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-opacity-90">{statusMessage.desc}</p>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500 text-left">Nenhum e-mail enviado ainda.</p>
          ) : (
            <>
              {currentLogs.map(log => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{log.subject}</p>
                      <p className="text-[10px] text-slate-500">Para: {log.to}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatLogDate(log.timestamp)}
                    </p>
                    {log.error && <p className="text-[10px] text-rose-500">{log.error}</p>}
                  </div>
                </div>
              ))}

              {/* Paginação */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 text-xs text-slate-500">
                <span className="font-medium">
                  {startIndex + 1}–{Math.min(endIndex, logs.length)} de {logs.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="px-2 font-semibold">
                    {safeCurrentPage} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages || totalPages === 0}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                    title="Próximo"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
