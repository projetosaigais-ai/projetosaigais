import { useState, useMemo } from 'react';
import { Appointment, HealthCalendar, Procedure, Familiar, ProcedureStep, Medicamento } from '../types';
import { getFamiliarColorClasses } from './RegistrationsView';
import { 
  Calendar as CalendarIcon, 
  Heart, 
  Search, 
  RefreshCw, 
  Plus, 
  Clock, 
  Activity, 
  Stethoscope, 
  Users, 
  ChevronRight, 
  AlertCircle, 
  AlertTriangle,
  ArrowRight, 
  Sparkles, 
  CheckSquare, 
  ListTodo, 
  User, 
  CheckCircle,
  TrendingUp,
  MapPin,
  Pill,
  LayoutDashboard
} from 'lucide-react';
import { motion } from 'motion/react';
import { PinnedItemsHeader } from './PinnedItemsHeader';

interface DashboardProps {
  appointments: Appointment[];
  calendars: HealthCalendar[];
  selectedCalendarId: string;
  onCalendarChange: (id: string) => void;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onAddAppointment: () => void;
  onSelectAppointment: (appointment: Appointment) => void;
  userEmail?: string;
  timezone?: string;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (val: boolean) => void;
  autoSyncInterval: number;
  setAutoSyncInterval: (val: number) => void;
  lastSyncedTime: Date | null;
  isSilentSyncing: boolean;
  procedures: Procedure[];
  familiars: Familiar[];
  medicamentos?: Medicamento[];
  onNavigateToTab: (tab: 'dashboard' | 'calendar' | 'procedures' | 'registrations' | 'medicamentos') => void;
  onNavigateToProceduresWithFilter?: (status: 'all' | 'overdue' | 'upcoming' | 'ok' | 'em_processo' | 'stand_by' | 'scheduled', familiarId?: string) => void;
  onNavigateToRegistrationsWithSubTab?: (subTab: 'providers' | 'procedure_types' | 'familiars' | 'categories') => void;
  onNavigateToProcedureWithEdit?: (procedureId: string) => void;
  onNavigateToMedicamentosWithFilter?: (familiarId: string) => void;
  onNavigateToMedicamentosCritical?: () => void;
  onNavigateToMedicamentosWithCriticalFilter?: (familiarId: string) => void;
  proceduresBufferDays?: number;
  pinnedItems: string[];
  onDropItem: (item: string) => void;
  onRemoveItem: (item: string) => void;
}

// Helper to determine procedure status matching ProceduresView classification
const getStatusInfo = (nextDateStr?: string, statusStr?: string, bufferDays: number = 15) => {
  if (statusStr === 'em_processo') {
    return { label: 'Em processo', color: 'blue', isOverdue: false, isUpcoming: false, badgeStyle: 'bg-blue-50 text-blue-700 border-blue-100' };
  }
  if (statusStr === 'stand_by') {
    return { label: 'Stand By', color: 'slate', isOverdue: false, isUpcoming: false, badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  if (!nextDateStr) {
    return { label: 'Sem data', color: 'slate', isOverdue: false, isUpcoming: false, badgeStyle: 'bg-slate-50 text-slate-500 border-slate-100' };
  }
  
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr + 'T00:00:00');
  const next = new Date(nextDateStr + 'T00:00:00');
  
  const diffTime = next.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { 
      label: `Atrasado (${Math.abs(diffDays)}d)`, 
      color: 'rose', 
      isOverdue: true, 
      isUpcoming: false, 
      diffDays, 
      badgeStyle: 'bg-rose-50 text-rose-600 border-rose-100' 
    };
  } else if (diffDays === 0) {
    return { 
      label: 'É hoje!', 
      color: 'amber', 
      isOverdue: false, 
      isUpcoming: true, 
      diffDays, 
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse font-semibold' 
    };
  } else if (diffDays <= bufferDays) {
    return { 
      label: `Próximo (${diffDays}d)`, 
      color: 'amber', 
      isOverdue: false, 
      isUpcoming: true, 
      diffDays, 
      badgeStyle: 'bg-amber-50/70 text-amber-600 border-amber-100' 
    };
  } else {
    return { 
      label: 'Em dia', 
      color: 'emerald', 
      isOverdue: false, 
      isUpcoming: false, 
      badgeStyle: 'bg-emerald-50 text-emerald-600 border-emerald-100' 
    };
  }
};

