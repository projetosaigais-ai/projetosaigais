import React, { useState, useEffect } from 'react';
import { Procedure, HealthProvider, ProcedureType, ProcedureHistoryEntry, ProcedureStep, Appointment, Familiar, ProcedureCategory } from '../types';
import { 
  Plus, 
  Search, 
  Building2, 
  Calendar, 
  Clock, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Activity, 
  X, 
  Stethoscope, 
  AlertTriangle,
  RefreshCw,
  FileText,
  User,
  Users,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  History,
  Keyboard,
  HelpCircle,
  Tag,
  ArrowDown,
  MessageCircle,
  FilterX,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getFamiliarColorClasses } from './RegistrationsView';
import { PinnedItemsHeader } from './PinnedItemsHeader';

export interface TempProcedureStep extends ProcedureStep {
  pendingAction?: 'create' | 'update' | 'delete';
}

interface ProceduresViewProps {
  procedures: Procedure[];
  onSaveProcedures: (updated: Procedure[]) => void;
  providers: HealthProvider[];
  onSaveProviders: (updated: HealthProvider[]) => void;
  procedureTypes: ProcedureType[];
  onSaveProcedureTypes: (updated: ProcedureType[]) => void;
  familiars: Familiar[];
  onSaveFamiliars?: (updated: Familiar[]) => void;
  onSaveAppointment?: (app: Omit<Appointment, 'id'> & { id?: string }) => Promise<any>;
  onDeleteAppointment?: (id: string) => Promise<void>;
  pinnedItems: string[];
  onDropItem: (item: string) => void;
  onNavigateToTab: (tab: string) => void;
  appointments?: Appointment[];
  categories?: ProcedureCategory[];
  onSaveCategories?: (updated: ProcedureCategory[]) => void;
  onViewProvider?: (providerName: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  familiarFilter?: string;
  onFamiliarFilterChange?: (familiarId: string) => void;
  statusFilter?: 'all' | 'overdue' | 'upcoming' | 'ok' | 'em_processo' | 'stand_by' | 'scheduled';
  onStatusFilterChange?: (filter: 'all' | 'overdue' | 'upcoming' | 'ok' | 'em_processo' | 'stand_by' | 'scheduled') => void;
  initialEditProcedureId?: string | null;
  onClearInitialEditProcedureId?: () => void;
  proceduresBufferDays?: number;
}

const formatFrequencyUnit = (unit: 'days' | 'weeks' | 'months' | 'years', value: number = 1) => {
  if (value > 1) {
    switch (unit) {
      case 'days': return 'dias';
      case 'weeks': return 'semanas';
      case 'months': return 'meses';
      case 'years': return 'anos';
    }
  } else {
    switch (unit) {
      case 'days': return 'dia';
      case 'weeks': return 'semana';
      case 'months': return 'mês';
      case 'years': return 'ano';
    }
  }
};

const formatDateBr = (dateStr?: string) => {
  if (!dateStr) return 'Não realizada';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const calculateNextDate = (lastDateStr: string, value: number, unit: 'days' | 'weeks' | 'months' | 'years'): string => {
  if (!lastDateStr) return '';
  const date = new Date(lastDateStr + 'T12:00:00'); // Use noon to avoid timezone shift
  if (isNaN(date.getTime())) return '';
  
  switch (unit) {
    case 'days':
      date.setDate(date.getDate() + value);
      break;
    case 'weeks':
      date.setDate(date.getDate() + value * 7);
      break;
    case 'months':
      date.setMonth(date.getMonth() + value);
      break;
    case 'years':
      date.setFullYear(date.getFullYear() + value);
      break;
  }
  
  return date.toISOString().split('T')[0];
};

const getProcedureStatus = (nextDateStr?: string, statusStr?: string, bufferDays: number = 15) => {
  if (statusStr === 'em_processo') {
    return {
      label: 'Em processo',
      color: 'blue',
      badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse font-bold'
    };
  }

  if (statusStr === 'stand_by') {
    return {
      label: 'Stand By',
      color: 'slate',
      badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200 font-bold'
    };
  }
  
  if (!nextDateStr) return { label: 'Sem data', color: 'slate', badgeStyle: 'bg-slate-50 text-slate-500 border-slate-200' };
  
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr + 'T00:00:00');
  const next = new Date(nextDateStr + 'T00:00:00');
  
  const diffTime = next.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { 
      label: `Atrasado há ${Math.abs(diffDays)} dia(s)`, 
      color: 'rose', 
      badgeStyle: 'bg-rose-50 text-rose-600 border-rose-100' 
    };
  } else if (diffDays === 0) {
    return { 
      label: 'É hoje!', 
      color: 'amber', 
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse font-bold' 
    };
  } else if (diffDays <= bufferDays) {
    return { 
      label: `Próximo (${diffDays} dias)`, 
      color: 'amber', 
      badgeStyle: 'bg-amber-50/70 text-amber-600 border-amber-100' 
    };
  } else {
    return { 
      label: 'Em dia', 
      color: 'emerald', 
      badgeStyle: 'bg-[#dbfce7] text-green-900 border-green-300 font-bold' 
    };
  }
};

const SUGGESTIONS = [
  'Consulta Geral',
  'Exame de Sangue',
  'Consulta Odontológica',
  'Exame Oftalmológico',
  'Retorno de Consulta',
  'Consulta Cardiológica',
  'Mamografia',
  'Check-up Ginecológico',
  'Prevenção anual',
];

