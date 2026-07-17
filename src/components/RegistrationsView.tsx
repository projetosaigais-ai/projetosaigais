import React, { useState } from 'react';
import { HealthProvider, ProcedureType, Familiar, ProcedureCategory, Procedure, Tratamento, Medicamento } from '../types';
import { 
  Plus, 
  Search, 
  Building2, 
  User, 
  Users,
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Trash2, 
  X, 
  Activity, 
  Heart, 
  FileText, 
  ChevronRight, 
  Clock,
  Briefcase,
  ClipboardList,
  MessageCircle,
  Calendar as CalendarIcon,
  Tag,
  Pill,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PinnedItemsHeader } from './PinnedItemsHeader';

export const getFamiliarColorClasses = (color?: string) => {
  if (color && color.startsWith('#')) {
    return {
      bg: '',
      text: '',
      border: 'border-slate-100',
      dot: '',
      badge: '',
      isCustom: true,
      customColor: color
    };
  }
  switch (color) {
    case 'blue':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-100',
        dot: 'bg-blue-500',
        badge: 'bg-blue-50 text-blue-700 border-blue-100/80',
      };
    case 'emerald':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        border: 'border-emerald-100',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100/80',
      };
    case 'violet':
      return {
        bg: 'bg-violet-50',
        text: 'text-violet-600',
        border: 'border-violet-100',
        dot: 'bg-violet-500',
        badge: 'bg-violet-50 text-violet-700 border-violet-100/80',
      };
    case 'amber':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        border: 'border-amber-100',
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 border-amber-100/80',
      };
    case 'sky':
      return {
        bg: 'bg-sky-50',
        text: 'text-sky-600',
        border: 'border-sky-100',
        dot: 'bg-sky-500',
        badge: 'bg-sky-50 text-sky-700 border-sky-100/80',
      };
    case 'orange':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        border: 'border-orange-100',
        dot: 'bg-orange-500',
        badge: 'bg-orange-50 text-orange-700 border-orange-100/80',
      };
    case 'fuchsia':
      return {
        bg: 'bg-fuchsia-50',
        text: 'text-fuchsia-600',
        border: 'border-fuchsia-100',
        dot: 'bg-fuchsia-500',
        badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100/80',
      };
    case 'teal':
      return {
        bg: 'bg-teal-50',
        text: 'text-teal-600',
        border: 'border-teal-100',
        dot: 'bg-teal-500',
        badge: 'bg-teal-50 text-teal-700 border-teal-100/80',
      };
    case 'rose':
    default:
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        border: 'border-rose-100',
        dot: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-700 border-rose-100/80',
      };
  }
};

interface RegistrationsViewProps {
  procedures?: Procedure[];
  providers: HealthProvider[];
  onSaveProviders: (updated: HealthProvider[]) => void;
  procedureTypes: ProcedureType[];
  onSaveProcedureTypes: (updated: ProcedureType[]) => void;
  familiars: Familiar[];
  onSaveFamiliars: (updated: Familiar[]) => void;
  categories: ProcedureCategory[];
  onSaveCategories: (updated: ProcedureCategory[]) => void;
  activeSubTab: 'providers' | 'procedure_types' | 'familiars' | 'categories';
  setActiveSubTab: (tab: 'providers' | 'procedure_types' | 'familiars' | 'categories') => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  tratamentos?: Tratamento[];
  medicamentos?: Medicamento[];
  onNavigateToTab?: (tab: 'dashboard' | 'calendar' | 'procedures' | 'registrations' | 'medicamentos' | 'configuracoes' | 'controle' | 'pontual', query?: string, familiarId?: string) => void;
  pinnedItems: string[];
  onDropItem: (item: string) => void;
}

