import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout 
} from './lib/firebase';
import { 
  listCalendars, 
  createHealthCalendar, 
  fetchAppointments, 
  createAppointment, 
  updateAppointment, 
  deleteAppointment,
  getCalendarTimezone
} from './lib/googleCalendar';
import { Appointment, HealthCalendar, Procedure, HealthProvider, ProcedureType, Familiar, ProcedureCategory, Medicamento, Tratamento } from './types';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import AppointmentForm from './components/AppointmentForm';
import ProceduresView from './components/ProceduresView';
import RegistrationsView from './components/RegistrationsView';
import MedicamentosView from './components/MedicamentosView';
import PontualView from './components/PontualView';
import ConfiguracoesView from './components/ConfiguracoesView';
import { MultiInstanceModal } from './components/MultiInstanceModal';
import { calculateStockDecrement, getTodayStrSP } from './utils/stockHelper';
import { 
  syncMedicamentosToFirestore, 
  fetchMedicamentosFromFirestore,
  syncProceduresToFirestore,
  fetchProceduresFromFirestore,
  syncProvidersToFirestore,
  fetchProvidersFromFirestore,
  syncProcedureTypesToFirestore,
  fetchProcedureTypesFromFirestore,
  syncFamiliarsToFirestore,
  fetchFamiliarsFromFirestore,
  syncCategoriesToFirestore,
  fetchCategoriesFromFirestore,
  syncTratamentosToFirestore,
  fetchTratamentosFromFirestore
} from './utils/firebaseSync';
import { Heart, LogOut, Calendar as CalendarIcon, LayoutDashboard, RefreshCw, AlertCircle, Sparkles, ShieldCheck, Plus, Globe, Settings, X, Layers, CheckCircle, ChevronLeft, ChevronRight, Menu, Activity, ClipboardList, Pill, Clock, Building2, Users, Tag, User, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APP_VERSION, BUILD_DATE } from './version';
import DevNotesModal from './components/DevNotesModal';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'procedures' | 'registrations' | 'medicamentos' | 'configuracoes' | 'controle' | 'pontual'>('dashboard');

  // Dev notes state and environment check
  const [isDevNotesOpen, setIsDevNotesOpen] = useState(false);
  const isDevEnvironment = true; // Sempre habilitado no publicado e em desenvolvimento

  // Sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  const [isMedicamentosExpanded, setIsMedicamentosExpanded] = useState(false);
  const [isRegistrationsExpanded, setIsRegistrationsExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Collapse sub-menus when sidebar is collapsed
  useEffect(() => {
    if (!sidebarExpanded) {
      setIsMedicamentosExpanded(false);
      setIsRegistrationsExpanded(false);
    }
  }, [sidebarExpanded]);

  // Connection persistence state (Keep me logged in)
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    const saved = localStorage.getItem('rememberMe');
    return saved !== null ? saved === 'true' : true;
  });
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<boolean>(false);
  const [isMultiInstanceModalOpen, setIsMultiInstanceModalOpen] = useState(false);
  const [instanceId] = useState(() => Math.random().toString(36).substring(2, 11));

  // Multi-instance detection logic
  useEffect(() => {
    const channel = new BroadcastChannel('familia_health_instances');

    const handleMessage = (event: MessageEvent) => {
      const { type, from, to } = event.data;

      if (type === 'PING' && from !== instanceId) {
        // Alguém novo chegou, responde PONG
        channel.postMessage({ type: 'PONG', from: instanceId, to: from });
      } else if (type === 'PONG' && to === instanceId) {
        // Recebemos resposta de alguém que já estava aqui
        setIsMultiInstanceModalOpen(true);
      } else if (type === 'FORCE_CLOSE' && from !== instanceId) {
        // Outra aba pediu para fecharmos (Continuar Aqui lá)
        window.close();
        // Fallback caso window.close() falhe (comum em abas não abertas por script)
        document.body.innerHTML = `
          <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; background: #fff1f2; color: #9f1239; text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h1 style="margin: 0 0 10px 0;">Sessão Desativada</h1>
            <p style="margin: 0; opacity: 0.8;">Esta aba foi desativada porque o aplicativo foi aberto em outra janela.</p>
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #be123c; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Reativar esta aba</button>
          </div>
        `;
      }
    };

    channel.addEventListener('message', handleMessage);

    // Envia PING inicial para detectar se já existe alguém
    channel.postMessage({ type: 'PING', from: instanceId });

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [instanceId]);

  const handleContinueHere = () => {
    const channel = new BroadcastChannel('familia_health_instances');
    channel.postMessage({ type: 'FORCE_CLOSE', from: instanceId });
    setIsMultiInstanceModalOpen(false);
    channel.close();
  };

  const handleCloseThis = () => {
    window.close();
    // Fallback
    setIsMultiInstanceModalOpen(false);
    document.body.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; background: #f8fafc; color: #475569; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
        <h1 style="margin: 0 0 10px 0;">Até logo!</h1>
        <p style="margin: 0; opacity: 0.8;">Você fechou esta sessão do Família Health.</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Abrir novamente</button>
      </div>
    `;
  };

  const handleKeepBoth = () => {
    setIsMultiInstanceModalOpen(false);
  };

  // Initialize token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('google_access_token');
    const timestampStr = localStorage.getItem('google_token_timestamp');
    if (savedToken && timestampStr) {
      const timestamp = Number(timestampStr);
      const isExpired = Date.now() - timestamp > 55 * 60 * 1000; // 55 minutes
      if (!isExpired) {
        setToken(savedToken);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rememberMe', String(rememberMe));
    if (!rememberMe) {
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_token_timestamp');
    } else if (token) {
      localStorage.setItem('google_access_token', token);
      localStorage.setItem('google_token_timestamp', String(Date.now()));
    }
  }, [rememberMe, token]);

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', String(sidebarExpanded));
  }, [sidebarExpanded]);

  // Calendar State
  const [calendars, setCalendars] = useState<HealthCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [providers, setProviders] = useState<HealthProvider[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [familiars, setFamiliars] = useState<Familiar[]>([]);
  const [categories, setCategories] = useState<ProcedureCategory[]>([]);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [tratamentos, setTratamentos] = useState<Tratamento[]>([]);
  const [registrationsTab, setRegistrationsTab] = useState<'providers' | 'procedure_types' | 'familiars' | 'categories'>('providers');
  const [registrationsSearchQuery, setRegistrationsSearchQuery] = useState('');
  const [proceduresSearchQuery, setProceduresSearchQuery] = useState('');
  const [proceduresFamiliarFilter, setProceduresFamiliarFilter] = useState('all');
  const [proceduresStatusFilter, setProceduresStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'ok' | 'em_processo' | 'stand_by' | 'scheduled'>('all');
  const [initialEditProcedureId, setInitialEditProcedureId] = useState<string | null>(null);
  const [pontualSearchQuery, setPontualSearchQuery] = useState('');
  const [pontualFamiliarFilter, setPontualFamiliarFilter] = useState('todos');
  const [medicamentosSearchQuery, setMedicamentosSearchQuery] = useState('');
  const [medicamentosFamiliarFilter, setMedicamentosFamiliarFilter] = useState('all');
  const [medicamentosFilterCritical, setMedicamentosFilterCritical] = useState(false);
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [proceduresBufferDays, setProceduresBufferDays] = useState<number>(15);
  const [routineError, setRoutineError] = useState<{ timestamp: string; errorStage: string; errorMessage: string } | null>(null);

  const checkLastRoutineStatus = async () => {
    try {
      const res = await fetch('/api/last-routine-execution');
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'error' && !data.dismissed) {
          setRoutineError({
            timestamp: data.timestamp,
            errorStage: data.errorStage,
            errorMessage: data.errorMessage
          });
        } else {
          setRoutineError(null);
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status da rotina do servidor:", err);
    }
  };

  const handleDismissRoutineError = async () => {
    try {
      const res = await fetch('/api/dismiss-routine-execution', { method: 'POST' });
      if (res.ok) {
        setRoutineError(null);
      }
    } catch (err) {
      console.error("Erro ao dispensar erro da rotina do servidor:", err);
    }
  };

  useEffect(() => {
    if (user) {
      checkLastRoutineStatus();
      // Periodicamente verifica a cada 2 minutos caso esteja rodando em segundo plano
      const interval = setInterval(checkLastRoutineStatus, 120000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const fetchBufferDays = async () => {
      try {
        const res = await fetch('/api/cron-config');
        if (res.ok) {
          const data = await res.json();
          if (typeof data.proceduresBufferDays === 'number') {
            setProceduresBufferDays(data.proceduresBufferDays);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar proceduresBufferDays:", err);
      }
    };
    fetchBufferDays();
  }, [user]);

  // Load and sync procedures from localStorage on user change
  useEffect(() => {
    if (user?.email) {
      const savedProcedures = localStorage.getItem(`procedures_${user.email}`);
      if (savedProcedures) {
        try {
          setProcedures(JSON.parse(savedProcedures));
        } catch (e) {
          console.error('Error parsing procedures:', e);
          setProcedures([]);
        }
      } else {
        setProcedures([]);
      }

      // Load providers
      const savedProviders = localStorage.getItem(`providers_${user.email}`);
      if (savedProviders) {
        try {
          setProviders(JSON.parse(savedProviders));
        } catch (e) {
          console.error('Error parsing providers:', e);
          setProviders([]);
        }
      } else {
        setProviders([]);
      }

      // Load procedure types
      const savedProcedureTypes = localStorage.getItem(`procedureTypes_${user.email}`);
      if (savedProcedureTypes) {
        try {
          setProcedureTypes(JSON.parse(savedProcedureTypes));
        } catch (e) {
          console.error('Error parsing procedure types:', e);
          setProcedureTypes([]);
        }
      } else {
        // Initialize default types if empty
        const defaultTypes: ProcedureType[] = [
          { id: 't1', name: 'Consulta Geral', defaultFrequencyValue: 6, defaultFrequencyUnit: 'months' },
          { id: 't2', name: 'Exame de Sangue', defaultFrequencyValue: 1, defaultFrequencyUnit: 'years' },
          { id: 't3', name: 'Consulta Odontológica', defaultFrequencyValue: 6, defaultFrequencyUnit: 'months' },
          { id: 't4', name: 'Exame Oftalmológico', defaultFrequencyValue: 1, defaultFrequencyUnit: 'years' },
          { id: 't5', name: 'Consulta Cardiológica', defaultFrequencyValue: 1, defaultFrequencyUnit: 'years' },
          { id: 't6', name: 'Retorno de Consulta', defaultFrequencyValue: 1, defaultFrequencyUnit: 'months' },
          { id: 't7', name: 'Mamografia', defaultFrequencyValue: 1, defaultFrequencyUnit: 'years' },
          { id: 't8', name: 'Check-up Ginecológico', defaultFrequencyValue: 1, defaultFrequencyUnit: 'years' },
          { id: 't9', name: 'Prevenção anual', defaultFrequencyValue: 1, defaultFrequencyUnit: 'years' }
        ];
        setProcedureTypes(defaultTypes);
        localStorage.setItem(`procedureTypes_${user.email}`, JSON.stringify(defaultTypes));
      }

      // Load familiars
      const savedFamiliars = localStorage.getItem(`familiars_${user.email}`);
      if (savedFamiliars) {
        try {
          setFamiliars(JSON.parse(savedFamiliars));
        } catch (e) {
          console.error('Error parsing familiars:', e);
          setFamiliars([]);
        }
      } else {
        setFamiliars([]);
      }

      // Load categories
      const savedCategories = localStorage.getItem(`categories_${user.email}`);
      if (savedCategories) {
        try {
          setCategories(JSON.parse(savedCategories));
        } catch (e) {
          console.error('Error parsing categories:', e);
          setCategories([]);
        }
      } else {
        const defaultCategories: ProcedureCategory[] = [
          { id: 'c1', name: 'Dentista' },
          { id: 'c2', name: 'Checkup' },
          { id: 'c3', name: 'Vacinas' },
          { id: 'c4', name: 'Medicamento' },
          { id: 'c5', name: 'Tratamento' }
        ];
        setCategories(defaultCategories);
        localStorage.setItem(`categories_${user.email}`, JSON.stringify(defaultCategories));
      }

      // Load treatments
      const savedTratamentos = localStorage.getItem(`tratamentos_${user.email}`);
      if (savedTratamentos) {
        try {
          setTratamentos(JSON.parse(savedTratamentos));
        } catch (e) {
          console.error('Error parsing tratamentos:', e);
          setTratamentos([]);
        }
      } else {
        setTratamentos([]);
      }

      // Load and process medicines stock decrement
      const savedMeds = localStorage.getItem(`medicamentos_${user.email}`);
      let loadedMeds: Medicamento[] = [];
      if (savedMeds) {
        try {
          loadedMeds = JSON.parse(savedMeds);
        } catch (e) {
          console.error('Error parsing medicamentos:', e);
        }
      } else {
        // Initialize default mock medicines
        const mockMeds: Medicamento[] = [
          {
            id: 'med_1',
            pessoaId: '',
            nome: 'Losartana Potássica',
            principioAtivo: 'Losartana',
            dosagem: '50mg',
            quantidadeAtual: 28,
            estoqueMinimo: 5,
            posologia: 'Tomar pela manhã antes do desjejum.',
            vezesAoDia: 1,
            doseManha: '1 comprimido',
            ownerId: 'user_local',
            dataAlteracaoEstoque: getTodayStrSP()
          },
          {
            id: 'med_2',
            pessoaId: '',
            nome: 'Dipirona Sódica',
            principioAtivo: 'Dipirona',
            dosagem: '500mg',
            quantidadeAtual: 3,
            estoqueMinimo: 10,
            posologia: 'Tomar em caso de febre ou dor de cabeça de 6h em 6h.',
            vezesAoDia: 6,
            ownerId: 'user_local',
            dataAlteracaoEstoque: getTodayStrSP()
          },
          {
            id: 'med_3',
            pessoaId: '',
            nome: 'Ibuprofeno',
            principioAtivo: 'Ibuprofeno',
            dosagem: '400mg',
            quantidadeAtual: 2,
            estoqueMinimo: 8,
            posologia: 'Tomar após as refeições principais.',
            vezesAoDia: 2,
            doseManha: '1 comprimido',
            doseMeioDia: '1 comprimido',
            ownerId: 'user_local',
            dataAlteracaoEstoque: getTodayStrSP()
          }
        ];
        loadedMeds = mockMeds;
        localStorage.setItem(`medicamentos_${user.email}`, JSON.stringify(mockMeds));
      }

      // Link any empty patient IDs to first familiar if available
      const storedFamiliarsJson = localStorage.getItem(`familiars_${user.email}`);
      let parsedFams: Familiar[] = [];
      if (storedFamiliarsJson) {
        try { parsedFams = JSON.parse(storedFamiliarsJson); } catch (e) {}
      }
      if (parsedFams.length > 0) {
        loadedMeds = loadedMeds.map(m => {
          if (!m.pessoaId) {
            return { ...m, ...(!m.pessoaId ? { pessoaId: parsedFams[0].id } : {}) };
          }
          return m;
        });
      }

      // Automatically recalculate stock decrement on load
      const todayStr = getTodayStrSP();
      let hasStockUpdates = false;
      const processedMeds = loadedMeds.map(med => {
        if (med.vezesAoDia && med.vezesAoDia > 0) {
          if (med.dataAlteracaoEstoque && med.dataAlteracaoEstoque !== todayStr) {
            const { totalDecrement, updatedDays } = calculateStockDecrement(med.vezesAoDia, med.dataAlteracaoEstoque, todayStr);
            if (updatedDays > 0) {
              hasStockUpdates = true;
              return {
                ...med,
                quantidadeAtual: Math.max(0, med.quantidadeAtual - totalDecrement),
                dataAlteracaoEstoque: todayStr
              };
            }
          } else if (!med.dataAlteracaoEstoque) {
            hasStockUpdates = true;
            return {
              ...med,
              dataAlteracaoEstoque: todayStr
            };
          }
        }
        return med;
      });

      if (hasStockUpdates) {
        localStorage.setItem(`medicamentos_${user.email}`, JSON.stringify(processedMeds));
        setMedicamentos(processedMeds);
      } else {
        setMedicamentos(loadedMeds);
      }

      // Load pinned items
      const savedPinned = localStorage.getItem(`pinnedItems_${user.email}`);
      if (savedPinned) {
        try {
          setPinnedItems(JSON.parse(savedPinned));
        } catch (e) {
          console.error('Error parsing pinned items:', e);
          setPinnedItems([]);
        }
      } else {
        setPinnedItems([]);
      }
    } else {
      setProcedures([]);
      setProviders([]);
      setProcedureTypes([]);
      setFamiliars([]);
      setCategories([]);
      setMedicamentos([]);
      setPinnedItems([]);
    }
  }, [user?.email]);

  const handleSaveMedicamentos = (updatedMedicamentos: Medicamento[]) => {
    setMedicamentos(updatedMedicamentos);
    if (user?.email) {
      localStorage.setItem(`medicamentos_${user.email}`, JSON.stringify(updatedMedicamentos));
      syncMedicamentosToFirestore(user.email, updatedMedicamentos);
    }
  };

  // Fetch latest data from Firestore on login/startup to merge with local storage
  useEffect(() => {
    if (!user?.email) return;

    async function loadAndMergeFirestoreData() {
      try {
        const email = user!.email!;

        // 1. Sincronizar Familiares
        const firestoreFamiliars = await fetchFamiliarsFromFirestore(email);
        if (!firestoreFamiliars || firestoreFamiliars.length === 0) {
          const localFamStr = localStorage.getItem(`familiars_${email}`);
          if (localFamStr) {
            const localFam = JSON.parse(localFamStr);
            if (localFam.length > 0) {
              await syncFamiliarsToFirestore(email, localFam);
            }
          }
        } else {
          setFamiliars(firestoreFamiliars);
          localStorage.setItem(`familiars_${email}`, JSON.stringify(firestoreFamiliars));
        }

        // 2. Sincronizar Prestadores (Providers)
        const firestoreProviders = await fetchProvidersFromFirestore(email);
        if (!firestoreProviders || firestoreProviders.length === 0) {
          const localProvStr = localStorage.getItem(`providers_${email}`);
          if (localProvStr) {
            const localProv = JSON.parse(localProvStr);
            if (localProv.length > 0) {
              await syncProvidersToFirestore(email, localProv);
            }
          }
        } else {
          setProviders(firestoreProviders);
          localStorage.setItem(`providers_${email}`, JSON.stringify(firestoreProviders));
        }

        // 3. Sincronizar Tipos de Procedimentos
        const firestoreTypes = await fetchProcedureTypesFromFirestore(email);
        if (!firestoreTypes || firestoreTypes.length === 0) {
          const localTypeStr = localStorage.getItem(`procedureTypes_${email}`);
          if (localTypeStr) {
            const localType = JSON.parse(localTypeStr);
            if (localType.length > 0) {
              await syncProcedureTypesToFirestore(email, localType);
            }
          }
        } else {
          setProcedureTypes(firestoreTypes);
          localStorage.setItem(`procedureTypes_${email}`, JSON.stringify(firestoreTypes));
        }

        // 4. Sincronizar Categorias
        const firestoreCategories = await fetchCategoriesFromFirestore(email);
        if (!firestoreCategories || firestoreCategories.length === 0) {
          const localCatStr = localStorage.getItem(`categories_${email}`);
          if (localCatStr) {
            const localCat = JSON.parse(localCatStr);
            if (localCat.length > 0) {
              await syncCategoriesToFirestore(email, localCat);
            }
          }
        } else {
          setCategories(firestoreCategories);
          localStorage.setItem(`categories_${email}`, JSON.stringify(firestoreCategories));
        }

        // 5. Sincronizar Procedimentos
        const firestoreProcedures = await fetchProceduresFromFirestore(email);
        if (!firestoreProcedures || firestoreProcedures.length === 0) {
          const localProcStr = localStorage.getItem(`procedures_${email}`);
          if (localProcStr) {
            const localProc = JSON.parse(localProcStr);
            if (localProc.length > 0) {
              await syncProceduresToFirestore(email, localProc);
            }
          }
        } else {
          setProcedures(firestoreProcedures);
          localStorage.setItem(`procedures_${email}`, JSON.stringify(firestoreProcedures));
        }

        // 6. Sincronizar Tratamentos
        const firestoreTratamentos = await fetchTratamentosFromFirestore(email);
        if (!firestoreTratamentos || firestoreTratamentos.length === 0) {
          const localTratStr = localStorage.getItem(`tratamentos_${email}`);
          if (localTratStr) {
            const localTrat = JSON.parse(localTratStr);
            if (localTrat.length > 0) {
              await syncTratamentosToFirestore(email, localTrat);
            }
          }
        } else {
          setTratamentos(firestoreTratamentos);
          localStorage.setItem(`tratamentos_${email}`, JSON.stringify(firestoreTratamentos));
        }

        // 7. Sincronizar Medicamentos
        const firestoreMeds = await fetchMedicamentosFromFirestore(email);
        if (!firestoreMeds || firestoreMeds.length === 0) {
          const localMedsStr = localStorage.getItem(`medicamentos_${email}`);
          if (localMedsStr) {
            const localMeds = JSON.parse(localMedsStr);
            if (localMeds.length > 0) {
              await syncMedicamentosToFirestore(email, localMeds);
            }
          }
        } else {
          setMedicamentos(prevMeds => {
            let hasChanges = false;
            const merged = prevMeds.map(localMed => {
              const firestoreMed = firestoreMeds.find(fm => fm.id === localMed.id);
              if (firestoreMed) {
                const localDate = localMed.dataAlteracaoEstoque || "";
                const firestoreDate = firestoreMed.dataAlteracaoEstoque || "";
                if (
                  localMed.quantidadeAtual !== firestoreMed.quantidadeAtual ||
                  localMed.lastProcessedDate !== firestoreMed.lastProcessedDate ||
                  localDate !== firestoreDate
                ) {
                  hasChanges = true;
                  return {
                    ...localMed,
                    quantidadeAtual: firestoreMed.quantidadeAtual,
                    dataAlteracaoEstoque: firestoreDate,
                    lastProcessedDate: firestoreMed.lastProcessedDate || localMed.lastProcessedDate,
                  };
                }
              }
              return localMed;
            });

            const localIds = new Set(prevMeds.map(m => m.id));
            firestoreMeds.forEach(fm => {
              if (!localIds.has(fm.id)) {
                merged.push(fm);
                hasChanges = true;
              }
            });

            if (hasChanges) {
              localStorage.setItem(`medicamentos_${email}`, JSON.stringify(merged));
              return merged;
            }
            return prevMeds;
          });
        }
        console.log("[App] Sincronização inicial com o Firestore completada com sucesso.");
      } catch (err) {
        console.error("[App] Erro na sincronização inicial com o Firestore:", err);
      }
    }

    loadAndMergeFirestoreData();
  }, [user?.email]);

  const handleSaveTratamentos = (updatedTratamentos: Tratamento[]) => {
    setTratamentos(updatedTratamentos);
    if (user?.email) {
      localStorage.setItem(`tratamentos_${user.email}`, JSON.stringify(updatedTratamentos));
      syncTratamentosToFirestore(user.email, updatedTratamentos);
    }
  };

  const handleSaveProcedures = (updatedProcedures: Procedure[]) => {
    setProcedures(updatedProcedures);
    if (user?.email) {
      localStorage.setItem(`procedures_${user.email}`, JSON.stringify(updatedProcedures));
      syncProceduresToFirestore(user.email, updatedProcedures);
    }
  };

  const handleSaveProviders = (updatedProviders: HealthProvider[]) => {
    // Check for provider name changes
    const providerChanges: { [oldName: string]: { id: string; newName: string } } = {};
    providers.forEach(oldProv => {
      const newProv = updatedProviders.find(p => p.id === oldProv.id);
      if (newProv && newProv.name !== oldProv.name) {
        providerChanges[oldProv.name] = { id: oldProv.id, newName: newProv.name };
      }
    });

    const hasChanges = Object.keys(providerChanges).length > 0;
    let newProcedures = procedures;
    if (hasChanges) {
      newProcedures = procedures.map(proc => {
        let matched = false;
        let targetNewName = '';

        if (proc.providerId) {
          const change = Object.values(providerChanges).find(c => c.id === proc.providerId);
          if (change) {
            matched = true;
            targetNewName = change.newName;
          }
        }

        if (!matched && proc.providerName) {
          const change = providerChanges[proc.providerName];
          if (change) {
            matched = true;
            targetNewName = change.newName;
          }
        }

        if (matched && targetNewName) {
          return { ...proc, providerName: targetNewName };
        }
        return proc;
      });

      setProcedures(newProcedures);
      if (user?.email) {
        localStorage.setItem(`procedures_${user.email}`, JSON.stringify(newProcedures));
        syncProceduresToFirestore(user.email, newProcedures);
      }
    }

    setProviders(updatedProviders);
    if (user?.email) {
      localStorage.setItem(`providers_${user.email}`, JSON.stringify(updatedProviders));
      syncProvidersToFirestore(user.email, updatedProviders);
    }
  };

  const handleSaveProcedureTypes = (updatedProcedureTypes: ProcedureType[]) => {
    // Check for procedure type name changes
    const nameChanges: { [oldName: string]: string } = {};
    procedureTypes.forEach(oldType => {
      const newType = updatedProcedureTypes.find(t => t.id === oldType.id);
      if (newType && newType.name !== oldType.name) {
        nameChanges[oldType.name] = newType.name;
      }
    });

    const hasChanges = Object.keys(nameChanges).length > 0;
    let newProcedures = procedures;
    if (hasChanges) {
      newProcedures = procedures.map(proc => {
        if (nameChanges[proc.name]) {
          return { ...proc, name: nameChanges[proc.name] };
        }
        return proc;
      });

      setProcedures(newProcedures);
      if (user?.email) {
        localStorage.setItem(`procedures_${user.email}`, JSON.stringify(newProcedures));
        syncProceduresToFirestore(user.email, newProcedures);
      }
    }

    setProcedureTypes(updatedProcedureTypes);
    if (user?.email) {
      localStorage.setItem(`procedureTypes_${user.email}`, JSON.stringify(updatedProcedureTypes));
      syncProcedureTypesToFirestore(user.email, updatedProcedureTypes);
    }
  };

  const handleSaveFamiliars = (updatedFamiliars: Familiar[]) => {
    // Check for familiar name changes
    const familiarChanges: { [oldName: string]: { id: string; newName: string } } = {};
    familiars.forEach(oldFam => {
      const newFam = updatedFamiliars.find(f => f.id === oldFam.id);
      if (newFam && newFam.name !== oldFam.name) {
        familiarChanges[oldFam.name] = { id: oldFam.id, newName: newFam.name };
      }
    });

    const hasChanges = Object.keys(familiarChanges).length > 0;
    let newProcedures = procedures;
    if (hasChanges) {
      newProcedures = procedures.map(proc => {
        let matched = false;
        let targetNewName = '';

        if (proc.familiarId) {
          const change = Object.values(familiarChanges).find(c => c.id === proc.familiarId);
          if (change) {
            matched = true;
            targetNewName = change.newName;
          }
        }

        if (!matched && proc.familiarName) {
          const change = familiarChanges[proc.familiarName];
          if (change) {
            matched = true;
            targetNewName = change.newName;
          }
        }

        if (matched && targetNewName) {
          return { ...proc, familiarName: targetNewName };
        }
        return proc;
      });

      setProcedures(newProcedures);
      if (user?.email) {
        localStorage.setItem(`procedures_${user.email}`, JSON.stringify(newProcedures));
        syncProceduresToFirestore(user.email, newProcedures);
      }
    }

    setFamiliars(updatedFamiliars);
    if (user?.email) {
      localStorage.setItem(`familiars_${user.email}`, JSON.stringify(updatedFamiliars));
      syncFamiliarsToFirestore(user.email, updatedFamiliars);
    }
  };

  const handleSaveCategories = (updatedCategories: ProcedureCategory[]) => {
    // Check for category name changes
    const categoryChanges: { [oldName: string]: string } = {};
    categories.forEach(oldCat => {
      const newCat = updatedCategories.find(c => c.id === oldCat.id);
      if (newCat && newCat.name !== oldCat.name) {
        categoryChanges[oldCat.name] = newCat.name;
      }
    });

    const hasChanges = Object.keys(categoryChanges).length > 0;
    let newProcedures = procedures;
    if (hasChanges) {
      newProcedures = procedures.map(proc => {
        if (proc.category && categoryChanges[proc.category]) {
          return { ...proc, category: categoryChanges[proc.category] };
        }
        return proc;
      });

      setProcedures(newProcedures);
      if (user?.email) {
        localStorage.setItem(`procedures_${user.email}`, JSON.stringify(newProcedures));
        syncProceduresToFirestore(user.email, newProcedures);
      }
    }

    setCategories(updatedCategories);
    if (user?.email) {
      localStorage.setItem(`categories_${user.email}`, JSON.stringify(updatedCategories));
      syncCategoriesToFirestore(user.email, updatedCategories);
    }
  };

  // Sincronizar as datas e horários das etapas dos procedimentos com compromissos atualizados na agenda
  useEffect(() => {
    if (!user?.email || !appointmentsLoaded) return;

    setProcedures(prevProcedures => {
      if (prevProcedures.length === 0) return prevProcedures;

      let globalHasChanges = false;
      const updatedProcedures = prevProcedures.map(proc => {
        if (!proc.steps || proc.steps.length === 0) return proc;

        let procHasChanges = false;
        const updatedSteps = proc.steps.map(step => {
          if (step.scheduled && step.appointmentId) {
            const matchedApp = appointments.find(app => app.id === step.appointmentId);
            
            if (matchedApp) {
              const appDate = matchedApp.date; // YYYY-MM-DD
              const appTime = matchedApp.allDay ? undefined : matchedApp.startTime; // HH:MM

              const dateChanged = step.scheduledDate !== appDate || step.targetDate !== appDate;
              const timeChanged = step.scheduledTime !== appTime;
              const allDayChanged = step.allDay !== matchedApp.allDay;

              if (dateChanged || timeChanged || allDayChanged) {
                procHasChanges = true;
                globalHasChanges = true;
                return {
                  ...step,
                  targetDate: appDate, // Sincroniza a data de realização da etapa com a nova data da agenda
                  scheduledDate: appDate,
                  scheduledTime: appTime,
                  allDay: matchedApp.allDay
                };
              }
            } else {
              // Se o compromisso não foi encontrado na agenda (foi excluído no Google Calendar),
              // removemos a marcação de agendado desta etapa.
              procHasChanges = true;
              globalHasChanges = true;
              return {
                ...step,
                scheduled: false,
                appointmentId: undefined,
                scheduledDate: undefined,
                scheduledTime: undefined,
                allDay: undefined
              };
            }
          }
          return step;
        });

        if (procHasChanges) {
          return {
            ...proc,
            steps: updatedSteps
          };
        }
        return proc;
      });

      if (globalHasChanges) {
        localStorage.setItem(`procedures_${user.email}`, JSON.stringify(updatedProcedures));
        syncProceduresToFirestore(user.email, updatedProcedures);
        return updatedProcedures;
      }
      return prevProcedures;
    });
  }, [appointments, user?.email, appointmentsLoaded]);

  // Auto Sync State for Background Sync
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoSyncEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(() => {
    const saved = localStorage.getItem('autoSyncInterval');
    return saved !== null ? Number(saved) : 30; // in seconds
  });
  const [lastSyncedTime, setLastSyncedTime] = useState<Date | null>(new Date());
  const [isSilentSyncing, setIsSilentSyncing] = useState(false);

  // Save Auto Sync preferences on change
  useEffect(() => {
    localStorage.setItem('autoSyncEnabled', String(autoSyncEnabled));
  }, [autoSyncEnabled]);

  useEffect(() => {
    localStorage.setItem('autoSyncInterval', String(autoSyncInterval));
  }, [autoSyncInterval]);

  // Form Modals State
  const [showForm, setShowForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [formInitialDate, setFormInitialDate] = useState<string | undefined>(undefined);
  
  // Drag and Drop State
  const [pinnedItems, setPinnedItems] = useState<string[]>([]);
  const handleDropItem = (item: string) => {
    if (!pinnedItems.includes(item) && pinnedItems.length < 3) {
      const updated = [...pinnedItems, item];
      setPinnedItems(updated);
      if (user?.email) {
        localStorage.setItem(`pinnedItems_${user.email}`, JSON.stringify(updated));
      }
    }
  };

  const handleRemoveItem = (item: string) => {
    const updated = pinnedItems.filter(i => i !== item);
    setPinnedItems(updated);
    if (user?.email) {
      localStorage.setItem(`pinnedItems_${user.email}`, JSON.stringify(updated));
    }
  };

  const handleDropToSidebar = (e: React.DragEvent, itemName: string) => {
    e.preventDefault();
    const droppedItem = e.dataTransfer.getData("text");
    if (droppedItem === itemName) {
      const updated = pinnedItems.filter(i => i !== itemName);
      setPinnedItems(updated);
      if (user?.email) {
        localStorage.setItem(`pinnedItems_${user.email}`, JSON.stringify(updated));
      }
    }
  };

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Trigger brief alert toast
  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. Listen for Auth changes
  useEffect(() => {
    const unsubscribe = initAuth(
      (firebaseUser, accessToken) => {
        setUser(firebaseUser);
        setToken(accessToken);
        handlePostLogin(accessToken);
        setLoading(false);
      },
      (firebaseUser) => {
        setUser(firebaseUser);
        setToken(null);
        // Se o usuário deveria ser lembrado mas não temos o token (ex: expirou), mostra o aviso
        if (firebaseUser && rememberMe) {
          setSessionExpiredNotice(true);
        }
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Initialize Calendar structures and fetch events
  const handlePostLogin = async (accessToken: string) => {
    setIsSyncing(true);
    try {
      const calendarList = await listCalendars(accessToken);
      setCalendars(calendarList);

      // Check if "Agenda de Saúde" already exists
      const healthCal = calendarList.find(
        (c) => c.summary === 'Agenda de Saúde' || c.description?.includes('Compromissos de saúde')
      );

      let targetCalendarId = '';
      let targetTimeZone = '';

      if (healthCal) {
        targetCalendarId = healthCal.id;
        targetTimeZone = healthCal.timeZone || '';
        setSelectedCalendarId(healthCal.id);
      } else {
        // Create the dedicated calendar automatically to delight the user
        try {
          // Get primary calendar timezone first to use for the new health calendar creation
          const primaryCal = calendarList.find((c) => c.primary) || calendarList[0];
          const primaryTz = primaryCal?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const newCal = await createHealthCalendar(accessToken, primaryTz);
          setCalendars((prev) => [...prev, newCal]);
          targetCalendarId = newCal.id;
          targetTimeZone = newCal.timeZone || primaryTz;
          setSelectedCalendarId(newCal.id);
          triggerToast('Agenda de Saúde criada com sucesso em seu Google Calendar!');
        } catch (err) {
          console.error('Could not create dedicated health calendar, falling back to primary', err);
          // Fallback to Primary Calendar
          const primaryCal = calendarList.find((c) => c.primary) || calendarList[0];
          if (primaryCal) {
            targetCalendarId = primaryCal.id;
            targetTimeZone = primaryCal.timeZone || '';
            setSelectedCalendarId(primaryCal.id);
          }
        }
      }

      if (targetCalendarId) {
        const activeTz = targetTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(activeTz);
        const events = await fetchAppointments(accessToken, targetCalendarId, activeTz);
        setAppointments(events);
        setAppointmentsLoaded(true);
      }
    } catch (err) {
      console.error('Failed post login initialization:', err);
      handleApiError(err, 'Erro ao carregar agendas. Verifique a conexão com o Google.');
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Periodic silent auto-sync in client background
  useEffect(() => {
    if (!token || !selectedCalendarId || !autoSyncEnabled) return;

    const intervalId = setInterval(async () => {
      setIsSilentSyncing(true);
      try {
        const activeTz = timezone;
        const events = await fetchAppointments(token, selectedCalendarId, activeTz);
        setAppointments(events);
        setAppointmentsLoaded(true);
        setLastSyncedTime(new Date());
      } catch (err) {
        console.warn('Silent auto-sync failed:', err);
        handleApiError(err, null);
      } finally {
        setIsSilentSyncing(false);
      }
    }, autoSyncInterval * 1000);

    return () => clearInterval(intervalId);
  }, [token, selectedCalendarId, autoSyncEnabled, autoSyncInterval, timezone]);

  // Handle manual calendar dropdown changes
  const handleCalendarChange = async (id: string) => {
    setSelectedCalendarId(id);
    if (!token) return;
    setIsSyncing(true);
    try {
      const matchedCal = calendars.find(c => c.id === id);
      const activeTz = matchedCal?.timeZone || timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(activeTz);
      const events = await fetchAppointments(token, id, activeTz);
      setAppointments(events);
      setAppointmentsLoaded(true);
      triggerToast('Sincronizando com a agenda selecionada.');
    } catch (err) {
      console.error('Error changing calendar:', err);
      handleApiError(err, 'Erro ao buscar compromissos desta agenda.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Re-fetch events
  const handleRefresh = async () => {
    if (!token || !selectedCalendarId) return;
    setIsSyncing(true);
    try {
      const matchedCal = calendars.find(c => c.id === selectedCalendarId);
      const activeTz = matchedCal?.timeZone || timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(activeTz);
      const events = await fetchAppointments(token, selectedCalendarId, activeTz);
      setAppointments(events);
      setAppointmentsLoaded(true);
      triggerToast('Agenda atualizada em tempo real com o Google Calendar!');
    } catch (err) {
      console.error('Refresh error:', err);
      handleApiError(err, 'Erro ao sincronizar com o Google Agenda.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setSessionExpiredNotice(false);
        setUser(res.user);
        setToken(res.accessToken);
        await handlePostLogin(res.accessToken);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      triggerToast('Erro ao realizar login com o Google.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (silent = false) => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setAppointments([]);
      setAppointmentsLoaded(false);
      setCalendars([]);
      setSelectedCalendarId('');
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (!silent) {
        triggerToast('Sessão encerrada com sucesso.');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleApiError = (err: any, defaultMsg: string | null) => {
    let errStr = '';
    try {
      errStr = typeof err === 'object' && err !== null ? JSON.stringify(err).toLowerCase() : String(err).toLowerCase();
    } catch (e) {
      errStr = String(err?.message || err || '').toLowerCase();
    }
    const hasMessage = String(err?.message || '').toLowerCase();
    
    const isAuthError = 
      errStr.includes('401') || 
      errStr.includes('403') ||
      errStr.includes('unauthorized') || 
      errStr.includes('forbidden') ||
      errStr.includes('invalid credentials') || 
      errStr.includes('unauthenticated') ||
      hasMessage.includes('401') ||
      hasMessage.includes('403') ||
      hasMessage.includes('unauthorized') ||
      hasMessage.includes('forbidden') ||
      hasMessage.includes('invalid credentials') ||
      hasMessage.includes('unauthenticated') ||
      err?.status === 401 ||
      err?.status === 403 ||
      err?.statusCode === 401 ||
      err?.statusCode === 403 ||
      err?.code === 401 ||
      err?.code === 403 ||
      err?.error?.code === 401 ||
      err?.error?.code === 403 ||
      err?.error?.status === 401 ||
      err?.error?.status === 403 ||
      err?.error?.status === 'UNAUTHENTICATED' ||
      err?.error?.status === 'PERMISSION_DENIED';

    if (isAuthError) {
      setSessionExpiredNotice(true);
      handleLogout(true);
      triggerToast('Sua sessão ou permissão com o Google Agenda expirou. Por favor, conecte novamente.', 'error');
    } else if (defaultMsg) {
      triggerToast(defaultMsg, 'error');
    }
  };

  // Create or Update Appointment
  const handleSaveAppointment = async (appData: Omit<Appointment, 'id'> & { id?: string }) => {
    if (!token || !selectedCalendarId) return;
    setIsSyncing(true);
    try {
      if (appData.id) {
        // Update
        const updated = await updateAppointment(token, selectedCalendarId, appData.id, appData, timezone);
        setAppointments((prev) => prev.map((item) => (item.id === appData.id ? updated : item)));
        triggerToast('Compromisso atualizado e enviado ao Google Agenda!');
        return updated;
      } else {
        // Create
        const created = await createAppointment(token, selectedCalendarId, appData, timezone);
        setAppointments((prev) => [created, ...prev]);
        triggerToast('Compromisso cadastrado com sucesso no Google Agenda!');
        return created;
      }
    } catch (err) {
      console.error('Error saving appointment:', err);
      handleApiError(err, 'Erro ao salvar compromisso no Google Agenda.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Appointment
  const handleDeleteAppointment = async (id: string) => {
    if (!token || !selectedCalendarId) return;
    setIsSyncing(true);
    try {
      await deleteAppointment(token, selectedCalendarId, id);
      setAppointments((prev) => prev.filter((item) => item.id !== id));
      triggerToast('Compromisso excluído do aplicativo e do Google Agenda.');
    } catch (err) {
      console.error('Error deleting appointment:', err);
      handleApiError(err, 'Erro ao deletar compromisso.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectAppointment = (app: Appointment) => {
    setSelectedAppointment(app);
    setFormInitialDate(undefined);
    setShowForm(true);
  };

  const handleAddOnDate = (dateStr: string) => {
    setSelectedAppointment(null);
    setFormInitialDate(dateStr);
    setShowForm(true);
  };

  const handleAddNewGeneral = () => {
    setSelectedAppointment(null);
    setFormInitialDate(undefined);
    setShowForm(true);
  };

  // If loading, show clean loading page
  if (loading) {
    return (
      <div id="loading_screen" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white animate-pulse shadow-lg shadow-blue-600/20">
            <Heart className="w-6 h-6 animate-bounce" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-sm font-semibold text-slate-700">Agenda de Saúde</h3>
            <p className="text-xs text-slate-400 font-mono">conectando com google agenda...</p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show landing / login page
  if (!user || !token) {
    return (
      <div id="login_screen" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-4xl w-full bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          {/* Left Hero Brand Side */}
          <div className="md:col-span-6 bg-gradient-to-br from-blue-700 to-indigo-950 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
            
            <div className="flex items-center space-x-2 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-300">
                <Heart className="w-5 h-5 fill-white/20" />
              </div>
              <span className="font-semibold text-base font-display tracking-tight">Agenda de Saúde</span>
            </div>

            <div className="space-y-4 my-12 relative z-10">
              <span className="text-xs font-bold text-blue-300 font-mono uppercase tracking-widest bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-400/20">
                Sincronização Oficial Google
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-display leading-tight tracking-tight">
                Cuide do que realmente importa.
              </h1>
              <p className="text-sm text-blue-100/80 leading-relaxed font-sans font-light">
                Esqueça agendas de papel ou blocos de notas. Cadastre suas consultas de rotina, exames preventivos, acompanhamentos e retornos médicos de forma automática em um aplicativo limpo integrado diretamente ao seu Google Calendar.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs text-blue-200/70 relative z-10 font-sans font-medium">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-400 shrink-0" />
              <span>Conexão direta, segura e sem intermediários.</span>
            </div>
          </div>

          {/* Right Form Login Side */}
          <div className="md:col-span-6 p-8 sm:p-12 flex flex-col justify-center items-center text-center bg-white">
            <div className="max-w-xs space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">Bem-vindo(a)</h2>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Para podermos salvar e ler os seus compromissos médicos em tempo real, conecte sua conta Google utilizando o botão seguro abaixo.
                </p>
              </div>

              {sessionExpiredNotice && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2 animate-fadeIn shadow-sm">
                  <div className="flex items-center space-x-2 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span className="text-xs font-bold font-sans">Sessão Expirada</span>
                  </div>
                  <p className="text-[11px] text-amber-700/90 leading-relaxed font-sans">
                    Por razões de segurança do Google, a sua sessão expira a cada 1 hora. Conecte-se novamente para continuar gerenciando sua Agenda de Saúde.
                  </p>
                </div>
              )}

              {/* Material Login Button */}
              <div className="flex flex-col items-center space-y-4 pt-2">
                <button
                  id="google_signin_btn"
                  onClick={handleSignIn}
                  className="gsi-material-button w-full"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">Entrar com o Google</span>
                  </div>
                </button>

                {/* Keep me logged in checkbox */}
                <label className="flex items-center space-x-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
                    Continuar logado
                  </span>
                </label>
              </div>

              <div className="text-[10px] text-slate-400 font-sans border-t border-slate-100 pt-4 flex flex-col space-y-1">
                <span>Os dados do calendário ficam exclusivamente em sua conta.</span>
                <span>Nenhum dado é compartilhado com terceiros.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="app_main_layout" className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 overflow-x-hidden">
      {/* 1. Desktop Sidebar */}
      <motion.aside
        id="desktop_sidebar"
        animate={{ width: sidebarExpanded ? 260 : 76 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex flex-col bg-white border-r border-slate-100 h-screen sticky top-0 shrink-0 z-40 overflow-hidden"
      >
        {/* Sidebar Brand Header / Icon toggle */}
        <div className="p-4 border-b border-slate-50 flex items-center justify-between min-h-[73px]">
          <div 
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-90 select-none overflow-hidden shrink-0 transition-all duration-200"
            title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/15 shrink-0 hover:scale-105 active:scale-95 transition-transform">
              <Heart className="w-5 h-5 fill-white/10" />
            </div>
            {sidebarExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col text-left"
              >
                <span className="font-bold text-sm font-display tracking-tight text-slate-800 leading-tight">Agenda de Saúde</span>
                <span className="text-[9px] text-emerald-600 font-mono flex items-center gap-1 uppercase tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  online
                </span>
              </motion.div>
            )}
          </div>

          {sidebarExpanded && (
            <button 
              onClick={() => setSidebarExpanded(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Recolher menu"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Navigation Options */}
        <div className="flex-1 py-6 px-3 space-y-5 overflow-y-auto">
          {/* Nav Items Link Group */}
          <div className="space-y-1">
            {sidebarExpanded && (
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Navegação
              </span>
            )}
            
            <button
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData("text", "Painel");
              }}
              draggable
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropToSidebar(e, "Painel")}
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                activeTab === 'dashboard'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title="Painel de Controle"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {sidebarExpanded && <span className="truncate text-left">Painel</span>}
            </button>

            <button
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData("text", "Procedimentos");
              }}
              draggable
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropToSidebar(e, "Procedimentos")}
              onClick={() => {
                setProceduresStatusFilter('all');
                setProceduresFamiliarFilter('all');
                setActiveTab('procedures');
              }}
              className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                activeTab === 'procedures'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title="Controle de Procedimentos"
            >
              <Stethoscope className="w-4 h-4 shrink-0" />
              {sidebarExpanded && <span className="truncate text-left">Procedimentos</span>}
            </button>

            <button
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData("text", "Medicamentos");
              }}
              draggable
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropToSidebar(e, "Medicamentos")}
              onClick={() => {
                if (!sidebarExpanded) {
                  setSidebarExpanded(true);
                  setIsMedicamentosExpanded(true);
                  setMedicamentosFamiliarFilter('all');
                  setMedicamentosFilterCritical(false);
                  setActiveTab('medicamentos');
                } else {
                  setIsMedicamentosExpanded(!isMedicamentosExpanded);
                  setMedicamentosFamiliarFilter('all');
                  setMedicamentosFilterCritical(false);
                  setActiveTab('medicamentos');
                }
              }}
              className={`w-full flex items-center justify-between rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 ${
                (activeTab === 'medicamentos' || activeTab === 'controle' || activeTab === 'pontual') && !sidebarExpanded
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title="Controle de Medicamentos"
            >
              <div className="flex items-center space-x-3">
                <Pill className="w-4 h-4 shrink-0" />
                {sidebarExpanded && <span className="truncate text-left">Medicamentos</span>}
              </div>
              {sidebarExpanded && (
                <ChevronRight className={`w-3 h-3 transition-transform ${isMedicamentosExpanded ? 'rotate-90' : ''}`} />
              )}
            </button>

            {isMedicamentosExpanded && sidebarExpanded && (
              <>
                <button
                  onClick={() => {
                    setMedicamentosFamiliarFilter('all');
                    setMedicamentosFilterCritical(false);
                    setActiveTab('medicamentos');
                  }}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 pl-10 ${
                    activeTab === 'medicamentos' || activeTab === 'controle'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                  title="Controle"
                >
                  <Pill className="w-4 h-4 shrink-0" />
                  <span className="truncate text-left">Controle</span>
                </button>

                <button
                  onClick={() => setActiveTab('pontual')}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 pl-10 ${
                    activeTab === 'pontual'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                  title="Pontual"
                >
                  <Pill className="w-4 h-4 shrink-0" />
                  <span className="truncate text-left">Pontual</span>
                </button>
              </>
            )}

            <button
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData("text", "Agenda");
              }}
              draggable
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropToSidebar(e, "Agenda")}
              onClick={() => setActiveTab('calendar')}
              className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                activeTab === 'calendar'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
              title="Agenda Integrada"
            >
              <CalendarIcon className="w-4 h-4 shrink-0" />
              {sidebarExpanded && <span className="truncate text-left">Agenda Integrada</span>}
            </button>


            <div>
              <button
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData("text", "Cadastros");
                }}
                draggable
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropToSidebar(e, "Cadastros")}
                onClick={() => {
                  if (!sidebarExpanded) {
                    setSidebarExpanded(true);
                    setIsRegistrationsExpanded(true);
                    setRegistrationsSearchQuery('');
                    setRegistrationsTab('providers');
                    setActiveTab('registrations');
                  } else {
                    setIsRegistrationsExpanded(!isRegistrationsExpanded);
                    setRegistrationsSearchQuery('');
                    setRegistrationsTab('providers');
                    setActiveTab('registrations');
                  }
                }}
                className={`w-full flex items-center justify-between rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 ${
                  activeTab === 'registrations'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
                title="Cadastros de Apoio"
              >
                <div className="flex items-center space-x-3">
                  <ClipboardList className="w-4 h-4 shrink-0" />
                  {sidebarExpanded && <span className="truncate text-left">Cadastros</span>}
                </div>
                {sidebarExpanded && (
                  <ChevronRight className={`w-3 h-3 transition-transform ${isRegistrationsExpanded ? 'rotate-90' : ''}`} />
                )}
              </button>
              
              {isRegistrationsExpanded && sidebarExpanded && (
                <div className="pl-7 mt-1.5 space-y-1 text-left">
                  <button
                    onClick={() => {
                      setRegistrationsSearchQuery('');
                      setRegistrationsTab('providers');
                      setActiveTab('registrations');
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                      activeTab === 'registrations' && registrationsTab === 'providers'
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Profissionais/Clínicas"
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span className="truncate text-left">Profissionais/Clínicas</span>
                  </button>

                  <button
                    onClick={() => {
                      setRegistrationsSearchQuery('');
                      setRegistrationsTab('procedure_types');
                      setActiveTab('registrations');
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                      activeTab === 'registrations' && registrationsTab === 'procedure_types'
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Tipo de Procedimentos"
                  >
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    <span className="truncate text-left">Tipo de Procedimentos</span>
                  </button>

                  <button
                    onClick={() => {
                      setRegistrationsSearchQuery('');
                      setRegistrationsTab('familiars');
                      setActiveTab('registrations');
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                      activeTab === 'registrations' && registrationsTab === 'familiars'
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Familiares"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate text-left">Familiares</span>
                  </button>

                  <button
                    onClick={() => {
                      setRegistrationsSearchQuery('');
                      setRegistrationsTab('categories');
                      setActiveTab('registrations');
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
                      activeTab === 'registrations' && registrationsTab === 'categories'
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Categorias"
                  >
                    <Tag className="w-4 h-4 shrink-0" />
                    <span className="truncate text-left">Categorias</span>
                  </button>
                </div>
              )}
            </div>

            {isDevEnvironment && (
              <button
                onClick={() => setIsDevNotesOpen(true)}
                className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 text-slate-500 hover:text-slate-800 hover:bg-amber-50/50 border border-transparent hover:border-amber-200/50`}
                title="Anotações & Melhorias"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-amber-500 fill-amber-500/20" />
                {sidebarExpanded && <span className="truncate text-left font-bold text-amber-700">Anotações Dev</span>}
              </button>
            )}

          </div>
        </div>

        {/* Sidebar Footer - Account Profile & Logout */}
        <div className="p-4 border-t border-slate-50 bg-slate-50/40 shrink-0 space-y-3">
          <button
            onClick={() => setActiveTab('configuracoes')}
            className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer h-10 px-3 space-x-3 ${
              activeTab === 'configuracoes'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
            title="Configurações"
          >
            <Settings className="w-4 h-4 shrink-0" />
            {sidebarExpanded && <span className="truncate text-left">Configurações</span>}
          </button>
          <div className={`flex items-center ${sidebarExpanded ? 'justify-between' : 'justify-center'}`}>
            <div className="flex items-center space-x-2.5 overflow-hidden">
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profile'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-slate-100 shrink-0"
                />
              )}
              {sidebarExpanded && (
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-xs font-semibold text-slate-700 truncate">{user?.displayName || 'Usuário'}</span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{user?.email}</span>
                </div>
              )}
            </div>

            {sidebarExpanded && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {!sidebarExpanded && (
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center mx-auto cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          )}

          {sidebarExpanded ? (
            <div className="text-[10px] text-slate-400 font-medium text-center pt-2 border-t border-slate-100 flex flex-col items-center justify-center">
              <span>Versão {APP_VERSION}</span>
              <span className="text-[8px] text-slate-300 font-mono">Build: {BUILD_DATE}</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-semibold text-center pt-1 border-t border-slate-100/50" title={`Build: ${BUILD_DATE}`}>
              v{APP_VERSION}
            </div>
          )}
        </div>
      </motion.aside>

      {/* 2. Mobile Top Header Navbar */}
      <header id="mobile_navbar" className="md:hidden bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between w-full">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-50 shrink-0 cursor-pointer"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div 
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex items-center space-x-2 select-none cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/10 shrink-0">
              <Heart className="w-4.5 h-4.5 fill-white/10" />
            </div>
            <span className="font-bold text-sm font-display tracking-tight text-slate-800">Agenda de Saúde</span>
          </div>
        </div>

        {/* Mobile Header Right Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('configuracoes')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer"
            title="Configurações"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full border border-slate-100 shrink-0"
            />
          )}
        </div>
      </header>

      {/* 3. Mobile Sidebar Drawer Overlay (AnimatePresence) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Dark Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 md:hidden"
            />

            {/* Slide-out Sidebar Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-100 h-screen z-55 flex flex-col md:hidden shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-50 flex items-center justify-between min-h-[64px]">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                    <Heart className="w-4.5 h-4.5 fill-white/10" />
                  </div>
                  <span className="font-bold text-sm text-slate-800">Agenda de Saúde</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <div className="flex-1 py-5 px-3 space-y-4">
                <div className="space-y-1">
                  <span className="px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Navegação
                  </span>
                  
                  <button
                    onClick={() => {
                      setActiveTab('dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer ${
                      activeTab === 'dashboard'
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <span className="text-left">Painel</span>
                  </button>

                  <button
                    onClick={() => {
                      setProceduresStatusFilter('all');
                      setProceduresFamiliarFilter('all');
                      setActiveTab('procedures');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer ${
                      activeTab === 'procedures'
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    <span className="text-left">Procedimentos</span>
                  </button>

                  <button
                    onClick={() => {
                      setMedicamentosFamiliarFilter('all');
                      setMedicamentosFilterCritical(false);
                      setActiveTab('medicamentos');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer ${
                      activeTab === 'medicamentos'
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Pill className="w-4 h-4 shrink-0" />
                    <span className="text-left">Medicamentos</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('calendar');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer ${
                      activeTab === 'calendar'
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4 shrink-0" />
                    <span className="text-left">Agenda Integrada</span>
                  </button>

                  <div>
                    <button
                      onClick={() => {
                        setRegistrationsSearchQuery('');
                        setActiveTab('registrations');
                      }}
                      className={`w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer ${
                        activeTab === 'registrations'
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4 shrink-0" />
                      <span className="text-left">Cadastros</span>
                    </button>
                    
                    {activeTab === 'registrations' && (
                      <div className="pl-7 mt-1.5 space-y-1 text-left">
                        <button
                          onClick={() => {
                            setRegistrationsSearchQuery('');
                            setRegistrationsTab('providers');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center rounded-lg text-[11px] font-medium h-8 px-2.5 cursor-pointer ${
                            registrationsTab === 'providers' ? 'text-blue-600 bg-blue-50 font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          • Profissionais/Clínicas
                        </button>
                        <button
                          onClick={() => {
                            setRegistrationsSearchQuery('');
                            setRegistrationsTab('procedure_types');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center rounded-lg text-[11px] font-medium h-8 px-2.5 cursor-pointer ${
                            registrationsTab === 'procedure_types' ? 'text-blue-600 bg-blue-50 font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          • Tipo de Procedimentos
                        </button>
                        <button
                          onClick={() => {
                            setRegistrationsSearchQuery('');
                            setRegistrationsTab('familiars');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center rounded-lg text-[11px] font-medium h-8 px-2.5 cursor-pointer ${
                            registrationsTab === 'familiars' ? 'text-blue-600 bg-blue-50 font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          • Familiares
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('configuracoes');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer ${
                      activeTab === 'configuracoes'
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="text-left">Configurações</span>
                  </button>

                  {isDevEnvironment && (
                    <button
                      onClick={() => {
                        setIsDevNotesOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center rounded-xl text-xs font-semibold h-10 px-3 space-x-3 cursor-pointer text-slate-500 hover:bg-amber-50/50 border border-transparent hover:border-amber-200/50"
                    >
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-500 fill-amber-500/20" />
                      <span className="text-left font-bold text-amber-700">Anotações Dev</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Drawer Footer Profile & Logout */}
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    {user?.photoURL && (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full border border-slate-100 shrink-0"
                      />
                    )}
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs font-semibold text-slate-700 truncate">{user?.displayName || 'Usuário'}</span>
                      <span className="text-[9px] text-slate-400 font-mono truncate max-w-[110px]">{user?.email}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Sair da Conta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-medium text-center pt-2 border-t border-slate-100 flex flex-col items-center justify-center">
                  <span>Versão {APP_VERSION}</span>
                  <span className="text-[8px] text-slate-300 font-mono">Build: {BUILD_DATE}</span>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 4. Right Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen ${['dashboard', 'registrations', 'procedures', 'medicamentos', 'controle', 'pontual'].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <main className={`flex-1 w-full px-4 sm:px-6 py-6 ${['dashboard', 'registrations', 'procedures', 'medicamentos', 'controle', 'pontual'].includes(activeTab) ? 'flex flex-col overflow-hidden space-y-4' : 'space-y-6'}`}>
          {/* Active Screens Content Container */}
          <div id="active_panel_container" className={['dashboard', 'registrations', 'procedures', 'medicamentos', 'controle', 'pontual'].includes(activeTab) ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : ''}>
            {activeTab === 'dashboard' ? (
              <Dashboard
                appointments={appointments}
                calendars={calendars}
                selectedCalendarId={selectedCalendarId}
                onCalendarChange={handleCalendarChange}
                onRefresh={handleRefresh}
                isRefreshing={isSyncing}
                onAddAppointment={handleAddNewGeneral}
                onSelectAppointment={handleSelectAppointment}
                userEmail={user.email || undefined}
                timezone={timezone}
                autoSyncEnabled={autoSyncEnabled}
                setAutoSyncEnabled={setAutoSyncEnabled}
                autoSyncInterval={autoSyncInterval}
                setAutoSyncInterval={setAutoSyncInterval}
                lastSyncedTime={lastSyncedTime}
                isSilentSyncing={isSilentSyncing}
                procedures={procedures}
                familiars={familiars}
                medicamentos={medicamentos}
                onNavigateToTab={setActiveTab}
                proceduresBufferDays={proceduresBufferDays}
                pinnedItems={pinnedItems}
                onDropItem={handleDropItem}
                onRemoveItem={handleRemoveItem}
                onNavigateToProceduresWithFilter={(status, familiarId) => {
                  setProceduresStatusFilter(status);
                  setProceduresFamiliarFilter(familiarId || 'all');
                  setActiveTab('procedures');
                }}
                onNavigateToRegistrationsWithSubTab={(subTab) => {
                  setRegistrationsTab(subTab);
                  setActiveTab('registrations');
                }}
                onNavigateToProcedureWithEdit={(procedureId) => {
                  setInitialEditProcedureId(procedureId);
                  setActiveTab('procedures');
                }}
                onNavigateToMedicamentosWithFilter={(familiarId) => {
                  setMedicamentosFamiliarFilter(familiarId);
                  setMedicamentosFilterCritical(false);
                  setActiveTab('medicamentos');
                }}
                onNavigateToMedicamentosCritical={() => {
                  setMedicamentosFamiliarFilter('all');
                  setMedicamentosFilterCritical(true);
                  setActiveTab('medicamentos');
                }}
                onNavigateToMedicamentosWithCriticalFilter={(familiarId) => {
                  setMedicamentosFamiliarFilter(familiarId);
                  setMedicamentosFilterCritical(true);
                  setActiveTab('medicamentos');
                }}
              />
            ) : activeTab === 'calendar' ? (
              <CalendarView
                appointments={appointments}
                onSelectAppointment={handleSelectAppointment}
                onAddAppointmentOnDate={handleAddOnDate}
                onRefresh={handleRefresh}
                isRefreshing={isSyncing}
                pinnedItems={pinnedItems}
                onDropItem={handleDropItem}
                onNavigateToTab={setActiveTab}
              />
            ) : activeTab === 'procedures' ? (
              <ProceduresView
                procedures={procedures}
                onSaveProcedures={handleSaveProcedures}
                providers={providers}
                onSaveProviders={handleSaveProviders}
                procedureTypes={procedureTypes}
                onSaveProcedureTypes={handleSaveProcedureTypes}
                familiars={familiars}
                onSaveFamiliars={handleSaveFamiliars}
                categories={categories}
                onSaveCategories={handleSaveCategories}
                onSaveAppointment={handleSaveAppointment}
                onDeleteAppointment={handleDeleteAppointment}
                appointments={appointments}
                searchQuery={proceduresSearchQuery}
                onSearchQueryChange={setProceduresSearchQuery}
                familiarFilter={proceduresFamiliarFilter}
                onFamiliarFilterChange={setProceduresFamiliarFilter}
                statusFilter={proceduresStatusFilter}
                onStatusFilterChange={setProceduresStatusFilter}
                initialEditProcedureId={initialEditProcedureId}
                onClearInitialEditProcedureId={() => setInitialEditProcedureId(null)}
                proceduresBufferDays={proceduresBufferDays}
                pinnedItems={pinnedItems}
                onDropItem={handleDropItem}
                onNavigateToTab={setActiveTab}
                onViewProvider={(providerName) => {
                  setRegistrationsSearchQuery(providerName);
                  setRegistrationsTab('providers');
                  setActiveTab('registrations');
                }}
              />
            ) : activeTab === 'medicamentos' || activeTab === 'controle' ? (
              <MedicamentosView
                medicamentos={medicamentos}
                onSaveMedicamentos={handleSaveMedicamentos}
                familiars={familiars}
                searchQuery={medicamentosSearchQuery}
                onSearchQueryChange={setMedicamentosSearchQuery}
                selectedFamiliarId={medicamentosFamiliarFilter}
                onSelectedFamiliarIdChange={setMedicamentosFamiliarFilter}
                filterCritical={medicamentosFilterCritical}
                onFilterCriticalChange={setMedicamentosFilterCritical}
                pinnedItems={pinnedItems}
                onDropItem={handleDropItem}
                onNavigateToTab={setActiveTab}
              />
            ) : activeTab === 'pontual' ? (
              <PontualView
                tratamentos={tratamentos}
                onSaveTratamentos={handleSaveTratamentos}
                familiars={familiars}
                searchQuery={pontualSearchQuery}
                onSearchQueryChange={setPontualSearchQuery}
                filterFamiliar={pontualFamiliarFilter}
                onFilterFamiliarChange={setPontualFamiliarFilter}
                pinnedItems={pinnedItems}
                onDropItem={handleDropItem}
                onNavigateToTab={setActiveTab}
              />
            ) : activeTab === 'configuracoes' ? (
              <ConfiguracoesView
                user={user}
                timezone={timezone}
                selectedCalendarId={selectedCalendarId}
                calendars={calendars}
                handleCalendarChange={handleCalendarChange}
                autoSyncEnabled={autoSyncEnabled}
                setAutoSyncEnabled={setAutoSyncEnabled}
                autoSyncInterval={autoSyncInterval}
                setAutoSyncInterval={setAutoSyncInterval}
                medicamentos={medicamentos}
                onSaveMedicamentos={handleSaveMedicamentos}
                procedures={procedures}
                onSaveProcedures={handleSaveProcedures}
                familiars={familiars}
                onSaveFamiliars={handleSaveFamiliars}
                tratamentos={tratamentos}
                onSaveTratamentos={handleSaveTratamentos}
                isSyncing={isSyncing}
                onRefresh={handleRefresh}
                proceduresBufferDays={proceduresBufferDays}
                onSaveProceduresBufferDays={(days) => setProceduresBufferDays(days)}
              />
            ) : (
              <RegistrationsView
                procedures={procedures}
                providers={providers}
                onSaveProviders={handleSaveProviders}
                procedureTypes={procedureTypes}
                onSaveProcedureTypes={handleSaveProcedureTypes}
                familiars={familiars}
                onSaveFamiliars={handleSaveFamiliars}
                categories={categories}
                onSaveCategories={handleSaveCategories}
                activeSubTab={registrationsTab}
                setActiveSubTab={setRegistrationsTab}
                searchQuery={registrationsSearchQuery}
                onSearchQueryChange={setRegistrationsSearchQuery}
                tratamentos={tratamentos}
                medicamentos={medicamentos}
                onNavigateToTab={(tab, query, familiarId) => {
                  if (query !== undefined) {
                    if (tab === 'procedures') {
                      setProceduresSearchQuery(query);
                      if (familiarId) setProceduresFamiliarFilter(familiarId);
                    } else if (tab === 'pontual') {
                      setPontualSearchQuery(query);
                      if (familiarId) setPontualFamiliarFilter(familiarId);
                    } else if (tab === 'controle' || tab === 'medicamentos') {
                      setMedicamentosSearchQuery(query);
                      if (familiarId) setMedicamentosFamiliarFilter(familiarId);
                    }
                  }
                  setActiveTab(tab);
                }}
                pinnedItems={pinnedItems}
                onDropItem={handleDropItem}
              />
            )}
          </div>
        </main>
      </div>

      {/* Syncing Indicator floating bottom */}
      {isSyncing && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center space-x-2.5 border border-slate-700 z-50 animate-bounce">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span className="font-medium font-sans">Sincronizando com Google...</span>
        </div>
      )}

      {/* Floating Success Alert Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-6 max-w-sm px-4 py-3.5 rounded-2xl shadow-xl flex items-center space-x-3 border z-50 ${
              toastType === 'success'
                ? 'bg-blue-50 text-blue-800 border-blue-100'
                : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}
          >
            {toastType === 'success' ? (
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-medium font-sans leading-relaxed">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerta de erro flutuante da rotina do servidor */}
      <AnimatePresence>
        {routineError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-6 right-6 max-w-md w-[calc(100vw-3rem)] bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl shadow-2xl p-5 z-55 flex flex-col space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-bold text-sm tracking-tight">Falha na Rotina Automática</span>
              </div>
              <button
                onClick={handleDismissRoutineError}
                className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100/50 transition-colors cursor-pointer"
                title="Fechar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="text-xs space-y-1.5 leading-relaxed font-sans text-rose-800">
              <p>Ocorreu uma falha ao processar a rotina automática em segundo plano do servidor.</p>
              <div className="bg-white/70 rounded-xl p-3 border border-rose-100 font-sans text-[11px] space-y-1">
                <div><span className="font-semibold text-rose-900">Etapa:</span> {routineError.errorStage}</div>
                <div><span className="font-semibold text-rose-900">Erro:</span> {routineError.errorMessage}</div>
                {routineError.timestamp && (
                  <div className="text-[10px] text-rose-400 font-mono mt-1">
                    Executado em: {new Date(routineError.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </div>
                )}
              </div>
              <p className="font-medium text-[11px] text-rose-700 bg-rose-100/40 p-2.5 rounded-xl border border-rose-200/40 mt-1">
                ⚠️ O decréscimo de estoque não foi realizado e os e-mails de alerta não foram enviados para esta execução.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Appointment form Modal */}
      {showForm && (
        <AppointmentForm
          appointment={selectedAppointment}
          initialDate={formInitialDate}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          onClose={() => {
            setShowForm(false);
            setSelectedAppointment(null);
            setFormInitialDate(undefined);
          }}
        />
      )}
      {/* Multi-instance detection Modal */}
      <MultiInstanceModal
        isOpen={isMultiInstanceModalOpen}
        onContinueHere={handleContinueHere}
        onCloseThis={handleCloseThis}
        onKeepBoth={handleKeepBoth}
      />

      {/* Dev Environment Floating Notes & Improvements panel */}
      {isDevEnvironment && (
        <DevNotesModal
          isOpen={isDevNotesOpen}
          onClose={() => setIsDevNotesOpen(false)}
        />
      )}
    </div>
  );
}