const getAge = (birthDateStr?: string) => {
  if (!birthDateStr) return '';
  try {
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} anos`;
  } catch (e) {
    return '';
  }
};

export default function Dashboard({
  appointments,
  calendars,
  selectedCalendarId,
  onCalendarChange,
  onRefresh,
  isRefreshing,
  onAddAppointment,
  onSelectAppointment,
  userEmail,
  timezone,
  procedures = [],
  familiars = [],
  medicamentos = [],
  onNavigateToTab,
  onNavigateToProceduresWithFilter,
  onNavigateToRegistrationsWithSubTab,
  onNavigateToProcedureWithEdit,
  onNavigateToMedicamentosWithFilter,
  onNavigateToMedicamentosCritical,
  onNavigateToMedicamentosWithCriticalFilter,
  proceduresBufferDays = 15,
  pinnedItems,
  onDropItem,
  onRemoveItem
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Find next upcoming appointment from Google Calendar
  const nextAppointment = useMemo(() => {
    const now = new Date();
    const futureApps = appointments
      .filter((app) => app.status === 'scheduled')
      .map((app) => {
        const appDate = new Date(`${app.date}T${app.startTime}:00`);
        return { app, appDate };
      })
      .filter(({ appDate }) => appDate >= now)
      .sort((a, b) => a.appDate.getTime() - b.appDate.getTime());

    return futureApps.length > 0 ? futureApps[0].app : null;
  }, [appointments]);

  // Calculate stats about procedures and appointments
  const stats = useMemo(() => {
    const totalProcedures = procedures.length;
    let overdueProcedures = 0;
    let activeWorkflows = 0; // em processo
    let upcomingProcedures = 0; // próximos

    procedures.forEach(proc => {
      const status = getStatusInfo(proc.nextDate, proc.status, proceduresBufferDays);
      if (status.isOverdue) overdueProcedures++;
      if (status.isUpcoming && proc.status !== 'stand_by') upcomingProcedures++;
      if (proc.status === 'em_processo' || proc.isEmProcesso) activeWorkflows++;
    });

    const totalScheduledAppointments = appointments.filter(a => a.status === 'scheduled').length;

    return {
      totalProcedures,
      overdueProcedures,
      activeWorkflows,
      upcomingProcedures,
      totalScheduledAppointments
    };
  }, [procedures, appointments, proceduresBufferDays]);

  // List of active "Em Processo" procedures for direct progression views
  const activeProceduresList = useMemo(() => {
    return procedures
      .filter(p => p.status === 'em_processo' || p.isEmProcesso)
      .sort((a, b) => {
        const nextDateA = a.nextDate || '';
        const nextDateB = b.nextDate || '';
        
        const comp = nextDateA.localeCompare(nextDateB);
        if (comp !== 0) {
          if (!nextDateA) return 1;
          if (!nextDateB) return -1;
          return comp;
        }

        // Se a data da próxima realização for a mesma (e ambos são "em processo")
        // Comparar o agendamento da etapa ativa
        const getActiveStep = (proc: typeof a) => {
          if (proc.steps && proc.steps.length > 0) {
            return [...proc.steps]
              .filter(s => !s.completed)
              .sort((x, y) => x.targetDate.localeCompare(y.targetDate))[0];
          }
          return undefined;
        };

        const stepA = getActiveStep(a);
        const stepB = getActiveStep(b);

        const hasSchedA = !!stepA?.scheduled;
        const hasSchedB = !!stepB?.scheduled;

        if (hasSchedA !== hasSchedB) {
          return hasSchedA ? -1 : 1; // Procedimentos com agendamento vêm primeiro
        }

        if (hasSchedA && hasSchedB) {
          // Ambos têm agendamento. Ordem: dia inteiro primeiro, depois horários cronológicos
          const allDayA = !!stepA?.allDay;
          const allDayB = !!stepB?.allDay;

          if (allDayA !== allDayB) {
            return allDayA ? -1 : 1; // Dia inteiro primeiro
          }

          if (!allDayA && !allDayB) {
            // Nenhum é dia inteiro, comparar scheduledTime cronologicamente
            const timeA = stepA?.scheduledTime || '';
            const timeB = stepB?.scheduledTime || '';
            if (timeA !== timeB) {
              if (!timeA) return 1;
              if (!timeB) return -1;
              return timeA.localeCompare(timeB);
            }
          }
        }

        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [procedures]);

  // Upcoming / overdue next execution dates of routines
  const upcomingRoutines = useMemo(() => {
    return procedures
      .filter(p => p.nextDate && p.status !== 'stand_by')
      .map(p => {
        const status = getStatusInfo(p.nextDate, p.status, proceduresBufferDays);
        return {
          ...p,
          statusInfo: status
        };
      })
      .sort((a, b) => {
        if (!a.nextDate || !b.nextDate) return 0;
        return a.nextDate.localeCompare(b.nextDate);
      })
      .slice(0, 5);
  }, [procedures, proceduresBufferDays]);

  // Family statistics
  const familyOverview = useMemo(() => {
    const list = familiars.map(fam => {
      const famProcs = procedures.filter(p => p.familiarId === fam.id || p.familiarName === fam.name);
      const overdue = famProcs.filter(p => getStatusInfo(p.nextDate, p.status, proceduresBufferDays).isOverdue).length;
      const inProcess = famProcs.filter(p => p.status === 'em_processo' || p.isEmProcesso).length;
      const upcoming = famProcs.filter(p => {
        const status = getStatusInfo(p.nextDate, p.status, proceduresBufferDays);
        return status.isUpcoming && p.status !== 'stand_by';
      }).length;
      const scheduled = famProcs.filter(p => p.steps?.some(s => s.scheduled)).length;
      
      return {
        familiar: fam,
        total: famProcs.length,
        overdue,
        inProcess,
        upcoming,
        scheduled
      };
    });

    // Sort alphabetically by name
    return list.sort((a, b) => a.familiar.name.localeCompare(b.familiar.name, 'pt-BR'));
  }, [familiars, procedures, proceduresBufferDays]);

  const criticalMedsCount = useMemo(() => {
    return medicamentos.filter(m => m.quantidadeAtual < m.estoqueMinimo).length;
  }, [medicamentos]);

  // Filtered appointments list for search in appointments table (fallback view)
  const filteredAppointments = useMemo(() => {
    if (!searchQuery) return appointments.slice(0, 5);
    return appointments.filter((app) => {
      return (
        app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.doctorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.clinicName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.specialty.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }).slice(0, 5);
  }, [appointments, searchQuery]);

  return (
    <div id="dashboard_panel" className="flex-1 flex flex-col min-h-0 space-y-6 overflow-hidden">
      {/* Header de Boas-vindas */}
      <div 
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0"
      >
        <div className="flex items-center gap-3 w-full md:w-[400px] shrink-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans">Bem-vindo(a) ao seu Painel</h1>
            <p className="text-xs text-slate-500 mt-1">Acompanhe suas rotinas, consultas e saúde familiar</p>
          </div>
        </div>
        
        <div className="flex-1 flex justify-start w-full lg:w-auto lg:ml-2">
          <PinnedItemsHeader pinnedItems={pinnedItems} onDropItem={onDropItem} onNavigateToTab={onNavigateToTab} activeTab="dashboard" />
        </div>

        <div className="hidden sm:block text-right shrink-0">
          <span className="text-xs font-bold text-slate-600 font-mono bg-slate-100 px-3 py-1 rounded-full whitespace-nowrap">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* Stats Cards Row (Procedimentos, Atrasados, Medicamentos, Em Processo, Agendados, Próximos) */}
      <div id="stats_row" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
        {/* Metric 1: Total Procedures */}
        <div 
          onClick={() => onNavigateToProceduresWithFilter ? onNavigateToProceduresWithFilter('all') : onNavigateToTab('procedures')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-98"
        >
          <div className="pb-3 border-b border-slate-50 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider">Procedimentos</span>
              <Stethoscope className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-medium">Rotinas ativas cadastradas</span>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-800 font-mono block leading-none">{stats.totalProcedures}</span>
          </div>
        </div>

        {/* Metric 2: Overdue Procedures */}
        <div 
          onClick={() => onNavigateToProceduresWithFilter ? onNavigateToProceduresWithFilter('overdue') : onNavigateToTab('procedures')}
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer active:scale-98 shadow-sm ${
            stats.overdueProcedures > 0 
              ? 'bg-rose-50/30 border-rose-100 hover:border-rose-200 hover:shadow-md' 
              : 'bg-[#ffffff] border-slate-100 hover:border-emerald-200 hover:shadow-md'
          }`}
        >
          <div className="pb-3 border-b border-slate-50 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider">Atrasados</span>
              <AlertCircle className={`w-4.5 h-4.5 ${stats.overdueProcedures > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-300'}`} />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-medium">Procedimentos fora do prazo</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className={`text-3xl font-black font-mono block leading-none ${stats.overdueProcedures > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {stats.overdueProcedures}
              </span>
            </div>
            {stats.overdueProcedures > 0 && (
              <button onClick={() => onNavigateToProceduresWithFilter ? onNavigateToProceduresWithFilter('overdue') : onNavigateToTab('procedures')} className="text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition-colors">
                Verificar
              </button>
            )}
          </div>
        </div>

        {/* Metric 3: Medication Stock / Alerts */}
        <div 
          onClick={() => {
            if (criticalMedsCount > 0 && onNavigateToMedicamentosCritical) {
              onNavigateToMedicamentosCritical();
            } else {
              onNavigateToTab('medicamentos');
            }
          }}
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer active:scale-98 shadow-sm ${
            criticalMedsCount > 0 
              ? 'bg-rose-50/30 border-rose-100 hover:border-rose-200 hover:shadow-md' 
              : 'bg-[#ffffff] border-slate-100 hover:border-emerald-200 hover:shadow-md'
          }`}
        >
          <div className="pb-3 border-b border-slate-50 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider">Medicamentos</span>
              <Pill className={`w-4.5 h-4.5 ${criticalMedsCount > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-300'}`} />
            </div>
            <span className={`text-[10px] mt-1 block font-medium ${criticalMedsCount > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
              {criticalMedsCount > 0 ? 'Estoque crítico' : 'Estoques normalizados'}
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              {criticalMedsCount > 0 ? (
                <span className="text-3xl font-black text-rose-600 font-mono block leading-none">{criticalMedsCount}</span>
              ) : (
                <span className="text-3.5xl font-black text-emerald-600 font-sans block leading-none">OK</span>
              )}
            </div>
            {criticalMedsCount > 0 && (
              <button className="text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition-colors">
                Verificar
              </button>
            )}
          </div>
        </div>

        {/* Metric 4: Active Workflows */}
        <div 
          onClick={() => onNavigateToProceduresWithFilter ? onNavigateToProceduresWithFilter('em_processo') : onNavigateToTab('procedures')}
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md active:scale-98 shadow-sm ${
            stats.activeWorkflows > 0 
              ? 'bg-[#eff6ff] border-blue-100 hover:border-blue-200' 
              : 'bg-[#ffffff] border-slate-100 hover:border-blue-200'
          }`}
        >
          <div className="pb-3 border-b border-slate-50 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider font-mono">Em Processo</span>
              <Activity className={`w-4.5 h-4.5 text-blue-500 ${stats.activeWorkflows > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-medium">Roteiros de saúde em execução</span>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-800 font-mono block leading-none">{stats.activeWorkflows}</span>
          </div>
        </div>

        {/* Metric 5: Scheduled Appointments in Calendar */}
        <div 
          onClick={() => onNavigateToProceduresWithFilter ? onNavigateToProceduresWithFilter('scheduled') : onNavigateToTab('procedures')}
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md active:scale-98 shadow-sm ${
            stats.totalScheduledAppointments > 0 
              ? 'bg-[#f0fdf4] border-emerald-100 hover:border-emerald-200' 
              : 'bg-[#ffffff] border-slate-100 hover:border-blue-200'
          }`}
        >
          <div className="pb-3 border-b border-slate-50 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider">Agendados</span>
              <CalendarIcon className="w-4.5 h-4.5 text-emerald-500" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-medium">Procedimentos com agendamentos</span>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-800 font-mono block leading-none">{stats.totalScheduledAppointments}</span>
          </div>
        </div>

        {/* Metric 6: Upcoming Procedures / "Próximos" */}
        <div 
          onClick={() => onNavigateToProceduresWithFilter ? onNavigateToProceduresWithFilter('upcoming') : onNavigateToTab('procedures')}
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md active:scale-98 shadow-sm ${
            stats.upcomingProcedures > 0 
              ? 'bg-[#fefdf0] border-amber-100 hover:border-amber-200' 
              : 'bg-[#ffffff] border-slate-100 hover:border-blue-200'
          }`}
        >
          <div className="pb-3 border-b border-slate-50 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider">Próximos</span>
              <Clock className={`w-4.5 h-4.5 ${stats.upcomingProcedures > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-medium">Prazos de prevenção próximos</span>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-800 font-mono block leading-none">
              {stats.upcomingProcedures}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Container ONLY below the metrics cards */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-6 min-h-0 pb-6">
        {/* Main Dual-Column: Active Procedures & Family Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Active Procedures (Em Processo) Block */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-800 text-sm font-sans">Acompanhamento dos procedimentos EM PROCESSO</h3>
            </div>
            <button 
              onClick={() => onNavigateToTab('procedures')}
              className="text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeProceduresList.length === 0 ? (
            <div className="py-12 text-center space-y-3.5 max-w-sm mx-auto">
              <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 mx-auto">
                <ListTodo className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Nenhum procedimento de saúde marcado como <strong>"Em processo"</strong> no momento.
              </p>
              <button
                onClick={() => onNavigateToTab('procedures')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Ativar um Procedimento
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {activeProceduresList.map(proc => {
                const totalSteps = proc.steps ? proc.steps.length : 0;
                const completedSteps = proc.steps ? proc.steps.filter(s => s.completed).length : 0;
                const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                
                return (
                  <div 
                    key={proc.id} 
                    onDoubleClick={() => onNavigateToProcedureWithEdit?.(proc.id)}
                    className="p-4 border border-slate-100 rounded-xl bg-slate-50/40 hover:bg-slate-50 transition-all space-y-3 cursor-pointer select-none hover:shadow-sm hover:border-slate-200"
                    title="Clique duas vezes para editar este procedimento"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 text-xs sm:text-sm">{proc.name}</span>
                          {proc.familiarName && (() => {
                            const familiar = familiars.find(f => f.id === proc.familiarId);
                            const colors = getFamiliarColorClasses(familiar?.color);
                            return (
                              <span 
                                className={`${colors.bg} ${colors.text} border ${colors.border} text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider`}
                                style={colors.isCustom ? {
                                  backgroundColor: `${colors.customColor}15`,
                                  color: colors.customColor,
                                  borderColor: `${colors.customColor}30`
                                } : {}}
                              >
                                {proc.familiarName}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-[10px] text-slate-400">Prestador: {proc.providerName || 'Não especificado'}</p>
                      </div>
                      <div className="text-center flex flex-col items-center shrink-0 w-28">
                        <span className="text-xs font-bold text-blue-600 font-mono">{completedSteps}/{totalSteps} Passos</span>
                        <p className="text-[10px] text-slate-400">Progresso ({progressPercent}%)</p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Steps Mini Checklist Row */}
                    <div className="pt-1">
                      {proc.steps && proc.steps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {proc.steps.map((step, idx) => (
                            <div 
                              key={step.id || idx}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] transition-colors ${
                                step.completed 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' 
                                  : 'bg-white text-slate-500 border-slate-100'
                              }`}
                            >
                              <span className="font-mono text-[9px]">{idx + 1}.</span>
                              <span className={`truncate max-w-[120px] ${step.completed ? 'line-through' : 'font-bold'}`}>{step.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo por Familiar Block */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm font-sans">Membros da Família</h3>
            </div>
            <button 
              onClick={() => onNavigateToRegistrationsWithSubTab ? onNavigateToRegistrationsWithSubTab('familiars') : onNavigateToTab('registrations')}
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {familiars.length === 0 ? (
            <div className="py-12 text-center space-y-3 max-w-[220px] mx-auto">
              <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 mx-auto">
                <User className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Nenhum familiar cadastrado para acompanhamento preventivo.
              </p>
              <button
                onClick={() => onNavigateToRegistrationsWithSubTab ? onNavigateToRegistrationsWithSubTab('familiars') : onNavigateToTab('registrations')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Cadastrar Familiar
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {familyOverview.map(({ familiar, total, overdue, inProcess, upcoming, scheduled }) => {
                const colors = getFamiliarColorClasses(familiar.color);
                const familiarMeds = (medicamentos || []).filter(m => m.pessoaId === familiar.id);
                const criticalMedsCount = familiarMeds.filter(m => m.quantidadeAtual < m.estoqueMinimo).length;
                
                return (
                  <div 
                    key={familiar.id} 
                    className={`p-3 border rounded-xl bg-white transition-all flex items-center justify-between gap-3 ${colors.border}`}
                    style={colors.isCustom ? { borderColor: `${colors.customColor}30` } : {}}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">{familiar.name}</span>
                        <span 
                           className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`}
                           style={colors.isCustom ? { backgroundColor: colors.customColor } : {}}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {familiar.birthDate ? `${getAge(familiar.birthDate)}` : 'Sem data de nascimento'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {overdue > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToProceduresWithFilter?.('overdue', familiar.id);
                          }}
                          className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer hover:bg-rose-100 transition-all h-[26px] animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.2)]"
                          title="Procedimentos Atrasados"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{overdue}</span>
                        </button>
                      )}
                      {criticalMedsCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToMedicamentosWithCriticalFilter?.(familiar.id);
                          }}
                          className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer hover:bg-rose-100 transition-all h-[26px] animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.2)]"
                          title="Estoque abaixo do mínimo"
                        >
                          <Pill className="w-3.5 h-3.5" />
                          <span>{criticalMedsCount}</span>
                        </button>
                      )}
                      {upcoming > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToProceduresWithFilter?.('upcoming', familiar.id);
                          }}
                          className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-all h-[26px]"
                          title="Procedimentos Próximos"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{upcoming}</span>
                        </button>
                      )}
                      {scheduled > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToProceduresWithFilter?.('scheduled', familiar.id);
                          }}
                          className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-all h-[26px]"
                          title="Procedimentos Agendados"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>{scheduled}</span>
                        </button>
                      )}
                      {familiarMeds.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToMedicamentosWithFilter?.(familiar.id);
                          }}
                          className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-100 cursor-pointer hover:bg-violet-100 transition-all h-[26px]"
                          title="Medicamentos totais"
                        >
                          <Pill className="w-3.5 h-3.5" />
                          <span>{familiarMeds.length}</span>
                        </button>
                      )}
                      {inProcess > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToProceduresWithFilter?.('em_processo', familiar.id);
                          }}
                          className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-all h-[26px]"
                          title="Em processo"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>{inProcess}</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToProceduresWithFilter?.('all', familiar.id);
                        }}
                        className="flex items-center gap-1 px-2 rounded-lg text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-500 cursor-pointer hover:bg-slate-100 transition-all h-[26px]"
                        title="Rotinas totais"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>{total}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Google Calendar Appointments & Scheduled Procedure Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Sync Google Calendar Appointments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-slate-800 text-sm font-sans">Próximas Consultas Sincronizadas (Google Agenda)</h3>
            </div>
            <button 
              onClick={() => onNavigateToTab('calendar')}
              className="text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver agenda</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {appointments.filter(a => a.status === 'scheduled').length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic text-xs font-sans">
              Nenhuma consulta agendada no Google Calendar.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {appointments
                .filter(a => a.status === 'scheduled')
                .slice(0, 5)
                .map((app) => (
                  <div 
                    key={app.id} 
                    onClick={() => onSelectAppointment(app)}
                    className="p-3 border border-slate-100/80 rounded-xl bg-slate-50/30 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">{app.title}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                        <span>Prof: {app.doctorName || 'Não informado'}</span>
                        <span>•</span>
                        <span>{app.specialty}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-slate-600 block">
                        {new Date(`${app.date}T00:00:00`).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">{app.startTime}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right Column: Calculated Next Routine Execution Dates */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-sm font-sans">Próximos Prazos / Frequências de Prevenção</h3>
            </div>
            <button 
              onClick={() => onNavigateToTab('procedures')}
              className="text-xs text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {upcomingRoutines.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic text-xs font-sans">
              Nenhuma rotina preventiva com prazo calculado.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {upcomingRoutines.map((proc) => (
                <div 
                  key={proc.id} 
                  className="p-3 border border-slate-100/80 rounded-xl bg-slate-50/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-700 truncate">{proc.name}</h4>
                      {proc.familiarName && (
                        <span className="bg-slate-100 text-slate-600 text-[8px] font-bold px-1 py-0.2 rounded-md uppercase tracking-wider">
                          {proc.familiarName}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      <span>Frequência: {proc.frequencyValue} {
                        proc.frequencyUnit === 'days' ? 'dia(s)' :
                        proc.frequencyUnit === 'weeks' ? 'semana(s)' :
                        proc.frequencyUnit === 'months' ? 'mes(es)' : 'ano(s)'
                      }</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${proc.statusInfo.badgeStyle}`}>
                      {proc.statusInfo.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {proc.nextDate ? new Date(`${proc.nextDate}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