export default function RegistrationsView({ 
  procedures = [],
  providers, 
  onSaveProviders, 
  procedureTypes, 
  onSaveProcedureTypes,
  familiars = [],
  onSaveFamiliars,
  categories = [],
  onSaveCategories,
  activeSubTab,
  setActiveSubTab,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  tratamentos = [],
  medicamentos = [],
  onNavigateToTab,
  pinnedItems,
  onDropItem
}: RegistrationsViewProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setLocalSearchQuery(val);
    }
  };

  // Helper functions to check if a record is linked to any procedures
  const isProviderInUse = (providerId: string, providerName: string) => {
    return procedures.some(proc => 
      proc.providerId === providerId || 
      proc.providerName === providerName
    );
  };

  const isTypeInUse = (typeName: string) => {
    return procedures.some(proc => 
      proc.name === typeName
    );
  };

  const isFamiliarInUse = (familiarId: string, familiarName: string) => {
    return procedures.some(proc => 
      proc.familiarId === familiarId || 
      proc.familiarName === familiarName
    );
  };

  const isCategoryInUse = (categoryName: string) => {
    return procedures.some(proc => 
      proc.category === categoryName
    );
  };

  const getProviderProceduresCount = (providerId: string, providerName: string) => {
    return procedures.filter(proc => 
      proc.providerId === providerId || 
      (proc.providerName && proc.providerName.toLowerCase() === providerName.toLowerCase())
    ).length;
  };

  const getTypeProceduresCount = (typeName: string) => {
    return procedures.filter(proc => 
      proc.name.toLowerCase() === typeName.toLowerCase()
    ).length;
  };

  const getFamiliarProceduresCount = (familiarId: string, familiarName: string) => {
    return procedures.filter(proc => 
      proc.familiarId === familiarId || 
      (proc.familiarName && proc.familiarName.toLowerCase() === familiarName.toLowerCase())
    ).length;
  };

  const getCategoryProceduresCount = (categoryName: string) => {
    return procedures.filter(proc => 
      proc.category && proc.category.toLowerCase() === categoryName.toLowerCase()
    ).length;
  };

  const getFamiliarMedicamentosCount = (familiarId: string) => {
    // Count medicines in stock linked to this familiar
    const medsCount = medicamentos.filter(m => m.pessoaId === familiarId).length;
    // Count unique medicines in active treatments for this familiar
    const treatmentMedsCount = tratamentos
      .filter(t => t.familiarId === familiarId && !t.arquivado)
      .reduce((acc, curr) => acc + curr.medicamentos.length, 0);
    
    return medsCount + treatmentMedsCount;
  };

  // Modals & Editing States
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<HealthProvider | null>(null);
  const [confirmDeleteProviderId, setConfirmDeleteProviderId] = useState<string | null>(null);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<ProcedureType | null>(null);
  const [confirmDeleteTypeId, setConfirmDeleteTypeId] = useState<string | null>(null);

  const [showFamiliarModal, setShowFamiliarModal] = useState(false);
  const [editingFamiliar, setEditingFamiliar] = useState<Familiar | null>(null);
  const [confirmDeleteFamiliarId, setConfirmDeleteFamiliarId] = useState<string | null>(null);

  // Provider Form State
  const [provName, setProvName] = useState('');
  const [provSpecialty, setProvSpecialty] = useState('');
  const [provPhone, setProvPhone] = useState('');
  const [provWhatsApp, setProvWhatsApp] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provAddress, setProvAddress] = useState('');

  // Procedure Type Form State
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [typeFreqValue, setTypeFreqValue] = useState<number>(6);
  const [typeFreqUnit, setTypeFreqUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('months');
  const [typeIsGeneric, setTypeIsGeneric] = useState(false);

  // Familiar Form State
  const [famName, setFamName] = useState('');
  const [famPhone, setFamPhone] = useState('');
  const [famEmail, setFamEmail] = useState('');
  const [famBirthDate, setFamBirthDate] = useState('');
  const [famColor, setFamColor] = useState('rose');

  // Category Modal & Form State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProcedureCategory | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');

  // Open Category Form
  const handleOpenCategoryCreate = () => {
    setEditingCategory(null);
    setCatName('');
    setShowCategoryModal(true);
  };

  const handleOpenCategoryEdit = (cat: ProcedureCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setShowCategoryModal(true);
  };

  // Open Provider Form
  const handleOpenProviderCreate = () => {
    setEditingProvider(null);
    setProvName('');
    setProvSpecialty('');
    setProvPhone('');
    setProvWhatsApp('');
    setProvEmail('');
    setProvAddress('');
    setShowProviderModal(true);
  };

  const handleOpenProviderEdit = (prov: HealthProvider) => {
    setEditingProvider(prov);
    setProvName(prov.name);
    setProvSpecialty(prov.specialty || '');
    setProvPhone(prov.phone || '');
    setProvWhatsApp(prov.whatsapp || '');
    setProvEmail(prov.email || '');
    setProvAddress(prov.address || '');
    setShowProviderModal(true);
  };

  // Open Procedure Type Form
  const handleOpenTypeCreate = () => {
    setEditingType(null);
    setTypeName('');
    setTypeDescription('');
    setTypeFreqValue(6);
    setTypeFreqUnit('months');
    setTypeIsGeneric(false);
    setShowTypeModal(true);
  };

  const handleOpenTypeEdit = (type: ProcedureType) => {
    setEditingType(type);
    setTypeName(type.name);
    setTypeDescription(type.description || '');
    setTypeFreqValue(type.defaultFrequencyValue || 6);
    setTypeFreqUnit(type.defaultFrequencyUnit || 'months');
    setTypeIsGeneric(type.isGeneric || false);
    setShowTypeModal(true);
  };

  // Provider CRUD Handlers
  const handleSaveProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName.trim()) return;

    const data: HealthProvider = {
      id: editingProvider ? editingProvider.id : crypto.randomUUID(),
      name: provName.trim(),
      specialty: provSpecialty.trim() || undefined,
      phone: provPhone.trim() || undefined,
      whatsapp: provWhatsApp.trim() || undefined,
      email: provEmail.trim() || undefined,
      address: provAddress.trim() || undefined
    };

    let updated: HealthProvider[];
    if (editingProvider) {
      updated = providers.map(p => p.id === editingProvider.id ? data : p);
    } else {
      updated = [data, ...providers];
    }

    onSaveProviders(updated);
    setShowProviderModal(false);
  };

  const handleDeleteProvider = (id: string) => {
    const updated = providers.filter(p => p.id !== id);
    onSaveProviders(updated);
    setConfirmDeleteProviderId(null);
  };

  // Procedure Type CRUD Handlers
  const handleSaveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName.trim()) return;

    const data: ProcedureType = {
      id: editingType ? editingType.id : crypto.randomUUID(),
      name: typeName.trim(),
      description: typeDescription.trim() || undefined,
      defaultFrequencyValue: Number(typeFreqValue) || undefined,
      defaultFrequencyUnit: typeFreqUnit,
      isGeneric: typeIsGeneric
    };

    let updated: ProcedureType[];
    if (editingType) {
      updated = procedureTypes.map(t => t.id === editingType.id ? data : t);
    } else {
      updated = [data, ...procedureTypes];
    }

    onSaveProcedureTypes(updated);
    setShowTypeModal(false);
  };

  const handleDeleteType = (id: string) => {
    const updated = procedureTypes.filter(t => t.id !== id);
    onSaveProcedureTypes(updated);
    setConfirmDeleteTypeId(null);
  };

  // Familiar Form Open/Edit Handlers
  const handleOpenFamiliarCreate = () => {
    setEditingFamiliar(null);
    setFamName('');
    setFamPhone('');
    setFamEmail('');
    setFamBirthDate('');
    setFamColor('rose');
    setShowFamiliarModal(true);
  };

  const handleOpenFamiliarEdit = (fam: Familiar) => {
    setEditingFamiliar(fam);
    setFamName(fam.name);
    setFamPhone(fam.phone || '');
    setFamEmail(fam.email || '');
    setFamBirthDate(fam.birthDate || '');
    setFamColor(fam.color || 'rose');
    setShowFamiliarModal(true);
  };

  // Familiar CRUD Handlers
  const handleSaveFamiliar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!famName.trim()) return;

    const data: Familiar = {
      id: editingFamiliar ? editingFamiliar.id : crypto.randomUUID(),
      name: famName.trim(),
      phone: famPhone.trim() || undefined,
      email: famEmail.trim() || undefined,
      birthDate: famBirthDate || undefined,
      color: famColor
    };

    let updated: Familiar[];
    if (editingFamiliar) {
      updated = familiars.map(f => f.id === editingFamiliar.id ? data : f);
    } else {
      updated = [data, ...familiars];
    }

    onSaveFamiliars(updated);
    setShowFamiliarModal(false);
  };

  const handleDeleteFamiliar = (id: string) => {
    const updated = familiars.filter(f => f.id !== id);
    onSaveFamiliars(updated);
    setConfirmDeleteFamiliarId(null);
  };

  // Category CRUD Handlers
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const data: ProcedureCategory = {
      id: editingCategory ? editingCategory.id : crypto.randomUUID(),
      name: catName.trim()
    };

    let updated: ProcedureCategory[];
    if (editingCategory) {
      updated = categories.map(c => c.id === editingCategory.id ? data : c);
    } else {
      updated = [data, ...categories];
    }

    onSaveCategories(updated);
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    onSaveCategories(updated);
    setConfirmDeleteCategoryId(null);
  };

  // Filter lists based on search and sort alphabetically
  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.specialty && p.specialty.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredTypes = procedureTypes.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredFamiliars = (familiars || []).filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredCategories = (categories || []).filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const formatFrequencyUnit = (unit?: 'days' | 'weeks' | 'months' | 'years', value: number = 1) => {
    const activeUnit = unit || 'months';
    if (value > 1) {
      switch (activeUnit) {
        case 'days': return 'dias';
        case 'weeks': return 'semanas';
        case 'months': return 'meses';
        case 'years': return 'anos';
      }
    } else {
      switch (activeUnit) {
        case 'days': return 'dia';
        case 'weeks': return 'semana';
        case 'months': return 'mês';
        case 'years': return 'ano';
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 overflow-hidden">
      {/* Header da Tela */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3 w-full md:w-[400px] shrink-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <ClipboardList className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans">Cadastros</h1>
            <p className="text-xs text-slate-500 mt-1">Configure os cadastros para seus atendimentos</p>
          </div>
        </div>
        
        <div className="flex-1 flex justify-start w-full lg:w-auto lg:ml-2">
          <PinnedItemsHeader pinnedItems={pinnedItems} onDropItem={onDropItem} onNavigateToTab={onNavigateToTab!} activeTab="registrations" />
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={
              activeSubTab === 'providers' 
                ? handleOpenProviderCreate 
                : activeSubTab === 'procedure_types' 
                ? handleOpenTypeCreate 
                : activeSubTab === 'familiars'
                ? handleOpenFamiliarCreate
                : handleOpenCategoryCreate
            }
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm hover:shadow-blue-600/20 active:scale-95 transition-all cursor-pointer w-full sm:w-[190px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeSubTab === 'providers' 
                ? 'Cadastrar Profissional' 
                : activeSubTab === 'procedure_types' 
                ? 'Cadastrar Procedimento' 
                : activeSubTab === 'familiars'
                ? 'Cadastrar Familiar'
                : 'Cadastrar Categoria'}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0">
        {/* Toggle tabs */}
        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl self-start overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setActiveSubTab('providers');
              setSearchQuery('');
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'providers'
                ? 'bg-[#edf5fd] text-[#45556c] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profissionais / Clínicas
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${activeSubTab === 'providers' ? 'bg-[#dbe9fa] text-[#45556c]' : 'bg-slate-200 text-slate-600'}`}>
              {providers.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('procedure_types');
              setSearchQuery('');
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'procedure_types'
                ? 'bg-[#edf5fd] text-[#45556c] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            Tipos de Procedimentos
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${activeSubTab === 'procedure_types' ? 'bg-[#dbe9fa] text-[#45556c]' : 'bg-slate-200 text-slate-600'}`}>
              {procedureTypes.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('familiars');
              setSearchQuery('');
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'familiars'
                ? 'bg-[#edf5fd] text-[#45556c] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Familiares
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${activeSubTab === 'familiars' ? 'bg-[#dbe9fa] text-[#45556c]' : 'bg-slate-200 text-slate-600'}`}>
              {familiars.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('categories');
              setSearchQuery('');
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'categories'
                ? 'bg-[#edf5fd] text-[#45556c] shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Categorias
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${activeSubTab === 'categories' ? 'bg-[#dbe9fa] text-[#45556c]' : 'bg-slate-200 text-slate-600'}`}>
              {categories.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeSubTab === 'providers' 
                ? "Buscar por nome ou especialidade..." 
                : activeSubTab === 'procedure_types'
                ? "Buscar por procedimento..."
                : activeSubTab === 'familiars'
                ? "Buscar por familiar..."
                : "Buscar por categoria..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Grid Content rendering */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6">
        <AnimatePresence mode="wait">
        {activeSubTab === 'providers' ? (
          <motion.div
            key="providers-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredProviders.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-100 text-center max-w-sm mx-auto w-full">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Nenhum profissional ou clínica</h3>
                <p className="text-xs text-slate-400 mt-1.5">Configure profissionais médicos ou clínicas para facilitar o preenchimento de suas consultas.</p>
                <button
                  onClick={handleOpenProviderCreate}
                  className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Primeiro</span>
                </button>
              </div>
            ) : (
              filteredProviders.map((prov) => {
                const isConfirmingDelete = confirmDeleteProviderId === prov.id;
                return (
                  <div
                    key={prov.id}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-left flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">{prov.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-[10px] font-bold text-blue-600 font-mono uppercase tracking-wider bg-blue-50/50 border border-blue-100/50 px-2 py-0.5 rounded-md inline-block">
                                {prov.specialty || 'Geral / Outros'}
                              </span>
                              <span 
                                title={`${getProviderProceduresCount(prov.id, prov.name) === 1 ? 'Procedimento' : 'Procedimentos'}`}
                                className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-help"
                              >
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                {getProviderProceduresCount(prov.id, prov.name)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info details */}
                      <div className="space-y-1.5 pt-2 text-slate-500 text-xs font-medium">
                        {prov.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{prov.phone}</span>
                          </div>
                        )}
                        {prov.whatsapp && (
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <a 
                              href={`https://wa.me/${prov.whatsapp.replace(/\D/g, '').length <= 11 ? '55' + prov.whatsapp.replace(/\D/g, '') : prov.whatsapp.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-emerald-600 hover:underline hover:text-emerald-700 transition-colors"
                            >
                              {prov.whatsapp}
                            </a>
                          </div>
                        )}
                        {prov.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{prov.email}</span>
                          </div>
                        )}
                        {prov.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <span className="line-clamp-2 text-slate-400 font-normal">{prov.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-end">
                      {isConfirmingDelete ? (
                        isProviderInUse(prov.id, prov.name) ? (
                          <div className="flex items-center justify-between w-full bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 shrink-0">
                              ⚠️ Profissional vinculado a procedimentos
                            </span>
                            <button
                              onClick={() => setConfirmDeleteProviderId(null)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Ok
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-rose-500">Excluir profissional?</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDeleteProvider(prov.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setConfirmDeleteProviderId(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenProviderEdit(prov)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Editar profissional"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteProviderId(prov.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir profissional"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        ) : activeSubTab === 'procedure_types' ? (
          <motion.div
            key="types-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredTypes.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-100 text-center max-w-sm mx-auto w-full">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Nenhum tipo de procedimento</h3>
                <p className="text-xs text-slate-400 mt-1.5">Defina os tipos comuns de consulta, exames e re-consultas com suas respectivas frequências recomendadas.</p>
                <button
                  onClick={handleOpenTypeCreate}
                  className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Primeiro</span>
                </button>
              </div>
            ) : (
              filteredTypes.map((type) => {
                const isConfirmingDelete = confirmDeleteTypeId === type.id;
                return (
                  <div
                    key={type.id}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-left flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                            <Activity className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">{type.name}{type.isGeneric ? ' (...)' : ''}</h3>
                            <div className="flex flex-wrap gap-1.5 items-center mt-1">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Freq: {type.defaultFrequencyValue || 6} {formatFrequencyUnit(type.defaultFrequencyUnit, type.defaultFrequencyValue || 6)}</span>
                              </div>
                              <span 
                                title={`${getTypeProceduresCount(type.name) === 1 ? 'Procedimento' : 'Procedimentos'}`}
                                className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 cursor-help"
                              >
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                {getTypeProceduresCount(type.name)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {type.description && (
                        <p className="text-xs text-slate-400 pt-1 line-clamp-2 leading-relaxed">
                          {type.description}
                        </p>
                      )}
                    </div>

                    {/* Actions footer */}
                    <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-end">
                      {isConfirmingDelete ? (
                        isTypeInUse(type.name) ? (
                          <div className="flex items-center justify-between w-full bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 shrink-0">
                              ⚠️ Tipo vinculado a procedimentos
                            </span>
                            <button
                              onClick={() => setConfirmDeleteTypeId(null)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Ok
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-rose-500">Excluir procedimento?</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDeleteType(type.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setConfirmDeleteTypeId(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenTypeEdit(type)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Editar procedimento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTypeId(type.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir procedimento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        ) : activeSubTab === 'familiars' ? (
          <motion.div
            key="familiars-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredFamiliars.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-100 text-center max-w-sm mx-auto w-full">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Nenhum familiar cadastrado</h3>
                <p className="text-xs text-slate-400 mt-1.5">Adicione membros da sua família para organizar os procedimentos e consultas deles separadamente.</p>
                <button
                  onClick={handleOpenFamiliarCreate}
                  className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Primeiro</span>
                </button>
              </div>
            ) : (
              filteredFamiliars.map((fam) => {
                const isConfirmingDelete = confirmDeleteFamiliarId === fam.id;
                
                const colClasses = getFamiliarColorClasses(fam.color);

                return (
                  <div
                    key={fam.id}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-left flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div 
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${colClasses.bg} ${colClasses.text} ${colClasses.border}`}
                            style={colClasses.isCustom ? { 
                              backgroundColor: `${colClasses.customColor}15`, 
                              color: colClasses.customColor, 
                              borderColor: `${colClasses.customColor}30` 
                            } : {}}
                          >
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-800 truncate">{fam.name}</h3>
                              <span 
                                className={`w-2.5 h-2.5 rounded-full ${colClasses.dot}`} 
                                style={colClasses.isCustom ? { backgroundColor: colClasses.customColor } : {}}
                                title={`Cor: ${fam.color || 'padrão'}`} 
                              />
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onNavigateToTab) {
                                    onNavigateToTab('procedures', '', fam.id);
                                  }
                                }}
                                title={`${getFamiliarProceduresCount(fam.id, fam.name) === 1 ? 'Procedimento' : 'Procedimentos'}`}
                                className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              >
                                <Stethoscope className="w-3 h-3 text-indigo-400 shrink-0" />
                                {getFamiliarProceduresCount(fam.id, fam.name)}
                              </button>
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onNavigateToTab) {
                                    onNavigateToTab('controle', '', fam.id);
                                  }
                                }}
                                title={`${getFamiliarMedicamentosCount(fam.id) === 1 ? 'Medicamento' : 'Medicamentos'}`}
                                className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                              >
                                <Pill className="w-3 h-3 text-emerald-400 shrink-0" />
                                {getFamiliarMedicamentosCount(fam.id)}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact & Birth Info */}
                      <div className="space-y-1.5 pt-2 text-slate-500 text-xs font-medium">
                        {fam.birthDate && (
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(fam.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                        {fam.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{fam.phone}</span>
                          </div>
                        )}
                        {fam.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{fam.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-end">
                      {isConfirmingDelete ? (
                        isFamiliarInUse(fam.id, fam.name) ? (
                          <div className="flex items-center justify-between w-full bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 shrink-0">
                              ⚠️ Familiar vinculado a procedimentos
                            </span>
                            <button
                              onClick={() => setConfirmDeleteFamiliarId(null)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Ok
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-rose-500">Excluir familiar?</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDeleteFamiliar(fam.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setConfirmDeleteFamiliarId(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenFamiliarEdit(fam)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Editar familiar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteFamiliarId(fam.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir familiar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        ) : (
          <motion.div
            key="categories-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredCategories.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-100 text-center max-w-sm mx-auto w-full">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
                  <Tag className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Nenhuma categoria cadastrada</h3>
                <p className="text-xs text-slate-400 mt-1.5">Adicione categorias (ex: Dentista, Vacinas) para organizar melhor seus procedimentos e exames.</p>
                <button
                  onClick={handleOpenCategoryCreate}
                  className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Primeira</span>
                </button>
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isConfirmingDelete = confirmDeleteCategoryId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-left flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0">
                            <Tag className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">{cat.name}</h3>
                            <span 
                              title={`${getCategoryProceduresCount(cat.name) === 1 ? 'Procedimento' : 'Procedimentos'}`}
                              className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 cursor-help"
                            >
                              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                              {getCategoryProceduresCount(cat.name)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-end">
                      {isConfirmingDelete ? (
                        isCategoryInUse(cat.name) ? (
                          <div className="flex items-center justify-between w-full bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 shrink-0">
                              ⚠️ Categoria vinculada a procedimentos
                            </span>
                            <button
                              onClick={() => setConfirmDeleteCategoryId(null)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Ok
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-rose-500">Excluir categoria?</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setConfirmDeleteCategoryId(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenCategoryEdit(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Editar categoria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCategoryId(cat.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Provider CRUD Modal */}
      <AnimatePresence>
        {showProviderModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden my-8"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingProvider ? 'Editar Profissional/Clínica' : 'Novo Profissional/Clínica'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Cadastre detalhes de contato e endereço</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProviderModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProvider} className="p-6 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Nome Completo / Clínica *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dr. Carlos Ramos, Laboratório Exame..."
                    value={provName}
                    onChange={(e) => setProvName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Especialidade / Tipo de Atendimento</label>
                  <input
                    type="text"
                    placeholder="Ex: Cardiologia, Pediatria, Laboratório..."
                    value={provSpecialty}
                    onChange={(e) => setProvSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Telefone</label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={provPhone}
                      onChange={(e) => setProvPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">WhatsApp</label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={provWhatsApp}
                      onChange={(e) => setProvWhatsApp(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">E-mail</label>
                  <input
                    type="email"
                    placeholder="Ex: dr.carlos@email.com"
                    value={provEmail}
                    onChange={(e) => setProvEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Endereço Completo</label>
                  <div className="flex items-stretch gap-2">
                    <textarea
                      placeholder="Ex: Av. Paulista, 1000 - Sala 42, São Paulo - SP"
                      value={provAddress}
                      onChange={(e) => setProvAddress(e.target.value)}
                      rows={2}
                      className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 resize-none"
                    />
                    <a
                      href={provAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provAddress)}` : '#'}
                      target={provAddress ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className={`w-12 border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-all group ${
                        !provAddress ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:border-slate-200' : ''
                      }`}
                      title={provAddress ? "Abrir endereço no Google Maps" : "Digite um endereço para abrir no Google Maps"}
                      onClick={(e) => {
                        if (!provAddress) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EA4335" />
                        <path d="M12 11.5C13.3807 11.5 14.5 10.3807 14.5 9C14.5 7.61929 13.3807 6.5 12 6.5C10.6193 6.5 9.5 7.61929 9.5 9C9.5 10.3807 10.6193 11.5 12 11.5Z" fill="#4285F4" />
                        <path d="M12 22C12 22 12.5 21.5 13.5 20.5C14.5 19.5 19 14.25 19 9C19 8.2 18.85 7.45 18.57 6.75L12 22Z" fill="#34A853" />
                        <path d="M12 2C10.5 2 9.15 2.45 8.05 3.2L13.5 11.5L12 2Z" fill="#FBBC05" />
                      </svg>
                      <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">Maps</span>
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowProviderModal(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    Salvar Cadastro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Procedure Type CRUD Modal */}
      <AnimatePresence>
        {showTypeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden my-8"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Activity className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingType ? 'Editar Tipo de Procedimento' : 'Novo Tipo de Procedimento'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Defina o nome e a frequência padrão para auto-preencher</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTypeModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveType} className="p-6 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Nome do Procedimento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Consulta Odontológica Geral, Exame Laboratorial..."
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Descrição / Observações</label>
                  <textarea
                    placeholder="O que este procedimento engloba? Ex: Exames de rotina recomendados pelo clínico geral."
                    value={typeDescription}
                    onChange={(e) => setTypeDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Frequência Padrão Recomendada</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                      <span className="text-xs text-slate-400 font-medium">Cada</span>
                      <input
                        type="number"
                        min="1"
                        value={typeFreqValue}
                        onChange={(e) => setTypeFreqValue(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-700 p-0 text-center"
                      />
                    </div>
                    
                    <select
                      value={typeFreqUnit}
                      onChange={(e) => setTypeFreqUnit(e.target.value as any)}
                      className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer focus:border-blue-500"
                    >
                      <option value="days">Dia(s)</option>
                      <option value="weeks">Semana(s)</option>
                      <option value="months">Mês(es)</option>
                      <option value="years">Ano(s)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setTypeIsGeneric(!typeIsGeneric)}
                    className={`w-10 h-5 rounded-full transition-all relative ${typeIsGeneric ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${typeIsGeneric ? 'left-6' : 'left-1'}`} />
                  </button>
                  <span className="text-xs font-bold text-slate-600">Genérico</span>
                  <span className="text-[10px] text-slate-400 font-medium">(Permite detalhamento ao cadastrar atendimento)</span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTypeModal(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    Salvar Procedimento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Familiar CRUD Modal */}
      <AnimatePresence>
        {showFamiliarModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden my-8"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingFamiliar ? 'Editar Familiar' : 'Novo Familiar'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Cadastre membros da família para associar aos procedimentos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFamiliarModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveFamiliar} className="p-6 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João Silva"
                    value={famName}
                    onChange={(e) => setFamName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Data de Nascimento</label>
                  <input
                    type="date"
                    value={famBirthDate}
                    onChange={(e) => setFamBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Telefone / Celular</label>
                  <input
                    type="tel"
                    placeholder="Ex: (11) 99999-9999"
                    value={famPhone}
                    onChange={(e) => setFamPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">E-mail</label>
                  <input
                    type="email"
                    placeholder="Ex: familiar@email.com"
                    value={famEmail}
                    onChange={(e) => setFamEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Identificação Visual / Cor *</label>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {[
                      { id: 'rose', name: 'Rosa', bg: 'bg-rose-500', ring: 'focus-visible:ring-rose-400' },
                      { id: 'blue', name: 'Azul', bg: 'bg-blue-500', ring: 'focus-visible:ring-blue-400' },
                      { id: 'emerald', name: 'Verde', bg: 'bg-emerald-500', ring: 'focus-visible:ring-emerald-400' },
                      { id: 'violet', name: 'Roxo', bg: 'bg-violet-500', ring: 'focus-visible:ring-violet-400' },
                      { id: 'amber', name: 'Amarelo/Laranja', bg: 'bg-amber-500', ring: 'focus-visible:ring-amber-400' },
                      { id: 'sky', name: 'Celeste', bg: 'bg-sky-500', ring: 'focus-visible:ring-sky-400' },
                      { id: 'orange', name: 'Laranja', bg: 'bg-orange-500', ring: 'focus-visible:ring-orange-400' },
                      { id: 'fuchsia', name: 'Fúcsia', bg: 'bg-fuchsia-500', ring: 'focus-visible:ring-fuchsia-400' },
                      { id: 'teal', name: 'Teal/Ciano', bg: 'bg-teal-500', ring: 'focus-visible:ring-teal-400' },
                    ].map((colorOpt) => (
                      <button
                        key={colorOpt.id}
                        type="button"
                        onClick={() => setFamColor(colorOpt.id)}
                        className={`w-7 h-7 rounded-full ${colorOpt.bg} transition-all cursor-pointer relative flex items-center justify-center hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${colorOpt.ring} ${
                          famColor === colorOpt.id ? 'ring-2 ring-offset-2 ring-slate-800 scale-105' : ''
                        }`}
                        title={colorOpt.name}
                      >
                        {famColor === colorOpt.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                        )}
                      </button>
                    ))}
                    
                    {/* Custom Color Picker */}
                    <div className="relative group">
                      <input
                        type="color"
                        id="fam-custom-color"
                        value={famColor.startsWith('#') ? famColor : '#6366f1'}
                        onChange={(e) => setFamColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        title="Escolher cor personalizada"
                      />
                      <button
                        type="button"
                        className={`w-7 h-7 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 transition-all hover:border-slate-400 hover:text-slate-500 ${
                          famColor.startsWith('#') ? 'ring-2 ring-offset-2 ring-slate-800 border-none' : ''
                        }`}
                        style={famColor.startsWith('#') ? { backgroundColor: famColor, color: '#fff' } : {}}
                      >
                        {famColor.startsWith('#') ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-white block shadow-sm" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {famColor.startsWith('#') && (
                      <div className="flex items-center ml-1">
                        <input
                          type="text"
                          value={famColor}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || val.startsWith('#')) {
                              setFamColor(val);
                            } else {
                              setFamColor('#' + val);
                            }
                          }}
                          className="w-16 px-1.5 py-1 text-[10px] font-mono border border-slate-200 rounded-md outline-none focus:border-blue-400 uppercase"
                          placeholder="#000000"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowFamiliarModal(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    Salvar Familiar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category CRUD Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden my-8"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                    <Tag className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingCategory ? 'Editar Categoria' : 'Cadastrar Nova Categoria'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Insira o nome da categoria para vincular nos procedimentos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="p-6 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Nome da Categoria *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dentista, Vacinas, Checkup..."
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    Salvar Categoria
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