export default function ProceduresView({ 
  procedures, 
  onSaveProcedures,
  providers,
  onSaveProviders,
  procedureTypes,
  onSaveProcedureTypes,
  familiars = [],
  onSaveFamiliars,
  onSaveAppointment,
  onDeleteAppointment,
  pinnedItems,
  onDropItem,
  onNavigateToTab,
  appointments = [],
  categories = [],
  onSaveCategories,
  onViewProvider,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  familiarFilter: externalFamiliarFilter,
  onFamiliarFilterChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  initialEditProcedureId,
  onClearInitialEditProcedureId,
  proceduresBufferDays = 15
}: ProceduresViewProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setLocalSearchQuery(val);
    }
  };

  const [localFamiliarFilter, setLocalFamiliarFilter] = useState<string>('all');
  const familiarFilter = externalFamiliarFilter !== undefined ? externalFamiliarFilter : localFamiliarFilter;
  const setFamiliarFilter = (val: string) => {
    if (onFamiliarFilterChange) {
      onFamiliarFilterChange(val);
    } else {
      setLocalFamiliarFilter(val);
    }
  };

  const [localStatusFilter, setLocalStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'ok' | 'em_processo' | 'stand_by' | 'scheduled'>('all');
  const statusFilter = externalStatusFilter !== undefined ? externalStatusFilter : localStatusFilter;
  const setStatusFilter = (val: 'all' | 'overdue' | 'upcoming' | 'ok' | 'em_processo' | 'stand_by' | 'scheduled') => {
    if (onStatusFilterChange) {
      onStatusFilterChange(val);
    } else {
      setLocalStatusFilter(val);
    }
  };

  const [procedureSortBy, setProcedureSortBy] = useState<'status' | 'familiar' | 'procedimento' | 'prestador' | 'proxima_realizacao'>('status');
  const [procedureSortOrder, setProcedureSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: 'status' | 'familiar' | 'procedimento' | 'prestador' | 'proxima_realizacao') => {
    if (procedureSortBy === column) {
      setProcedureSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProcedureSortBy(column);
      setProcedureSortOrder('asc'); // Default everything to 'asc' on first click!
    }
  };

  const handleClearFiltersAndSort = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setFamiliarFilter('all');
    setProcedureSortBy('status');
    setProcedureSortOrder('asc');
  };

  const hasActiveFiltersOrSort = 
    searchQuery !== '' || 
    statusFilter !== 'all' || 
    familiarFilter !== 'all' || 
    procedureSortBy !== 'status' || 
    procedureSortOrder !== 'asc';
  
  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [providerName, setProviderName] = useState('');
  const [frequencyValue, setFrequencyValue] = useState<number>(6);
  const [frequencyUnit, setFrequencyUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('months');
  const [lastDate, setLastDate] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [manualNextDate, setManualNextDate] = useState(false);
  const [nextDateInstructions, setNextDateInstructions] = useState('');
  const [isEmProcesso, setIsEmProcesso] = useState(false);
  const [isStandBy, setIsStandBy] = useState(false);
  const [specificity, setSpecificity] = useState('');
  const [selectedFamiliarId, setSelectedFamiliarId] = useState('');
  const [familiarName, setFamiliarName] = useState('');
  const [formError, setFormError] = useState('');
  const [showNextDateHelp, setShowNextDateHelp] = useState(false);

  const [activeSection, setActiveSection] = useState<'none' | 'step' | 'history'>('none');
  const isAnySectionActive = activeSection !== 'none';

  // Quick Add Sub-states (Mini forms inside the Procedure modal)
  const [showQuickProviderForm, setShowQuickProviderForm] = useState(false);
  const [quickProvName, setQuickProvName] = useState('');
  const [quickProvSpecialty, setQuickProvSpecialty] = useState('');
  const [quickProvWhatsApp, setQuickProvWhatsApp] = useState('');

  const [showQuickTypeForm, setShowQuickTypeForm] = useState(false);
  const [quickTypeName, setQuickTypeName] = useState('');
  const [quickTypeFreqValue, setQuickTypeFreqValue] = useState(6);
  const [quickTypeFreqUnit, setQuickTypeFreqUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('months');

  const [showQuickFamiliarForm, setShowQuickFamiliarForm] = useState(false);
  const [quickFamiliarName, setQuickFamiliarName] = useState('');
  const [quickFamiliarPhone, setQuickFamiliarPhone] = useState('');

  const [showQuickCategoryForm, setShowQuickCategoryForm] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');

  // Temporary History inside Modal State
  const [tempHistory, setTempHistory] = useState<ProcedureHistoryEntry[]>([]);
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState('');
  const [historyProvider, setHistoryProvider] = useState('');
  const [historyNotes, setHistoryNotes] = useState('');

  // Temporary Steps inside Modal State
  const [tempSteps, setTempSteps] = useState<TempProcedureStep[]>([]);
  const [initialTempSteps, setInitialTempSteps] = useState<TempProcedureStep[]>([]);
  const [isCancelled, setIsCancelled] = useState(false);
  const isRegisteringMode = tempSteps.length > 0 && tempSteps.every(s => s.completed) && !isCancelled;
  const [pendingAppointments, setPendingAppointments] = useState<{appointmentId?: string, data: any}[]>([]);
  const [deletedAppointments, setDeletedAppointments] = useState<string[]>([]);
  const [stepsNextInstructions, setStepsNextInstructions] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState('');
  const [stepTargetDate, setStepTargetDate] = useState('');

  // States for scheduling a step/action in the integrated agenda (Google Calendar)
  const [schedulingStepId, setSchedulingStepId] = useState<string | null>(null); // To open the intra-window
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndTime, setSchedEndTime] = useState('10:00');
  const [schedType, setSchedType] = useState<'consulta' | 'exame' | 'retorno' | 'outros'>('consulta');
  const [schedDoctorName, setSchedDoctorName] = useState('');
  const [schedClinicName, setSchedClinicName] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedAllDay, setSchedAllDay] = useState(false);
  const [isSchedSubmitting, setIsSchedSubmitting] = useState(false);
  const [schedSuccessMsg, setSchedSuccessMsg] = useState('');

  const currentStepForModal = tempSteps.find(s => s.id === schedulingStepId);
  const isCurrentlyScheduled = !!currentStepForModal?.scheduled && !!currentStepForModal?.appointmentId;

  const initiateScheduling = (step: ProcedureStep) => {
    setSchedulingStepId(step.id);
    
    const existingApp = step.appointmentId ? appointments.find(a => a.id === step.appointmentId) : null;
    
    if (existingApp) {
      setSchedTitle(existingApp.title);
      setSchedDate(existingApp.date);
      setSchedStartTime(existingApp.startTime || '09:00');
      setSchedEndTime(existingApp.endTime || '10:00');
      setSchedType(existingApp.type || 'consulta');
      setSchedDoctorName(existingApp.doctorName || '');
      setSchedClinicName(existingApp.clinicName || '');
      setSchedNotes(existingApp.notes || '');
      setSchedAllDay(!!existingApp.allDay);
    } else {
      setSchedTitle(step.title);
      setSchedDate(step.targetDate);
      setSchedStartTime('09:00');
      setSchedEndTime('10:00');
      setSchedAllDay(!!step.allDay);
      
      // Guess type based on name
      const lowerTitle = step.title.toLowerCase();
      if (lowerTitle.includes('consulta')) {
        setSchedType('consulta');
      } else if (lowerTitle.includes('exame') || lowerTitle.includes('sangue') || lowerTitle.includes('teste')) {
        setSchedType('exame');
      } else if (lowerTitle.includes('retorno') || lowerTitle.includes('reconsulta')) {
        setSchedType('retorno');
      } else {
        setSchedType('outros');
      }

      // Prefill Doctor and Clinic from the procedure form state if they exist
      setSchedDoctorName(providerName && providerName !== 'Não informado' ? providerName : '');
      const foundProv = providers.find(p => p.id === selectedProviderId) || providers.find(p => p.name.toLowerCase() === providerName.toLowerCase());
      setSchedClinicName(foundProv?.address || '');
      setSchedNotes(`Etapa agendada a partir do procedimento de "${name || 'Procedimento em processo'}"`);
    }
    setSchedSuccessMsg('');
  };

  const handleSchedStartTimeChange = (val: string) => {
    setSchedStartTime(val);
    const [hours, minutes] = val.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const endHours = (hours + 1) % 24;
      const endVal = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      setSchedEndTime(endVal);
    }
  };

  const handleOpenSchedulingForNewStep = () => {
    if (!stepTitle.trim()) {
      alert('Por favor, informe o nome da etapa para agendar.');
      return;
    }
    if (!stepTargetDate) {
      alert('Por favor, informe a data para agendar.');
      return;
    }

    // First save the step to tempSteps if it's not already added
    const newStepId = 'step_temp_' + Date.now();
    const newStep: ProcedureStep = {
      id: newStepId,
      title: stepTitle.trim(),
      targetDate: stepTargetDate,
      completed: false,
      scheduled: false
    };

    setTempSteps(prev => [...prev, newStep].sort((a, b) => b.targetDate.localeCompare(a.targetDate)));
    setIsAddingStep(false); // Close the step input form since we are moving to the intra-window
    setActiveSection('none');

    // Open scheduling intra-window
    initiateScheduling(newStep);
  };

  const handleConfirmScheduling = async () => {
    if (!schedTitle.trim()) {
      alert('Por favor, informe o título do compromisso.');
      return;
    }
    if (!schedDate) {
      alert('Por favor, informe a data do compromisso.');
      return;
    }

    setIsSchedSubmitting(true);
    try {
      const stepForScheduling = tempSteps.find(s => s.id === schedulingStepId);
      
      // Generate a temporary ID for the pending appointment if it's new
      const tempAppointmentId = stepForScheduling?.appointmentId || `temp_${crypto.randomUUID()}`;

      const appointmentData = {
        id: stepForScheduling?.appointmentId && !stepForScheduling.appointmentId.startsWith('temp_') ? stepForScheduling.appointmentId : undefined,
        title: schedTitle.trim(),
        type: schedType,
        specialty: 'Geral',
        doctorName: schedDoctorName.trim() || undefined,
        clinicName: schedClinicName.trim() || undefined,
        date: schedDate,
        startTime: schedAllDay ? '' : schedStartTime,
        endTime: schedAllDay ? '' : schedEndTime,
        notes: schedNotes.trim() || undefined,
        status: 'scheduled',
        allDay: schedAllDay
      };

      setPendingAppointments(prev => {
        const filtered = prev.filter(p => p.appointmentId !== tempAppointmentId);
        return [...filtered, { appointmentId: tempAppointmentId, data: appointmentData }];
      });
      setDeletedAppointments(prev => prev.filter(id => id !== tempAppointmentId));

      // Update the step in tempSteps to mark it as scheduled!
      setTempSteps(prev => prev.map(s => {
        if (s.id === schedulingStepId) {
          return {
            ...s,
            scheduled: true,
            appointmentId: tempAppointmentId, // Use temp ID
            targetDate: schedDate, 
            scheduledDate: schedDate,
            scheduledTime: schedAllDay ? undefined : schedStartTime,
            allDay: schedAllDay
          };
        }
        return s;
      }).sort((a, b) => b.targetDate.localeCompare(a.targetDate)));

      setSchedSuccessMsg('Compromisso agendado pendente de salvamento do procedimento!');
      setTimeout(() => {
        setActiveSection('none');
        setSchedulingStepId(null);
      }, 1500);
    } catch (err) {
      console.error('Error scheduling:', err);
      alert('Erro ao agendar compromisso.');
    } finally {
      setIsSchedSubmitting(false);
    }
  };

  const handleDeleteScheduling = async () => {
    const stepForScheduling = tempSteps.find(s => s.id === schedulingStepId);
    const appointmentIdToDelete = stepForScheduling?.appointmentId;
    if (!appointmentIdToDelete) {
      alert('Este compromisso não possui um id de agendamento válido.');
      return;
    }

    setIsSchedSubmitting(true);
    try {
      // Queue for deletion if it is a real appointment (not a temp one)
      if (!appointmentIdToDelete.startsWith('temp_')) {
        setDeletedAppointments(prev => {
          if (prev.includes(appointmentIdToDelete)) return prev;
          return [...prev, appointmentIdToDelete];
        });
      }

      // Remove from pendingAppointments if it was newly added/modified in this session
      setPendingAppointments(prev => prev.filter(p => p.appointmentId !== appointmentIdToDelete));

      // Update the step in tempSteps to mark it as NOT scheduled!
      setTempSteps(prev => prev.map(s => {
        if (s.id === schedulingStepId) {
          return {
            ...s,
            scheduled: false,
            appointmentId: undefined,
            scheduledDate: undefined,
            scheduledTime: undefined
          };
        }
        return s;
      }).sort((a, b) => b.targetDate.localeCompare(a.targetDate)));

      setSchedSuccessMsg('Agendamento excluído pendente de salvamento do procedimento!');
      setTimeout(() => {
        setSchedulingStepId(null);
      }, 1500);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Erro ao excluir agendamento.');
    } finally {
      setIsSchedSubmitting(false);
    }
  };

  // Auto-recalculate next date based on frequency and lastDate unless overridden, in Stand By, or in "Em Processo"
  useEffect(() => {
    if (isStandBy) {
      setNextDate('');
      return;
    }
    if (isEmProcesso) {
      const pendingSteps = tempSteps.filter(s => !s.completed);
      if (pendingSteps.length > 0) {
        const sorted = [...pendingSteps].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
        setNextDate(sorted[0].targetDate);
      } else {
        setNextDate('');
      }
      return;
    }
    if (!manualNextDate) {
      if (lastDate) {
        const calculated = calculateNextDate(lastDate, frequencyValue, frequencyUnit);
        setNextDate(calculated);
      } else {
        setNextDate('');
      }
    }
  }, [lastDate, frequencyValue, frequencyUnit, manualNextDate, isStandBy, isEmProcesso, tempSteps]);

  // Sync lastDate with the most recent date in tempHistory
  useEffect(() => {
    if (tempHistory.length > 0) {
      const sorted = [...tempHistory].sort((a, b) => b.date.localeCompare(a.date));
      setLastDate(sorted[0].date);
    } else {
      setManualNextDate(false);
      if (!isEmProcesso && !isStandBy) {
        setLastDate(new Date().toISOString().split('T')[0]);
      } else {
        setLastDate(prev => prev || new Date().toISOString().split('T')[0]);
      }
    }
  }, [tempHistory, isEmProcesso, isStandBy]);

  // Disable and reset manualNextDate during inclusion if not "em processo"
  useEffect(() => {
    if (!editingProcedure && !isEmProcesso) {
      setManualNextDate(false);
    }
  }, [editingProcedure, isEmProcesso]);

  // Open procedure for editing if requested externally (e.g. from Dashboard dblclick)
  useEffect(() => {
    if (initialEditProcedureId) {
      const found = procedures.find(p => p.id === initialEditProcedureId);
      if (found) {
        handleOpenEdit(found);
        if (onClearInitialEditProcedureId) {
          onClearInitialEditProcedureId();
        }
      }
    }
  }, [initialEditProcedureId, procedures, onClearInitialEditProcedureId]);

  // Open modal for creating a new procedure
  const handleOpenCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingProcedure(null);
    setName('');
    setCategory('');
    setSelectedProviderId('');
    setProviderName('');
    setSelectedFamiliarId('');
    setFamiliarName('');
    setFormError('');
    setShowNextDateHelp(false);
    setFrequencyValue(6);
    setFrequencyUnit('months');
    setLastDate(today);
    setNextDate(calculateNextDate(today, 6, 'months'));
    setManualNextDate(false);
    setIsEmProcesso(false);
    setIsStandBy(false);
    setSpecificity('');
    setNextDateInstructions('');
    setShowQuickProviderForm(false);
    setQuickProvName('');
    setQuickProvSpecialty('');
    setQuickProvWhatsApp('');
    setShowQuickTypeForm(false);
    setShowQuickFamiliarForm(false);
    setQuickFamiliarName('');
    setQuickFamiliarPhone('');
    setShowQuickCategoryForm(false);
    setQuickCategoryName('');
    // Reset temporary history states
    setTempHistory([]);
    setIsAddingHistory(false);
    setEditingHistoryId(null);
    setHistoryDate(new Date().toISOString().split('T')[0]);
    setHistoryProvider('');
    setHistoryNotes('');
    // Reset steps states
    setTempSteps([]);
    setPendingAppointments([]);
    setDeletedAppointments([]);
    setStepsNextInstructions('');
    setIsAddingStep(false);
    setEditingStepId(null);
    setStepTitle('');
    setStepTargetDate(new Date().toISOString().split('T')[0]);
    setSchedulingStepId(null);
    setTempSteps([]);
    setInitialTempSteps([]);
    setIsCancelled(false);
    setShowModal(true);
  };

  // Open modal for editing an existing procedure
  const handleOpenEdit = (proc: Procedure) => {
    const defaultLastDate = proc.lastDate || (proc.history && proc.history.length > 0 ? '' : new Date().toISOString().split('T')[0]);
    const isManual = proc.manualNextDate ?? (proc.nextDate ? true : false);
    const initialNextDate = isManual 
      ? (proc.nextDate || '') 
      : (defaultLastDate ? calculateNextDate(defaultLastDate, proc.frequencyValue, proc.frequencyUnit) : '');

    setEditingProcedure(proc);
    setName(proc.name);
    setCategory(proc.category || '');
    setSelectedProviderId(proc.providerId || '');
    setProviderName(proc.providerName);
    setSelectedFamiliarId(proc.familiarId || '');
    setFamiliarName(proc.familiarName || '');
    setFormError('');
    setShowNextDateHelp(false);
    setFrequencyValue(proc.frequencyValue);
    setFrequencyUnit(proc.frequencyUnit);
    setLastDate(defaultLastDate);
    setNextDate(initialNextDate);
    setManualNextDate(isManual);
    setIsEmProcesso(proc.status === 'em_processo');
    setIsStandBy(proc.status === 'stand_by');
    setSpecificity(proc.specificity || '');
    setNextDateInstructions(proc.nextDateInstructions || '');
    setShowQuickProviderForm(false);
    setQuickProvName('');
    setQuickProvSpecialty('');
    setQuickProvWhatsApp('');
    setShowQuickTypeForm(false);
    setShowQuickFamiliarForm(false);
    setQuickFamiliarName('');
    setQuickFamiliarPhone('');
    setShowQuickCategoryForm(false);
    setQuickCategoryName('');
    // Initialize temporary history from existing procedure history
    setTempHistory(proc.history || []);
    setIsAddingHistory(false);
    setEditingHistoryId(null);
    setHistoryDate(new Date().toISOString().split('T')[0]);
    setHistoryProvider('');
    setHistoryNotes('');
    // Initialize temporary steps from existing procedure steps
    const steps = [...(proc.steps || [])].sort((a, b) => b.targetDate.localeCompare(a.targetDate));
    setTempSteps(steps);
    setInitialTempSteps(steps);
    setIsCancelled(false);
    setPendingAppointments([]);
    setDeletedAppointments([]);
    setStepsNextInstructions('');
    setIsAddingStep(false);
    setEditingStepId(null);
    setStepTitle('');
    setStepTargetDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  // Handle selecting a Procedure Type and applying defaults
  const handleSelectProcedureType = (typeNameStr: string) => {
    setName(typeNameStr);
    const foundType = procedureTypes.find(t => t.name === typeNameStr);
    if (foundType) {
      if (foundType.defaultFrequencyValue !== undefined) {
        setFrequencyValue(foundType.defaultFrequencyValue);
      }
      if (foundType.defaultFrequencyUnit !== undefined) {
        setFrequencyUnit(foundType.defaultFrequencyUnit);
      }
      // Reset specificity if not generic
      if (!foundType.isGeneric) {
        setSpecificity('');
      }
    } else {
      setSpecificity('');
    }
  };

  // Handle selecting a Provider
  const handleSelectProvider = (provId: string) => {
    setSelectedProviderId(provId);
    const foundProv = providers.find(p => p.id === provId);
    if (foundProv) {
      setProviderName(foundProv.name);
    } else {
      setProviderName('');
    }
  };

  // Save quick provider on the fly inside modal
  const handleSaveQuickProvider = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickProvName.trim()) return;

    const newProvider: HealthProvider = {
      id: crypto.randomUUID(),
      name: quickProvName.trim(),
      specialty: quickProvSpecialty.trim() || undefined,
      whatsapp: quickProvWhatsApp.trim() || undefined
    };

    const updated = [newProvider, ...providers];
    onSaveProviders(updated);
    
    // Auto-select newly created provider
    setProviderName(newProvider.name);
    setSelectedProviderId(newProvider.id);
    
    // Clear & hide form
    setQuickProvName('');
    setQuickProvSpecialty('');
    setQuickProvWhatsApp('');
    setShowQuickProviderForm(false);
  };

  // Save quick procedure type on the fly inside modal
  const handleSaveQuickType = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickTypeName.trim()) return;

    const newType: ProcedureType = {
      id: crypto.randomUUID(),
      name: quickTypeName.trim(),
      defaultFrequencyValue: quickTypeFreqValue,
      defaultFrequencyUnit: quickTypeFreqUnit
    };

    const updated = [newType, ...procedureTypes];
    onSaveProcedureTypes(updated);

    // Auto-select & set default frequency
    setName(newType.name);
    setFrequencyValue(quickTypeFreqValue);
    setFrequencyUnit(quickTypeFreqUnit);

    // Clear & hide form
    setQuickTypeName('');
    setQuickTypeFreqValue(6);
    setQuickTypeFreqUnit('months');
    setShowQuickTypeForm(false);
  };

  // Save quick familiar on the fly inside modal
  const handleSaveQuickFamiliar = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickFamiliarName.trim()) return;

    const newFamiliar: Familiar = {
      id: crypto.randomUUID(),
      name: quickFamiliarName.trim(),
      phone: quickFamiliarPhone.trim() || undefined
    };

    const updated = [...familiars, newFamiliar];
    if (onSaveFamiliars) {
      onSaveFamiliars(updated);
    }
    
    // Auto-select newly created familiar
    setFamiliarName(newFamiliar.name);
    setSelectedFamiliarId(newFamiliar.id);
    setFormError('');
    
    // Clear & hide form
    setQuickFamiliarName('');
    setQuickFamiliarPhone('');
    setShowQuickFamiliarForm(false);
  };

  // Save quick category on the fly inside modal
  const handleSaveQuickCategory = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickCategoryName.trim()) return;

    const newCategory: ProcedureCategory = {
      id: crypto.randomUUID(),
      name: quickCategoryName.trim()
    };

    const updated = [newCategory, ...(categories || [])];
    if (onSaveCategories) {
      onSaveCategories(updated);
    }

    // Auto-select
    setCategory(newCategory.name);

    // Clear & hide form
    setQuickCategoryName('');
    setShowQuickCategoryForm(false);
  };

  // Handle saving (Create/Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Por favor, informe o nome do procedimento.');
      return;
    }
    if (!category) {
      setFormError('Por favor, informe a categoria do procedimento.');
      return;
    }
    if (!selectedFamiliarId) {
      setFormError('Por favor, selecione um Familiar/Beneficiário para o procedimento. Se não houver nenhum, cadastre um familiar primeiro.');
      return;
    }

    setFormError('');
    setIsSchedSubmitting(true);

    try {
        let currentSteps = [...tempSteps];

        // Process new/updated appointments only on save
        for (const pending of pendingAppointments) {
            const savedApp = onSaveAppointment ? await onSaveAppointment(pending.data) : null;
            // Use saved ID from Google Agenda if available, else fallback to temp/local ID to keep it working locally
            const realId = savedApp?.id || pending.appointmentId || `appt_local_${crypto.randomUUID()}`;

            // Update step
            currentSteps = currentSteps.map(s => {
                if (s.appointmentId === pending.appointmentId || (s.appointmentId?.startsWith('temp_') && pending.appointmentId === undefined)) {
                     return { ...s, appointmentId: realId };
                }
                return s;
            });
        }

        const procedureData: Procedure = {
          id: editingProcedure ? editingProcedure.id : crypto.randomUUID(),
          name: name.trim(),
          category: category,
          providerId: selectedProviderId || undefined,
          providerName: providerName.trim() || 'Não informado',
          familiarId: selectedFamiliarId || undefined,
          familiarName: familiarName.trim() || undefined,
          frequencyValue: Number(frequencyValue) || 1,
          frequencyUnit,
          lastDate: lastDate || undefined,
          nextDate: isStandBy ? undefined : (nextDate || undefined),
          history: tempHistory,
          status: isStandBy ? 'stand_by' : (isEmProcesso ? 'em_processo' : undefined),
          steps: currentSteps,
          manualNextDate: manualNextDate,
          nextDateInstructions: nextDateInstructions.trim() || undefined,
          specificity: specificity.trim() || undefined,
        };

        let updatedList: Procedure[];
        if (editingProcedure) {
          updatedList = procedures.map(p => p.id === editingProcedure.id ? procedureData : p);
        } else {
          updatedList = [procedureData, ...procedures];
        }

        onSaveProcedures(updatedList);

        // Process deletions in Google Agenda only after successful procedure save
        if (onDeleteAppointment) {
            for (const apptId of deletedAppointments) {
                if (!apptId.startsWith('temp_') && !apptId.startsWith('appt_local_')) {
                    try {
                        await onDeleteAppointment(apptId);
                    } catch (e) {
                        console.error('Failed to delete appointment from Google Agenda:', e);
                    }
                }
            }
        }

        setShowModal(false);
    } catch (err) {
        console.error('Error saving procedure:', err);
        setFormError('Erro ao salvar procedimento. Tente novamente.');
    } finally {
        setIsSchedSubmitting(false);
    }
  };

  // Handle deleting
  const handleDelete = async (id: string) => {
    const proc = procedures.find(p => p.id === id);
    if (proc && proc.steps && onDeleteAppointment) {
      for (const step of proc.steps) {
        if (step.scheduled && step.appointmentId && !step.appointmentId.startsWith('appt_local_')) {
          try {
            await onDeleteAppointment(step.appointmentId);
          } catch (err) {
            console.error('Failed to delete appointment on procedure deletion:', err);
          }
        }
      }
    }
    const updated = procedures.filter(p => p.id !== id);
    onSaveProcedures(updated);
    setConfirmDeleteId(null);
  };

  // Handle saving past entry to temp history inside modal
  const handleSaveTempHistoryEntry = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!historyDate) return;

    if (editingHistoryId) {
      const updatedHistory = tempHistory.map(entry => {
        if (entry.id === editingHistoryId) {
          return {
            ...entry,
            date: historyDate,
            providerName: historyProvider.trim() || undefined,
            notes: historyNotes.trim() || undefined
          };
        }
        return entry;
      }).sort((a, b) => b.date.localeCompare(a.date));
      setTempHistory(updatedHistory);
      setEditingHistoryId(null);

      // Auto-update form lastDate to the most recent history entry
      if (updatedHistory.length > 0) {
        setLastDate(updatedHistory[0].date);
      }
    } else {
      const newEntry: ProcedureHistoryEntry = {
        id: crypto.randomUUID(),
        date: historyDate,
        providerName: historyProvider.trim() || undefined,
        notes: historyNotes.trim() || undefined
      };

      const updatedHistory = [newEntry, ...tempHistory].sort((a, b) => b.date.localeCompare(a.date));
      setTempHistory(updatedHistory);

      // Auto-update form lastDate to the most recent history entry
      if (updatedHistory.length > 0) {
        setLastDate(updatedHistory[0].date);
      }
    }

    // Reset sub-form fields
    setHistoryDate(new Date().toISOString().split('T')[0]);
    setHistoryProvider('');
    setHistoryNotes('');
    setIsAddingHistory(false);
    setActiveSection('none');
  };

  // Handle deleting entry from temp history inside modal
  const handleDeleteTempHistoryEntry = (entryId: string) => {
    const updatedHistory = tempHistory.filter(e => e.id !== entryId);
    setTempHistory(updatedHistory);

    // Re-evaluate lastDate if to keep it in sync with the newest remaining history entry
    if (updatedHistory.length > 0) {
      const sorted = [...updatedHistory].sort((a, b) => b.date.localeCompare(a.date));
      setLastDate(sorted[0].date);
    } else {
      setLastDate('');
    }
  };

  // Handle saving step to temp steps inside modal
  const handleSaveTempStep = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!stepTitle.trim() || !stepTargetDate) return;

    if (editingStepId) {
      const updatedSteps = tempSteps.map(s => {
        if (s.id === editingStepId) {
          return {
            ...s,
            title: stepTitle.trim(),
            targetDate: stepTargetDate,
            scheduledDate: s.scheduled ? stepTargetDate : s.scheduledDate
          };
        }
        return s;
      }).sort((a, b) => b.targetDate.localeCompare(a.targetDate));
      setTempSteps(updatedSteps);
      setEditingStepId(null);
    } else {
      const newStep: ProcedureStep = {
        id: crypto.randomUUID(),
        title: stepTitle.trim(),
        targetDate: stepTargetDate,
        completed: false
      };

      const updatedSteps = [...tempSteps, newStep].sort((a, b) => b.targetDate.localeCompare(a.targetDate));
      setTempSteps(updatedSteps);

      // Ao salvar a primeira etapa, muda o status do procedimento para "em processo"
      if (!isEmProcesso) {
        setIsEmProcesso(true);
        setIsStandBy(false);
      }
    }

    // Reset sub-form fields
    setStepTitle('');
    setStepTargetDate(new Date().toISOString().split('T')[0]);
    setIsAddingStep(false);
    setActiveSection('none');
  };

  // Handle toggling step completion inside modal
  const handleToggleTempStep = async (stepId: string) => {
    const step = tempSteps.find(s => s.id === stepId);
    if (!step) return;

    const willBeCompleted = !step.completed;

    if (willBeCompleted && step.scheduled && step.appointmentId) {
      setDeletedAppointments(prev => [...prev, step.appointmentId!]);
    } else if (!willBeCompleted && step.scheduled && step.appointmentId) {
      setDeletedAppointments(prev => prev.filter(id => id !== step.appointmentId));
    }

    const updatedSteps = tempSteps.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          completed: willBeCompleted,
          scheduled: willBeCompleted ? false : s.scheduled,
          appointmentId: willBeCompleted ? undefined : s.appointmentId,
          scheduledDate: willBeCompleted ? undefined : s.scheduledDate,
          scheduledTime: willBeCompleted ? undefined : s.scheduledTime
        };
      }
      return s;
    });
    setTempSteps(updatedSteps);
    setIsCancelled(false);
  };

  const handleCancelRegisterSteps = () => {
    const revertedSteps = tempSteps.map(s => {
      const initial = initialTempSteps.find(i => i.id === s.id);
      if (initial) {
        return { 
          ...s, 
          completed: initial.completed,
          scheduled: initial.scheduled,
          appointmentId: initial.appointmentId,
          scheduledDate: initial.scheduledDate,
          scheduledTime: initial.scheduledTime
        };
      }
      return { ...s, completed: false };
    });
    setTempSteps(revertedSteps);
    setIsCancelled(true);
  };

  // Handle deleting step inside modal
  const handleDeleteTempStep = async (stepId: string) => {
    const step = tempSteps.find(s => s.id === stepId);
    if (step && step.scheduled && step.appointmentId) {
        if (!step.appointmentId.startsWith('temp_')) {
            setDeletedAppointments(prev => [...prev, step.appointmentId!]);
        } else {
            // Remove from pending if it was never saved to Google
            setPendingAppointments(prev => prev.filter(p => p.appointmentId !== step.appointmentId));
        }
    }
    const updatedSteps = tempSteps.filter(s => s.id !== stepId);
    setTempSteps(updatedSteps);
  };

  // Handle registering steps to history once all are completed
  const handleRegisterStepsToHistory = (e: React.MouseEvent) => {
    e.preventDefault();
    if (tempSteps.length === 0) return;

    // Find the most recent date from the steps
    const latestDate = tempSteps.reduce((latest, s) => {
      return !latest || s.targetDate > latest ? s.targetDate : latest;
    }, '');

    // Aggregate step names
    const stepsNotes = tempSteps.map(s => `${formatDateBr(s.targetDate)} - ${s.title}`).join('\n');
    const notesText = stepsNotes;

    const newEntry: ProcedureHistoryEntry = {
      id: crypto.randomUUID(),
      date: latestDate || new Date().toISOString().split('T')[0],
      providerName: 'Etapas do Procedimento',
      notes: notesText
    };

    const updatedHistory = [newEntry, ...tempHistory].sort((a, b) => b.date.localeCompare(a.date));
    setTempHistory(updatedHistory);

    // If step instructions are filled, copy them to the main nextDateInstructions field
    if (stepsNextInstructions.trim()) {
      setNextDateInstructions(stepsNextInstructions.trim());
    }
    setStepsNextInstructions('');

    // Auto-update lastDate to the newest history date
    if (!lastDate || (latestDate && latestDate >= lastDate)) {
      setLastDate(latestDate);
    }

    // Deactivate "em processo" and clear steps
    setIsEmProcesso(false);
    setTempSteps([]);
  };

  // Stats calculation
  const proceduresByFamiliar = familiarFilter === 'all'
    ? procedures
    : procedures.filter(p => p.familiarId === familiarFilter);

  const totalCount = proceduresByFamiliar.length;
  let overdueCount = 0;
  let upcomingCount = 0;
  let okCount = 0;
  let emProcessoCount = 0;
  let standByCount = 0;
  let scheduledCount = 0;

  proceduresByFamiliar.forEach(p => {
    const status = getProcedureStatus(p.nextDate, p.status, proceduresBufferDays);

    // Contagem de agendados (qualquer procedimento com etapa agendada)
    if (p.steps?.some(s => s.scheduled)) {
      scheduledCount++;
    }

    if (p.status === 'stand_by') standByCount++;
    else if (status.color === 'blue') emProcessoCount++;
    else if (status.color === 'rose') overdueCount++;
    else if (status.color === 'amber') upcomingCount++;
    else if (status.color === 'emerald') okCount++;
  });

  // Filter & Search logic
  const filteredProcedures = procedures.filter(p => {
    // Search filter
    const familiar = familiars.find(f => f.id === p.familiarId);
    const familiarName = familiar ? familiar.name : (p.familiarId === 'proprio' ? 'Próprio Usuário' : '');
    
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          familiarName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Tab filter
    const status = getProcedureStatus(p.nextDate, p.status, proceduresBufferDays);
    if (statusFilter === 'em_processo' && status.color !== 'blue') return false;
    if (statusFilter === 'stand_by' && p.status !== 'stand_by') return false;
    if (statusFilter === 'scheduled' && !p.steps?.some(s => s.scheduled)) return false;
    if (statusFilter === 'overdue' && (status.color !== 'rose' || p.status === 'stand_by')) return false;
    if (statusFilter === 'upcoming' && (status.color !== 'amber' || p.status === 'stand_by')) return false;
    if (statusFilter === 'ok' && (status.color !== 'emerald' || p.status === 'stand_by')) return false;
    
    // Familiar filter
    if (familiarFilter !== 'all') {
      return p.familiarId === familiarFilter;
    }
    
    return true;
  }).sort((a, b) => {
    // Helper para obter a data efetiva da próxima realização (considerando etapas em processo)
    const getEffectiveNextDate = (proc: Procedure): string => {
      if (proc.status === 'em_processo' && proc.steps && proc.steps.length > 0) {
        const oldestUncompleted = [...proc.steps]
          .filter(s => !s.completed)
          .sort((x, y) => x.targetDate.localeCompare(y.targetDate))[0];
        if (oldestUncompleted) {
          return oldestUncompleted.targetDate;
        }
      }
      return proc.nextDate || '';
    };

    // Helper para comparar data da próxima realização (a mais recente/próxima primeiro)
    const compareNextDate = (procA: Procedure, procB: Procedure): number => {
      const dateA = getEffectiveNextDate(procA);
      const dateB = getEffectiveNextDate(procB);
      if (!dateA && !dateB) {
        return procA.name.localeCompare(procB.name, 'pt-BR', { sensitivity: 'base' });
      }
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      const comp = dateA.localeCompare(dateB);
      if (comp !== 0) {
        return comp;
      }

      // Se a data da próxima realização for a mesma, e ambos forem "em_processo" (ou marcados como tal)
      const isAInProcess = procA.status === 'em_processo' || procA.isEmProcesso;
      const isBInProcess = procB.status === 'em_processo' || procB.isEmProcesso;

      if (isAInProcess && isBInProcess) {
        // 1. Comparar data prevista original (nextDate) de forma cronológica (a mais antiga/próxima primeiro)
        const nextDateA = procA.nextDate || '';
        const nextDateB = procB.nextDate || '';
        
        if (nextDateA !== nextDateB) {
          if (!nextDateA) return 1;
          if (!nextDateB) return -1;
          return nextDateA.localeCompare(nextDateB);
        }

        // 2. Se nextDate for igual, comparar o agendamento da etapa ativa (oldestUncompleted)
        const getActiveStep = (proc: Procedure) => {
          if (proc.steps && proc.steps.length > 0) {
            return [...proc.steps]
              .filter(s => !s.completed)
              .sort((x, y) => x.targetDate.localeCompare(y.targetDate))[0];
          }
          return undefined;
        };

        const stepA = getActiveStep(procA);
        const stepB = getActiveStep(procB);

        const hasSchedA = !!stepA?.scheduled;
        const hasSchedB = !!stepB?.scheduled;

        if (hasSchedA !== hasSchedB) {
          return hasSchedA ? -1 : 1; // Procedimentos com agendamento vêm primeiro, sem agendamento por último
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
      }

      return procA.name.localeCompare(procB.name, 'pt-BR', { sensitivity: 'base' });
    };

    if (procedureSortBy === 'familiar') {
      const nameA = a.familiarName || '';
      const nameB = b.familiarName || '';
      if (!nameA && !nameB) {
        return compareNextDate(a, b);
      }
      if (!nameA) return 1;
      if (!nameB) return -1;
      const comp = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      if (comp !== 0) {
        return procedureSortOrder === 'asc' ? comp : -comp;
      }
      return compareNextDate(a, b);
    }

    if (procedureSortBy === 'procedimento') {
      const catA = a.category || '';
      const catB = b.category || '';
      if (!catA && !catB) {
        const comp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        if (comp !== 0) {
          return procedureSortOrder === 'asc' ? comp : -comp;
        }
        return compareNextDate(a, b);
      }
      if (!catA) return 1;
      if (!catB) return -1;
      const comp = catA.localeCompare(catB, 'pt-BR', { sensitivity: 'base' });
      if (comp !== 0) {
        return procedureSortOrder === 'asc' ? comp : -comp;
      }
      const compName = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      if (compName !== 0) {
        return procedureSortOrder === 'asc' ? compName : -compName;
      }
      return compareNextDate(a, b);
    }

    if (procedureSortBy === 'prestador') {
      const provA = a.providerName && a.providerName !== 'Não informado' ? a.providerName : '';
      const provB = b.providerName && b.providerName !== 'Não informado' ? b.providerName : '';
      if (!provA && !provB) {
        return compareNextDate(a, b);
      }
      if (!provA) return 1;
      if (!provB) return -1;
      const comp = provA.localeCompare(provB, 'pt-BR', { sensitivity: 'base' });
      if (comp !== 0) {
        return procedureSortOrder === 'asc' ? comp : -comp;
      }
      return compareNextDate(a, b);
    }

    if (procedureSortBy === 'proxima_realizacao') {
      const comp = compareNextDate(a, b);
      return procedureSortOrder === 'asc' ? comp : -comp;
    }

    // Default 'status' classification (padrão)
    const getStatusWeight = (proc: Procedure) => {
      if (proc.status === 'em_processo') return 1;
      
      const status = getProcedureStatus(proc.nextDate, proc.status, proceduresBufferDays);
      if (status.color === 'rose') return 2; // atrasados
      if (status.color === 'amber') return 3; // próximos
      if (status.color === 'emerald') return 4; // em dia
      if (proc.status === 'stand_by') return 5; // stand by
      
      return 6; // sem data / outros
    };

    const weightA = getStatusWeight(a);
    const weightB = getStatusWeight(b);

    if (weightA !== weightB) {
      const comp = weightA - weightB;
      return procedureSortOrder === 'asc' ? comp : -comp;
    }

    // Secondary sort: by nextDate (chronological/closest first)
    return compareNextDate(a, b);
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 overflow-hidden">
      {/* Header da Tela */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3 w-full md:w-[400px] shrink-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <Stethoscope className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans">Controle de Procedimentos</h1>
            <p className="text-xs text-slate-500 mt-1">Organize os procedimentos e cuide bem da sua saúde</p>
          </div>
        </div>
        
        <div className="flex-1 flex justify-start w-full lg:w-auto lg:ml-2">
          <PinnedItemsHeader pinnedItems={pinnedItems} onDropItem={onDropItem} onNavigateToTab={onNavigateToTab} activeTab="procedures" />
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou clínica..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
            />
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm shadow-blue-600/10 hover:shadow-blue-600/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Procedimento</span>
          </button>
        </div>
      </div>



      {/* 3. Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Clear Filters Button */}
          <button
            onClick={handleClearFiltersAndSort}
            disabled={!hasActiveFiltersOrSort}
            className={`h-9 w-9 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
              hasActiveFiltersOrSort
                ? 'text-blue-600 hover:text-blue-700 bg-[#edf5fd] border-blue-100 hover:border-blue-200 hover:shadow-xs cursor-pointer font-semibold shadow-xs'
                : 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40'
            }`}
            title={hasActiveFiltersOrSort ? "Limpar todos os filtros de busca e restaurar ordenação padrão" : "Nenhum filtro ativo"}
          >
            <FilterX className="w-4 h-4" />
          </button>

          {/* Familiar Select Filter */}
          <div className="relative shrink-0">
            <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <select
              value={familiarFilter}
              onChange={(e) => setFamiliarFilter(e.target.value)}
              className="pl-9 pr-8 pt-[9px] pb-[7px] bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer font-semibold text-slate-600 min-w-[160px] w-full sm:w-auto h-9"
            >
              <option value="all">Todos os Familiares</option>
              {[...familiars].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Tab Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl self-start">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'all'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'all' && <Stethoscope className="w-3.5 h-3.5" />}
                  <span>Todos</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/50 text-slate-500'}`}>{totalCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('scheduled')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'scheduled'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-emerald-600'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'scheduled' && <Calendar className="w-3.5 h-3.5" />}
                  <span>Agendados</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'scheduled' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/50 text-slate-500'}`}>{scheduledCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('em_processo')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'em_processo'
                    ? 'bg-blue-50 text-blue-700 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'em_processo' && <Activity className="w-3.5 h-3.5" />}
                  <span>Em Processo</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'em_processo' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/50 text-slate-500'}`}>{emProcessoCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('stand_by')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'stand_by'
                    ? 'bg-slate-200 text-slate-800 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'stand_by' && <Clock className="w-3.5 h-3.5" />}
                  <span>Stand By</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'stand_by' ? 'bg-slate-300 text-slate-800' : 'bg-slate-200/50 text-slate-500'}`}>{standByCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'overdue'
                    ? 'bg-rose-50 text-rose-700 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-rose-600'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'overdue' && <AlertCircle className="w-3.5 h-3.5" />}
                  <span>Atrasados</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200/50 text-slate-500'}`}>{overdueCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('upcoming')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'upcoming'
                    ? 'bg-amber-50 text-amber-700 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-amber-600'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'upcoming' && <Clock className="w-3.5 h-3.5" />}
                  <span>Próximos</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'upcoming' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200/50 text-slate-500'}`}>{upcomingCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('ok')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'ok'
                    ? 'bg-green-200 text-green-950 shadow-sm font-bold border border-green-300'
                    : 'text-slate-500 hover:text-green-800'
                }`}
              >
                <div className="flex items-center gap-1">
                  {statusFilter === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-green-800" />}
                  <span>Em Dia</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${statusFilter === 'ok' ? 'bg-green-900 text-white font-bold' : 'bg-slate-200/50 text-slate-500'}`}>{okCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6">
        <AnimatePresence mode="popLayout">
        {filteredProcedures.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center max-w-md mx-auto"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Nenhum procedimento encontrado</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {procedures.length === 0 
                ? 'Você ainda não cadastrou nenhum procedimento. Clique no botão acima para adicionar seu primeiro controle.' 
                : 'Nenhum resultado corresponde à sua busca ou filtro ativo.'}
            </p>
            {procedures.length === 0 && (
              <button
                onClick={handleOpenCreate}
                className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Primeiro</span>
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm"
          >
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">#</th>
                  <th 
                    onClick={() => handleSort('familiar')}
                    className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider cursor-pointer hover:text-blue-600 transition-colors select-none"
                    title="Classificar por Familiar (A-Z / Z-A)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Familiar</span>
                      <ArrowDown className={`w-3 h-3 transition-all ${procedureSortBy === 'familiar' ? 'text-blue-600 opacity-100 scale-110' : 'text-slate-300 opacity-40'} ${procedureSortBy === 'familiar' && procedureSortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('procedimento')}
                    className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider cursor-pointer hover:text-blue-600 transition-colors select-none"
                    title="Classificar por Categoria (A-Z / Z-A)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Procedimento</span>
                      <ArrowDown className={`w-3 h-3 transition-all ${procedureSortBy === 'procedimento' ? 'text-blue-600 opacity-100 scale-110' : 'text-slate-300 opacity-40'} ${procedureSortBy === 'procedimento' && procedureSortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('prestador')}
                    className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider cursor-pointer hover:text-blue-600 transition-colors select-none"
                    title="Classificar por Prestador (A-Z / Z-A)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Prestador</span>
                      <ArrowDown className={`w-3 h-3 transition-all ${procedureSortBy === 'prestador' ? 'text-blue-600 opacity-100 scale-110' : 'text-slate-300 opacity-40'} ${procedureSortBy === 'prestador' && procedureSortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('proxima_realizacao')}
                    className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider cursor-pointer hover:text-blue-600 transition-colors select-none"
                    title="Classificar por Próxima Realização (Mais recentes / Mais futuras primeiro)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Próxima Realização</span>
                      <ArrowDown className={`w-3 h-3 transition-all ${procedureSortBy === 'proxima_realizacao' ? 'text-blue-600 opacity-100 scale-110' : 'text-slate-300 opacity-40'} ${procedureSortBy === 'proxima_realizacao' && procedureSortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider cursor-pointer hover:text-blue-600 transition-colors select-none"
                    title="Classificar por Status (Prioridade / Invertido)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowDown className={`w-3 h-3 transition-all ${procedureSortBy === 'status' ? 'text-blue-600 opacity-100 scale-110' : 'text-slate-300 opacity-40'} ${procedureSortBy === 'status' && procedureSortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    </div>
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProcedures.map((proc, index) => {
                  const status = getProcedureStatus(proc.nextDate, proc.status, proceduresBufferDays);
                  const isConfirmingDelete = confirmDeleteId === proc.id;

                  return (
                    <tr 
                      key={proc.id} 
                      onDoubleClick={() => handleOpenEdit(proc)}
                      className={`transition-colors cursor-pointer select-none ${
                        proc.status === 'em_processo' 
                          ? 'bg-blue-50/65 hover:bg-blue-100/40' 
                          : 'hover:bg-slate-50/40'
                      }`}
                    >
                      {/* Numeração */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-slate-400">{index + 1}</td>

                      {/* Familiar */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {proc.familiarName ? (() => {
                          const matchedFam = familiars.find(f => f.id === proc.familiarId || (proc.familiarName && f.name.toLowerCase() === proc.familiarName.toLowerCase()));
                          const colClasses = getFamiliarColorClasses(matchedFam?.color);
                          return (
                            <span 
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider ${colClasses.bg} border ${colClasses.border}`}
                              style={colClasses.isCustom ? { 
                                backgroundColor: `${colClasses.customColor}15`, 
                                color: colClasses.customColor, 
                                borderColor: `${colClasses.customColor}30` 
                              } : {}}
                            >
                              <Users className="w-2.5 h-2.5" style={colClasses.isCustom ? { color: colClasses.customColor } : {}} /> {proc.familiarName}
                            </span>
                          );
                        })() : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Procedimento */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-xs font-bold text-slate-800 line-clamp-1" title={proc.specificity ? `${proc.name} (${proc.specificity})` : proc.name}>
                            {proc.name} {proc.specificity && <span className="text-blue-600 font-medium text-[10px]">({proc.specificity})</span>}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {proc.category && (
                              <span className="inline-flex items-center w-max px-1.5 py-0.5 rounded-md text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 uppercase font-mono tracking-wider">
                                {proc.category}
                              </span>
                            )}
                            <span className="inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-bold text-blue-600 font-mono uppercase tracking-wider bg-blue-50/70 border border-blue-100/50">
                              {proc.frequencyValue} {formatFrequencyUnit(proc.frequencyUnit, proc.frequencyValue)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Prestador */}
                      <td className="px-5 py-3.5 text-left">
                        {proc.providerName ? (() => {
                          const matchedProv = providers.find(p => p.id === proc.providerId || p.name.toLowerCase() === proc.providerName!.toLowerCase());
                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                {matchedProv?.whatsapp ? (
                                  <a
                                    href={`https://wa.me/${matchedProv.whatsapp.replace(/\D/g, '').length <= 11 ? '55' + matchedProv.whatsapp.replace(/\D/g, '') : matchedProv.whatsapp.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-0.5 hover:bg-emerald-50 rounded-full transition-colors text-emerald-500 hover:text-emerald-600 shrink-0"
                                    title={`Abrir conversa de WhatsApp com ${proc.providerName}`}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                  </a>
                                ) : (
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <button
                                  onClick={() => onViewProvider?.(proc.providerName!)}
                                  className="text-xs text-slate-600 font-medium hover:text-blue-600 hover:underline cursor-pointer transition-all duration-150 text-left focus:outline-none focus:ring-1 focus:ring-blue-100 rounded-sm max-w-[140px] truncate"
                                  title={`Consultar cadastro de ${proc.providerName}`}
                                >
                                  {proc.providerName}
                                </button>
                              </div>
                              {matchedProv && (
                                <span 
                                  className="text-[10px] font-bold text-blue-600 font-mono uppercase tracking-wider bg-blue-50/50 border border-blue-100/50 px-1.5 py-0.5 rounded-md inline-block truncate max-w-[150px] self-start"
                                  title={matchedProv.specialty || 'Geral / Outros'}
                                >
                                  {matchedProv.specialty || 'Geral / Outros'}
                                </span>
                              )}
                            </div>
                          );
                        })() : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Próxima Realização */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {proc.status === 'stand_by' ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs text-slate-500 font-bold bg-slate-50 border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>...</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs text-blue-700 font-bold bg-blue-50/50 border border-blue-100/20">
                            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            {(() => {
                              if (proc.status === 'em_processo') {
                                const oldestUncompleted = proc.steps && proc.steps.length > 0 
                                  ? [...proc.steps].filter(s => !s.completed).sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0]
                                  : null;
                                if (oldestUncompleted) {
                                  return (
                                    <span className="flex items-center gap-1.5">
                                      <span>{formatDateBr(oldestUncompleted.targetDate)}</span>
                                      <span className="text-[10px] font-normal text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md truncate max-w-[120px]" title={oldestUncompleted.title}>
                                        {oldestUncompleted.title}
                                      </span>
                                      {oldestUncompleted.scheduled && (
                                        <div 
                                          className="relative group flex items-center shrink-0"
                                          title={`Agendado: ${formatDateBr(oldestUncompleted.scheduledDate || oldestUncompleted.targetDate)}${oldestUncompleted.scheduledTime ? ` às ${oldestUncompleted.scheduledTime}` : ''}`}
                                        >
                                          <div className="text-emerald-600 bg-emerald-50 border border-emerald-200 p-1 rounded-md cursor-help hover:bg-emerald-100 transition-all">
                                            <Calendar className="w-3 h-3 text-emerald-600" />
                                          </div>
                                          {/* Custom tooltip */}
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-slate-950 text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-center">
                                            <div className="font-semibold">Agendamento Ativo</div>
                                            <div className="text-[9px] text-slate-300 mt-0.5 font-normal">
                                              {formatDateBr(oldestUncompleted.scheduledDate || oldestUncompleted.targetDate)}
                                              {oldestUncompleted.scheduledTime ? ` às ${oldestUncompleted.scheduledTime}` : ''}
                                            </div>
                                            {/* Tooltip arrow */}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950"></div>
                                          </div>
                                        </div>
                                      )}
                                      {proc.nextDateInstructions && (
                                        <div className="relative group flex items-center shrink-0">
                                          <div className="text-blue-600 bg-blue-50 border border-blue-200 p-0.5 rounded-md cursor-help hover:bg-blue-100 transition-all">
                                            <Info className="w-3 h-3" />
                                          </div>
                                          {/* Custom tooltip */}
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-left whitespace-normal">
                                            <div className="font-semibold text-[10px] border-b border-slate-800 pb-1 mb-1">Instruções:</div>
                                            <div className="text-[9px] text-slate-300 font-normal leading-relaxed break-words">
                                              {proc.nextDateInstructions}
                                            </div>
                                            {/* Tooltip arrow */}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950"></div>
                                          </div>
                                        </div>
                                      )}
                                    </span>
                                  );
                                }
                                return <span>...</span>;
                              }
                              return (
                                <span className="flex items-center gap-1.5">
                                  <span>{formatDateBr(proc.nextDate)}</span>
                                  {proc.nextDateInstructions && (
                                    <div className="relative group flex items-center shrink-0">
                                      <div className="text-blue-600 bg-blue-50 border border-blue-200 p-0.5 rounded-md cursor-help hover:bg-blue-100 transition-all">
                                        <Info className="w-3 h-3" />
                                      </div>
                                      {/* Custom tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-left whitespace-normal">
                                        <div className="font-semibold text-[10px] border-b border-slate-800 pb-1 mb-1">Instruções:</div>
                                        <div className="text-[9px] text-slate-300 font-normal leading-relaxed break-words">
                                          {proc.nextDateInstructions}
                                        </div>
                                        {/* Tooltip arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950"></div>
                                      </div>
                                    </div>
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${status.badgeStyle}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end">
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-rose-600">Confirma?</span>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleDelete(proc.id)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                                >
                                  Não
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleOpenEdit(proc)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Editar procedimento"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(proc.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Excluir procedimento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* 5. Create / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl shadow-xl border border-slate-100 max-w-4xl w-full overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Activity className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingProcedure ? 'Editar Procedimento' : 'Novo Procedimento'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Preencha os campos para programar seu controle de frequência</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${getProcedureStatus(nextDate, isStandBy ? 'stand_by' : (isEmProcesso ? 'em_processo' : undefined), proceduresBufferDays).badgeStyle}`}>
                    {getProcedureStatus(nextDate, isStandBy ? 'stand_by' : (isEmProcesso ? 'em_processo' : undefined), proceduresBufferDays).label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="flex flex-col max-h-[85vh]">
                <div className="p-6 text-left overflow-y-auto max-h-[65vh] pr-2 grid grid-cols-1 md:grid-cols-12 gap-6 items-start transition-all">
                  {/* Coluna Esquerda: Dados do Procedimento */}
                  <div className={`md:col-span-7 space-y-4 transition-all ${isRegisteringMode || isAnySectionActive ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Error Message */}
                    {formError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Familiar / Beneficiário Input */}
                    {showQuickFamiliarForm ? (
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-blue-600 uppercase font-mono">Cadastrar Familiar / Beneficiário</span>
                          <button 
                            type="button" 
                            onClick={() => setShowQuickFamiliarForm(false)}
                            className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Nome Completo"
                            value={quickFamiliarName}
                            onChange={(e) => setQuickFamiliarName(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Telefone (opcional)"
                            value={quickFamiliarPhone}
                            onChange={(e) => setQuickFamiliarPhone(e.target.value)}
                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={handleSaveQuickFamiliar}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                          >
                            Salvar e Selecionar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider flex items-center justify-between">
                          <span>Familiar <span className="text-rose-500 font-bold">*</span></span>
                          <button
                            type="button"
                            onClick={() => setShowQuickFamiliarForm(true)}
                            className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Novo
                          </button>
                        </label>
                        {familiars.length === 0 ? (
                          <div className="p-3.5 bg-amber-50/70 border border-amber-150 rounded-xl text-xs text-amber-800 font-medium space-y-1.5">
                            <div>⚠️ Nenhum familiar cadastrado ainda.</div>
                            <button
                              type="button"
                              onClick={() => setShowQuickFamiliarForm(true)}
                              className="text-xs text-blue-600 hover:underline font-bold block text-left"
                            >
                              Clique aqui para criar o primeiro familiar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <select
                              value={selectedFamiliarId}
                              onChange={(e) => {
                                const id = e.target.value;
                                setSelectedFamiliarId(id);
                                const foundFam = familiars.find(f => f.id === id);
                                setFamiliarName(foundFam ? foundFam.name : '');
                                if (id) setFormError('');
                              }}
                              className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500"
                            >
                              <option value="">Selecione o familiar...</option>
                              {[...familiars].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                            {selectedFamiliarId && (() => {
                              const selectedFam = familiars.find(f => f.id === selectedFamiliarId);
                              const colClasses = getFamiliarColorClasses(selectedFam?.color);
                              return (
                                <div 
                                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${colClasses.bg} ${colClasses.border}`} 
                                  style={colClasses.isCustom ? { 
                                    backgroundColor: `${colClasses.customColor}15`, 
                                    borderColor: `${colClasses.customColor}30` 
                                  } : {}}
                                  title={`Cor identificadora: ${selectedFam?.color || 'padrão'}`}
                                >
                                  <span 
                                    className={`w-3 h-3 rounded-full ${colClasses.dot}`} 
                                    style={colClasses.isCustom ? { backgroundColor: colClasses.customColor } : {}}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Categoria & Nome do Procedimento na mesma linha */}
                    <div className={`grid grid-cols-1 ${procedureTypes.find(t => t.name === name)?.isGeneric ? 'md:grid-cols-[1fr_2fr]' : 'md:grid-cols-2'} gap-4`}>
                      {/* Categoria Input */}
                      {showQuickCategoryForm ? (
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-blue-600 uppercase font-mono">Cadastrar Categoria</span>
                            <button 
                              type="button" 
                              onClick={() => setShowQuickCategoryForm(false)}
                              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                            >
                              Cancelar
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Nome da Categoria (ex: Odontologia, Exames...)"
                              value={quickCategoryName}
                              onChange={(e) => setQuickCategoryName(e.target.value)}
                              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={handleSaveQuickCategory}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                            >
                              Salvar e Selecionar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5" id="category_form_group">
                          <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider flex items-center justify-between">
                            <span>Categoria <span className="text-rose-500 font-bold">*</span></span>
                            <button
                              type="button"
                              onClick={() => setShowQuickCategoryForm(true)}
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Novo
                            </button>
                          </label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500"
                            required
                          >
                            <option value="">Selecione uma categoria...</option>
                            {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Procedure Name Input */}
                      {showQuickTypeForm ? (
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-blue-600 uppercase font-mono">Cadastrar Tipo de Procedimento</span>
                            <button 
                              type="button" 
                              onClick={() => setShowQuickTypeForm(false)}
                              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                            >
                              Cancelar
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Nome (ex: Mamografia, Hemograma...)"
                              value={quickTypeName}
                              onChange={(e) => setQuickTypeName(e.target.value)}
                              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                                <span className="text-[10px] text-slate-400 font-medium">Cada</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={quickTypeFreqValue}
                                  onChange={(e) => setQuickTypeFreqValue(Math.max(1, Number(e.target.value)))}
                                  className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 p-0 text-center"
                                />
                              </div>
                              <select
                                value={quickTypeFreqUnit}
                                onChange={(e) => setQuickTypeFreqUnit(e.target.value as any)}
                                className="px-2 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white outline-none"
                              >
                                <option value="days">Dia(s)</option>
                                <option value="weeks">Semana(s)</option>
                                <option value="months">Mês(es)</option>
                                <option value="years">Ano(s)</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={handleSaveQuickType}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                            >
                              Salvar e Selecionar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider flex items-center justify-between">
                            <span>Procedimento <span className="text-rose-500 font-bold">*</span></span>
                            <button
                              type="button"
                              onClick={() => setShowQuickTypeForm(true)}
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Novo
                            </button>
                          </label>
                          
                          <div className="flex gap-2">
                            <select
                              value={name}
                              onChange={(e) => {
                                handleSelectProcedureType(e.target.value);
                              }}
                              className={`flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500 ${procedureTypes.find(t => t.name === name)?.isGeneric ? 'md:w-1/2' : 'w-full'}`}
                            >
                              <option value="">Selecione um procedimento...</option>
                              {[...procedureTypes].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                                <option key={t.id} value={t.name}>{t.name}{t.isGeneric ? ' (...)' : ''}</option>
                              ))}
                              {name && !procedureTypes.some(t => t.name === name) && (
                                <option value={name}>{name}</option>
                              )}
                            </select>

                            {procedureTypes.find(t => t.name === name)?.isGeneric && (
                              <input
                                type="text"
                                placeholder="Especificidade (10 carac.)"
                                value={specificity}
                                onChange={(e) => setSpecificity(e.target.value.substring(0, 10))}
                                className="w-1/3 md:w-[120px] px-3 py-2 border border-blue-200 rounded-xl text-xs bg-blue-50/30 outline-none focus:border-blue-500 font-medium"
                                maxLength={10}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                {/* Professional or Clinic Input */}
                {showQuickProviderForm ? (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-blue-600 uppercase font-mono">Cadastrar Profissional / Clínica</span>
                      <button 
                        type="button" 
                        onClick={() => setShowQuickProviderForm(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Nome do Profissional ou Clínica"
                        value={quickProvName}
                        onChange={(e) => setQuickProvName(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Especialidade (ex: Cardiologia, Lab...) - opcional"
                        value={quickProvSpecialty}
                        onChange={(e) => setQuickProvSpecialty(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="WhatsApp (ex: (11) 99999-9999) - opcional"
                        value={quickProvWhatsApp}
                        onChange={(e) => setQuickProvWhatsApp(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveQuickProvider}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        Salvar e Selecionar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider flex items-center justify-between">
                      <span>Profissional / Clínica</span>
                      <button
                        type="button"
                        onClick={() => setShowQuickProviderForm(true)}
                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Novo
                      </button>
                    </label>
                    
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedProviderId}
                        onChange={(e) => {
                          handleSelectProvider(e.target.value);
                        }}
                        className="flex-1 min-w-0 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500"
                      >
                        <option value="">Selecione um profissional/clínica...</option>
                        {[...providers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} {p.specialty ? `(${p.specialty})` : ''}</option>
                        ))}
                        {providerName && !providers.some(p => p.id === selectedProviderId) && (
                          <option value={selectedProviderId || "legacy"}>{providerName}</option>
                        )}
                      </select>
                      {(() => {
                        const matchedProv = providers.find(p => p.id === selectedProviderId || (providerName && p.name.toLowerCase() === providerName.toLowerCase()));
                        if (matchedProv?.whatsapp) {
                          const cleanWa = matchedProv.whatsapp.replace(/\D/g, '');
                          const waUrl = `https://wa.me/${cleanWa.length <= 11 ? '55' + cleanWa : cleanWa}`;
                          return (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-xl transition-all flex items-center justify-center shrink-0"
                              title={`Abrir WhatsApp com ${matchedProv.name}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

                {/* Frequency & Last Execution Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Frequency Inputs */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Frequência Recomendada</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-blue-500">
                        <span className="text-xs text-slate-400 font-medium">Cada</span>
                        <input
                          type="number"
                          min="1"
                          value={frequencyValue}
                          onChange={(e) => setFrequencyValue(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 p-0 text-center"
                        />
                      </div>
                      
                      <select
                        value={frequencyUnit}
                        onChange={(e) => setFrequencyUnit(e.target.value as any)}
                        className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500"
                      >
                        <option value="days">Dia(s)</option>
                        <option value="weeks">Semana(s)</option>
                        <option value="months">Mês(es)</option>
                        <option value="years">Ano(s)</option>
                      </select>
                    </div>
                  </div>

                  {/* Last Execution Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Última Realização</label>
                    <input
                      type="date"
                      value={lastDate}
                      onChange={(e) => setLastDate(e.target.value)}
                      disabled={!isEmProcesso || tempHistory.length > 0}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-[#314158] outline-none focus:border-blue-500 bg-white disabled:bg-white disabled:text-[#314158] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Next Execution Date combined container */}
                <div className="space-y-3.5 bg-blue-50/30 border border-blue-100/50 p-4 rounded-2xl">
                  {/* Next Execution Date Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-4">
                      <label className="text-[10px] font-bold text-blue-700 uppercase font-mono tracking-wider">Próxima Realização</label>
                    </div>

                    <div className="flex items-center gap-2 h-11">
                      <input
                        type="date"
                        disabled={isStandBy || isEmProcesso || (!manualNextDate && !!lastDate)}
                        value={isStandBy ? '' : nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className="flex-1 h-full px-3.5 border border-slate-200 rounded-xl text-xs font-bold text-[#314158] text-center outline-none focus:border-blue-500 bg-white disabled:bg-white disabled:text-[#314158] disabled:cursor-not-allowed"
                      />
                      <input
                        type="checkbox"
                        id="override_next_date"
                        checked={manualNextDate}
                        onChange={(e) => setManualNextDate(e.target.checked)}
                        disabled={!editingProcedure && !isEmProcesso}
                        className="sr-only"
                      />
                      <label 
                        htmlFor="override_next_date" 
                        className={`h-full w-11 shrink-0 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                          manualNextDate 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                            : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
                        } ${((!editingProcedure && !isEmProcesso) || isStandBy || isEmProcesso) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                        title="Definir data manualmente"
                      >
                        <Keyboard className="w-4 h-4" />
                      </label>
                    </div>
                  </div>

                  {/* Instruções para a próxima Realização */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#1447e6] uppercase font-mono tracking-wider">Instruções para a próxima Realização</label>
                    <textarea
                      value={nextDateInstructions}
                      onChange={(e) => setNextDateInstructions(e.target.value)}
                      placeholder=""
                      rows={2}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-white placeholder-slate-400 resize-none"
                    />
                  </div>
                </div>

                </div>

                {/* Coluna Direita: Histórico de Realizações */}
                <div className="md:col-span-5 space-y-4 flex flex-col">
                  {/* Seção Etapas do Procedimento */}
                  <div className={`bg-slate-50/50 border transition-all duration-300 rounded-2xl p-4 flex flex-col space-y-3 ${activeSection === 'step' ? 'border-blue-500 shadow-md' : (isRegisteringMode ? 'border-emerald-500 shadow-lg shadow-emerald-100 ring-4 ring-emerald-500/10' : 'border-slate-200/60')} ${isAnySectionActive && activeSection !== 'step' ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="space-y-3 transition-all">
                        <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-400" />
                          <span>Etapas do Procedimento ({tempSteps.length})</span>
                        </label>
                        {!isAddingStep && (
                          <button
                            type="button"
                            disabled={isAnySectionActive && activeSection !== 'step'}
                            onClick={() => {
                              setActiveSection('step');
                              setEditingStepId(null);
                              setIsAddingStep(true);
                              setStepTitle('');
                              setStepTargetDate(new Date().toISOString().split('T')[0]);
                            }}
                            className={`text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer ${isAnySectionActive && activeSection !== 'step' ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <Plus className="w-3 h-3" /> Adicionar Etapa
                          </button>
                        )}
                      </div>

                      {/* Form para adicionar/editar nova etapa */}
                      {isAddingStep && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 text-left shadow-xs">
                          <span className="text-[10px] font-bold text-slate-600 block">
                            {editingStepId ? 'Editar Etapa' : 'Nova Etapa'}
                          </span>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Nome da Etapa *</label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Consulta, Exame, Re-consulta..."
                              value={stepTitle}
                              onChange={(e) => setStepTitle(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-slate-50/30 font-medium"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Data a realizar *</label>
                            <input
                              type="date"
                              required
                              value={stepTargetDate}
                              onChange={(e) => setStepTargetDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-slate-50/30"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSection('none');
                                setIsAddingStep(false);
                                setEditingStepId(null);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Cancelar
                            </button>
                            {!editingStepId && (
                              <button
                                type="button"
                                onClick={handleOpenSchedulingForNewStep}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                                title="Criar etapa e agendar na agenda integrada"
                              >
                                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Agendar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleSaveTempStep}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              {editingStepId ? 'Salvar Alterações' : 'Adicionar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de etapas */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {tempSteps.length > 0 && (
                        [...tempSteps]
                          .sort((a, b) => {
                            if (a.completed !== b.completed) {
                              return a.completed ? 1 : -1;
                            }
                            if (!a.completed) {
                              return a.targetDate.localeCompare(b.targetDate);
                            } else {
                              return b.targetDate.localeCompare(a.targetDate);
                            }
                          })
                          .map((step) => (
                            <div 
                              key={step.id} 
                              className={`bg-white border rounded-2xl p-3 flex items-center justify-between gap-2.5 shadow-2xs transition-all ${
                                step.completed ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-150'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                {/* Botão de quadradinho liga/desliga para realizada */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleTempStep(step.id)}
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                    step.completed 
                                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs' 
                                      : 'border-slate-300 hover:border-slate-400 bg-white'
                                  }`}
                                >
                                  {step.completed && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>

                                <div className="text-left space-y-0.5 flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block truncate ${
                                    step.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                                  }`}>
                                    {step.title}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-medium font-mono flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" /> Prazo: {formatDateBr(step.targetDate)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {step.scheduled ? (
                                  <button
                                    type="button"
                                    onClick={() => initiateScheduling(step)}
                                    className="text-emerald-600 bg-emerald-50 border border-emerald-150 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors cursor-pointer self-center"
                                    title={`Agendado para: ${formatDateBr(step.scheduledDate || step.targetDate)}${step.scheduledTime ? ` às ${step.scheduledTime}` : ''}`}
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => initiateScheduling(step)}
                                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer self-center"
                                    title="Agendar esta etapa na agenda integrada"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStepId(step.id);
                                    setStepTitle(step.title);
                                    setStepTargetDate(step.targetDate);
                                    setIsAddingStep(true);
                                  }}
                                  className="text-slate-300 hover:text-blue-600 p-1 rounded-lg transition-colors cursor-pointer self-center"
                                  title="Editar etapa"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteTempStep(step.id)}
                                  className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer self-center"
                                  title="Excluir etapa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      </div>
                      {/* Botão de registrar no histórico quando todas as etapas estiverem completadas */}
                      {tempSteps.length > 0 && tempSteps.every(s => s.completed) && !isCancelled && (
                        <div className="pt-2 space-y-3">
                          <div className="space-y-1 text-left">
                            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                              Instruções Próxima Realização
                            </label>
                            <textarea
                              value={stepsNextInstructions}
                              onChange={(e) => setStepsNextInstructions(e.target.value)}
                              placeholder="Instruções para a próxima realização do procedimento..."
                              rows={2}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 bg-white placeholder-slate-400 resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCancelRegisterSteps}
                              className="p-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                              title="Cancelar registro no histórico"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleRegisterStepsToHistory}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                            >
                              <History className="w-4 h-4" /> Registrar no Histórico
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  {/* Seção Histórico */}
                  <div className={`bg-slate-50/50 border transition-all duration-300 rounded-2xl p-4 flex flex-col space-y-3 ${activeSection === 'history' ? 'border-blue-500 shadow-md' : 'border-slate-200/60'} ${isRegisteringMode && activeSection !== 'history' ? 'opacity-50 pointer-events-none' : ''} ${isAnySectionActive && activeSection !== 'history' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>Histórico ({tempHistory.length})</span>
                    </label>
                    {!isAddingHistory && (
                      <button
                        type="button"
                        disabled={isAnySectionActive && activeSection !== 'history'}
                        onClick={() => {
                          setActiveSection('history');
                          setEditingHistoryId(null);
                          setIsAddingHistory(true);
                          setHistoryDate(new Date().toISOString().split('T')[0]);
                          setHistoryProvider('');
                          setHistoryNotes('');
                        }}
                        className={`text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer ${isAnySectionActive && activeSection !== 'history' ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <Plus className="w-3 h-3" /> Registrar Realização
                      </button>
                    )}
                  </div>

                  {/* Add/edit history entry form inside modal */}
                  {isAddingHistory && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 text-left shadow-xs">
                      <span className="text-[10px] font-bold text-slate-600 block">
                        {editingHistoryId ? 'Editar Registro do Histórico' : 'Novo Registro do Histórico'}
                      </span>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Data *</label>
                          <input
                            type="date"
                            required
                            value={historyDate}
                            onChange={(e) => setHistoryDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-slate-50/30"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Nome da Etapa</label>
                          <input
                            type="text"
                            placeholder="Ex: Consulta, Exame, Re-consulta..."
                            value={historyProvider}
                            onChange={(e) => setHistoryProvider(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-slate-50/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Observações / Resultados</label>
                        <textarea
                          placeholder="Ex: Resultados normais, retorno em 6 meses."
                          rows={2}
                          value={historyNotes}
                          onChange={(e) => setHistoryNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 resize-none bg-slate-50/30"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection('none');
                            setIsAddingHistory(false);
                            setEditingHistoryId(null);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveTempHistoryEntry}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          {editingHistoryId ? 'Salvar Alterações' : 'Salvar Registro'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Temp History list */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {tempHistory.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-8 bg-white border border-slate-100 rounded-2xl shadow-2xs">
                        Nenhuma realização anterior registrada.
                      </p>
                    ) : (
                      tempHistory.map((entry) => (
                        <div 
                          key={entry.id} 
                          className="bg-white border border-slate-150 rounded-2xl p-3 flex items-start justify-between gap-2.5 shadow-2xs"
                        >
                          <div className="text-left space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-700">
                                {formatDateBr(entry.date)}
                              </span>
                              {entry.providerName && (
                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[120px]" title={entry.providerName}>
                                  • {entry.providerName}
                                </span>
                              )}
                            </div>
                            {entry.notes && (
                              <p className="text-[10px] text-slate-500 leading-normal break-words whitespace-pre-line">{entry.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 self-start">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHistoryId(entry.id);
                                setHistoryDate(entry.date);
                                setHistoryProvider(entry.providerName || '');
                                setHistoryNotes(entry.notes || '');
                                setIsAddingHistory(true);
                              }}
                              className="text-slate-300 hover:text-blue-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Editar registro"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTempHistoryEntry(entry.id)}
                              className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remover do histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

                {/* Modal Actions */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                  {/* Left side: Em processo & Stand By Toggles */}
                  <div className={`flex items-center space-x-5 transition-all ${isRegisteringMode ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !isEmProcesso;
                          setIsEmProcesso(nextVal);
                          if (nextVal) setIsStandBy(false);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEmProcesso ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isEmProcesso ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span 
                        onClick={() => {
                          const nextVal = !isEmProcesso;
                          setIsEmProcesso(nextVal);
                          if (nextVal) setIsStandBy(false);
                        }}
                        className="text-xs font-bold text-slate-600 cursor-pointer select-none"
                      >
                        Em processo
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !isStandBy;
                          setIsStandBy(nextVal);
                          if (nextVal) setIsEmProcesso(false);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isStandBy ? 'bg-slate-500' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isStandBy ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span 
                        onClick={() => {
                          const nextVal = !isStandBy;
                          setIsStandBy(nextVal);
                          if (nextVal) setIsEmProcesso(false);
                        }}
                        className="text-xs font-bold text-slate-600 cursor-pointer select-none"
                      >
                        Stand By
                      </span>
                    </div>
                  </div>

                  {/* Right side: Cancelar & Salvar Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      disabled={isRegisteringMode}
                      className={`px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer ${isRegisteringMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isRegisteringMode || isAnySectionActive}
                      className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${(isRegisteringMode || isAnySectionActive) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                      Salvar Procedimento
                    </button>
                  </div>
                </div>
              </form>

              {/* INTRA-JANELA: Agendamento de Etapa do Procedimento */}
              <AnimatePresence>
                {schedulingStepId !== null && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-55 flex items-center justify-center p-4 rounded-3xl"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden max-h-[95%]"
                    >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                      <div className="flex items-center space-x-2.5 text-left">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                          <Calendar className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            Agendar Etapa na Agenda Integrada
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">Configure e sincronize o compromisso com o Google Agenda</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchedulingStepId(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content Form */}
                    <div className="p-6 text-left overflow-y-auto flex-1 space-y-4">
                      {schedSuccessMsg ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-12">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <h5 className="text-sm font-bold text-slate-800">{schedSuccessMsg}</h5>
                          <p className="text-xs text-slate-400">Sua etapa foi agendada e sincronizada com a agenda integrada do app!</p>
                        </div>
                      ) : (
                        <>
                          {/* Compromisso / Titulo */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                              Título do Compromisso *
                            </label>
                            <input
                              type="text"
                              required
                              value={schedTitle}
                              onChange={(e) => setSchedTitle(e.target.value)}
                              placeholder="Ex: Consulta Cardiologista"
                              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50/50"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Tipo de Compromisso */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                                Tipo de Compromisso
                              </label>
                              <select
                                value={schedType}
                                onChange={(e) => setSchedType(e.target.value as any)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500"
                              >
                                <option value="consulta">Consulta</option>
                                <option value="exame">Exame</option>
                                <option value="retorno">Retorno</option>
                                <option value="outros">Outros / Procedimento</option>
                              </select>
                            </div>

                            {/* Data */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                                Data *
                              </label>
                              <input
                                type="date"
                                required
                                value={schedDate}
                                onChange={(e) => setSchedDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50/50"
                              />
                            </div>
                          </div>

                          {/* All Day Event Checkbox */}
                          <div className="flex items-center space-x-2.5 py-2.5 px-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                            <input
                              type="checkbox"
                              id="schedAllDay"
                              checked={schedAllDay}
                              onChange={(e) => setSchedAllDay(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="schedAllDay" className="text-xs font-bold text-slate-700 select-none cursor-pointer flex items-center gap-1.5">
                              Compromisso de dia inteiro (sem horário específico)
                            </label>
                          </div>

                          <AnimatePresence initial={false}>
                            {!schedAllDay && (
                              <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Hora Inicio */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                                      Hora de Início *
                                    </label>
                                    <input
                                      type="time"
                                      required={!schedAllDay}
                                      value={schedStartTime}
                                      onChange={(e) => handleSchedStartTimeChange(e.target.value)}
                                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50/50"
                                    />
                                  </div>

                                  {/* Hora Fim */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                                      Hora de Fim *
                                    </label>
                                    <input
                                      type="time"
                                      required={!schedAllDay}
                                      value={schedEndTime}
                                      onChange={(e) => setSchedEndTime(e.target.value)}
                                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50/50"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Medico / Profissional */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                                Médico / Profissional
                              </label>
                              <input
                                type="text"
                                value={schedDoctorName}
                                onChange={(e) => setSchedDoctorName(e.target.value)}
                                placeholder="Ex: Dra. Ana Paula"
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50/50"
                              />
                            </div>

                            {/* Local / Clinica */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                                Clínica / Local
                              </label>
                              <input
                                type="text"
                                value={schedClinicName}
                                onChange={(e) => setSchedClinicName(e.target.value)}
                                placeholder="Ex: Hospital Einstein"
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-slate-50/50"
                              />
                            </div>
                          </div>

                          {/* Observacoes */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                              Observações / Detalhes
                            </label>
                            <textarea
                              rows={3}
                              value={schedNotes}
                              onChange={(e) => setSchedNotes(e.target.value)}
                              placeholder="Adicione notas adicionais para este compromisso..."
                              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 resize-none bg-slate-50/50"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Footer Actions */}
                    {!schedSuccessMsg && (
                      <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                        <div>
                          {isCurrentlyScheduled && (
                            <button
                              type="button"
                              onClick={handleDeleteScheduling}
                              disabled={isSchedSubmitting}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Excluir Agendamento
                            </button>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setSchedulingStepId(null)}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmScheduling}
                            disabled={isSchedSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {isSchedSubmitting ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {isCurrentlyScheduled ? 'Salvando...' : 'Agendando...'}
                              </>
                            ) : (
                              <>
                                <Calendar className="w-3.5 h-3.5" /> {isCurrentlyScheduled ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
