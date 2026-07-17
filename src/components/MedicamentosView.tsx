import { useState, useMemo, FormEvent } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Medicamento, Familiar } from '../types';
import MedicamentosTable from './MedicamentosTable';
import { 
  Pill, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Edit, 
  AlertTriangle, 
  User, 
  Clock, 
  Bookmark, 
  Check, 
  X, 
  Info, 
  ChevronRight, 
  Bell, 
  ShoppingCart,
  ShieldAlert,
  MessageSquare,
  Table,
  Calculator,
  FilterX,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTodayStrSP } from '../utils/stockHelper';
import { PinnedItemsHeader } from './PinnedItemsHeader';

interface MedicamentosViewProps {
  medicamentos: Medicamento[];
  onSaveMedicamentos: (updated: Medicamento[]) => void;
  familiars: Familiar[];
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  selectedFamiliarId?: string;
  onSelectedFamiliarIdChange?: (familiarId: string) => void;
  filterCritical?: boolean;
  onFilterCriticalChange?: (val: boolean) => void;
  pinnedItems: string[];
  onDropItem: (item: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export default function MedicamentosView({
  medicamentos,
  onSaveMedicamentos,
  familiars,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  selectedFamiliarId: externalSelectedFamiliarId,
  onSelectedFamiliarIdChange,
  filterCritical: externalFilterCritical,
  onFilterCriticalChange,
  pinnedItems,
  onDropItem,
  onNavigateToTab
}: MedicamentosViewProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setLocalSearchQuery(val);
    }
  };

  const [localSelectedFamiliarId, setLocalSelectedFamiliarId] = useState<string>('all');
  const selectedFamiliarId = externalSelectedFamiliarId !== undefined ? externalSelectedFamiliarId : localSelectedFamiliarId;
  const setSelectedFamiliarId = (val: string) => {
    if (onSelectedFamiliarIdChange) {
      onSelectedFamiliarIdChange(val);
    } else {
      setLocalSelectedFamiliarId(val);
    }
  };

  // Helper to get relative age/name from Familiar ID
  const getFamiliarName = (id: string) => {
    const found = familiars.find(f => f.id === id);
    return found ? found.name : 'Geral';
  };

  const [localFilterCritical, setLocalFilterCritical] = useState<boolean>(false);
  
  const filterCritical = externalFilterCritical !== undefined ? externalFilterCritical : localFilterCritical;
  const setFilterCritical = (val: boolean) => {
    if (onFilterCriticalChange) {
      onFilterCriticalChange(val);
    }
    setLocalFilterCritical(val);
  };
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicamento | null>(null);
  const [medToDelete, setMedToDelete] = useState<Medicamento | null>(null);

  // Form Fields State
  const [nome, setNome] = useState('');
  const [principioAtivo, setPrincipioAtivo] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [quantidadeAtual, setQuantidadeAtual] = useState<number>(10);
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(3);
  const [posologia, setPosologia] = useState('');
  const [vezesAoDia, setVezesAoDia] = useState<number>(1);
  const [pessoaId, setPessoaId] = useState('');
  
  const [doseManha, setDoseManha] = useState('');
  const [doseMeioDia, setDoseMeioDia] = useState('');
  const [doseTarde, setDoseTarde] = useState('');
  const [doseNoite, setDoseNoite] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  // Calculator States
  const [showCalc, setShowCalc] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcDisplay, setCalcDisplay] = useState('');

  const handleOpenCalculator = () => {
    const startVal = quantidadeAtual !== undefined && !isNaN(quantidadeAtual) ? quantidadeAtual : 0;
    setCalcExpression(startVal.toString());
    setCalcDisplay(startVal.toString());
    setShowCalc(!showCalc);
  };

  const safeEvaluate = (expr: string): string => {
    try {
      const clean = expr.replace(/[^0-9+\-*/. ]/g, '');
      if (!clean.trim()) return '0';
      const result = new Function(`return ${clean}`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return String(Math.round(result * 100) / 100);
      }
      return 'Erro';
    } catch {
      return 'Erro';
    }
  };

  const handleCalcBtnClick = (val: string) => {
    if (val === 'C') {
      const startVal = quantidadeAtual !== undefined && !isNaN(quantidadeAtual) ? quantidadeAtual : 0;
      setCalcExpression(startVal.toString());
      setCalcDisplay(startVal.toString());
    } else if (val === 'DEL') {
      const trimmed = calcExpression.trim();
      let next = '';
      if (trimmed.endsWith(' + ') || trimmed.endsWith(' - ') || trimmed.endsWith(' * ') || trimmed.endsWith(' / ')) {
        next = trimmed.slice(0, -3);
      } else {
        next = trimmed.slice(0, -1);
      }
      setCalcExpression(next || '0');
      setCalcDisplay(next || '0');
    } else if (val === '=') {
      const res = safeEvaluate(calcExpression);
      setCalcExpression(res);
      setCalcDisplay(res);
    } else if (['+', '-', '*', '/'].includes(val)) {
      setCalcExpression(prev => {
        const p = prev.trim();
        if (p === 'Erro' || p === '0') {
          return `${quantidadeAtual || 0} ${val} `;
        }
        return `${p} ${val} `;
      });
      setCalcDisplay(prev => {
        const p = prev.trim();
        if (p === 'Erro' || p === '0') {
          return `${quantidadeAtual || 0} ${val} `;
        }
        return `${p} ${val} `;
      });
    } else {
      setCalcExpression(prev => {
        const p = prev.trim();
        if (p === 'Erro' || p === '0') {
          return val;
        }
        return p + val;
      });
      setCalcDisplay(prev => {
        const p = prev.trim();
        if (p === 'Erro' || p === '0') {
          return val;
        }
        return p + val;
      });
    }
  };

  const handleQuickAdjust = (amount: number) => {
    const currentVal = Number(safeEvaluate(calcExpression));
    if (!isNaN(currentVal)) {
      const nextVal = Math.max(0, currentVal + amount);
      setCalcExpression(String(nextVal));
      setCalcDisplay(String(nextVal));
    }
  };

  const handleApplyCalc = () => {
    const res = safeEvaluate(calcExpression);
    if (res !== 'Erro') {
      const num = Number(res);
      if (!isNaN(num) && num >= 0) {
        setQuantidadeAtual(num);
      }
    }
    setShowCalc(false);
  };

  const filledCount = 
    (doseManha.trim() ? 1 : 0) + 
    (doseMeioDia.trim() ? 1 : 0) + 
    (doseTarde.trim() ? 1 : 0) + 
    (doseNoite.trim() ? 1 : 0);

  const isInvalid = Number(vezesAoDia) >= 1 && Number(vezesAoDia) <= 4 && filledCount !== Number(vezesAoDia);

  // Handle opening modal for add or edit
  const handleOpenModal = (med?: Medicamento) => {
    setShowErrors(false);
    setShowCalc(false);
    if (med) {
      setEditingMed(med);
      setNome(med.nome);
      setPrincipioAtivo(med.principioAtivo || '');
      setDosagem(med.dosagem || '');
      setQuantidadeAtual(med.quantidadeAtual);
      setEstoqueMinimo(med.estoqueMinimo);
      setPosologia(med.posologia || '');
      setVezesAoDia(med.vezesAoDia || 1);
      setPessoaId(med.pessoaId || '');
      setDoseManha(med.doseManha || '');
      setDoseMeioDia(med.doseMeioDia || '');
      setDoseTarde(med.doseTarde || '');
      setDoseNoite(med.doseNoite || '');
    } else {
      setEditingMed(null);
      setNome('');
      setPrincipioAtivo('');
      setDosagem('');
      setQuantidadeAtual(10);
      setEstoqueMinimo(3);
      setPosologia('');
      setVezesAoDia(1);
      setPessoaId('');
      setDoseManha('');
      setDoseMeioDia('');
      setDoseTarde('');
      setDoseNoite('');
    }
    setIsModalOpen(true);
  };

  // Save medicine
  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const todayStr = getTodayStrSP();

    const filledCount = 
      (doseManha.trim() ? 1 : 0) + 
      (doseMeioDia.trim() ? 1 : 0) + 
      (doseTarde.trim() ? 1 : 0) + 
      (doseNoite.trim() ? 1 : 0);

    const isInvalid = Number(vezesAoDia) >= 1 && Number(vezesAoDia) <= 4 && filledCount !== Number(vezesAoDia);

    if (isInvalid) {
      setShowErrors(true);
      return;
    }

    const medData: Medicamento = {
      id: editingMed ? editingMed.id : `med_${Date.now()}`,
      pessoaId,
      nome,
      principioAtivo,
      dosagem,
      quantidadeAtual: Number(quantidadeAtual),
      estoqueMinimo: Number(estoqueMinimo),
      posologia,
      vezesAoDia: Number(vezesAoDia),
      doseManha: doseManha,
      doseMeioDia: doseMeioDia,
      doseTarde: doseTarde,
      doseNoite: doseNoite,
      ownerId: editingMed ? editingMed.ownerId : 'user_local',
      dataAlteracaoEstoque: editingMed && editingMed.dataAlteracaoEstoque ? editingMed.dataAlteracaoEstoque : todayStr,
      ultimoEmailEnviadoEm: editingMed ? editingMed.ultimoEmailEnviadoEm : '',
    };

    let updatedList: Medicamento[];
    if (editingMed) {
      updatedList = medicamentos.map(m => m.id === editingMed.id ? medData : m);
    } else {
      updatedList = [medData, ...medicamentos];
    }

    onSaveMedicamentos(updatedList);
    setIsModalOpen(false);
  };

  // Delete medicine
  const handleDelete = (id: string) => {
    const updated = medicamentos.filter(m => m.id !== id);
    onSaveMedicamentos(updated);
    setMedToDelete(null);
  };

  // Adjust stock directly
  const handleAdjustStock = (med: Medicamento, amount: number) => {
    const updatedQty = Math.max(0, med.quantidadeAtual + amount);
    const updated = medicamentos.map(m => {
      if (m.id === med.id) {
        return {
          ...m,
          quantidadeAtual: updatedQty,
          dataAlteracaoEstoque: getTodayStrSP() // Sync alteration date on manual change
        };
      }
      return m;
    });
    onSaveMedicamentos(updated);
  };

  const handleShareWhatsApp = () => {
    const criticalMedications = medicamentos.filter(m => m.quantidadeAtual < m.estoqueMinimo);

    // Group by familiar name
    const grouped = criticalMedications.reduce((acc, m) => {
        const familiarName = getFamiliarName(m.pessoaId);
        if (!acc[familiarName]) acc[familiarName] = [];
        acc[familiarName].push(m);
        return acc;
    }, {} as Record<string, Medicamento[]>);

    const textLines = Object.entries(grouped).map(([familiar, meds]) => {
        return `*${familiar}*%0A${meds.map(m => `- ${m.nome}: Est.: ${m.quantidadeAtual} / Mín.: ${m.estoqueMinimo} / falta ${Math.max(0, m.estoqueMinimo - m.quantidadeAtual)}`).join('%0A')}`;
    }).join('%0A%0A');

    const text = `🚨 *Alerta de Estoque Crítico* 🚨%0A%0A${textLines}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Fast intake "Tomar Dose" log helper
  const handleRecordIntake = (med: Medicamento) => {
    if (med.quantidadeAtual <= 0) {
      alert('Estoque esgotado! Por favor, registre o reabastecimento primeiro.');
      return;
    }
    const updatedQty = Math.max(0, med.quantidadeAtual - 1);
    const updated = medicamentos.map(m => {
      if (m.id === med.id) {
        return {
          ...m,
          quantidadeAtual: updatedQty,
          dataAlteracaoEstoque: getTodayStrSP() // reset alteration to today as they just manually recorded
        };
      }
      return m;
    });
    onSaveMedicamentos(updated);
  };

  // Filter logic
  const filteredMeds = useMemo(() => {
    return medicamentos.filter(med => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = med.nome.toLowerCase().includes(query) ||
                            (med.principioAtivo || '').toLowerCase().includes(query) ||
                            (med.posologia || '').toLowerCase().includes(query) ||
                            getFamiliarName(med.pessoaId).toLowerCase().includes(query);
      
      const matchesFamiliar = selectedFamiliarId === 'all' || med.pessoaId === selectedFamiliarId;
      const matchesCritical = !filterCritical || med.quantidadeAtual < med.estoqueMinimo;

      return matchesSearch && matchesFamiliar && matchesCritical;
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [medicamentos, searchQuery, selectedFamiliarId, filterCritical, familiars]);

  const criticalCount = useMemo(() => {
    return medicamentos.filter(m => 
      m.quantidadeAtual < m.estoqueMinimo && 
      (selectedFamiliarId === 'all' || m.pessoaId === selectedFamiliarId)
    ).length;
  }, [medicamentos, selectedFamiliarId]);

  const groupedCriticalMedications = useMemo(() => {
    const critical = medicamentos.filter(m => 
      m.quantidadeAtual < m.estoqueMinimo && 
      (selectedFamiliarId === 'all' || m.pessoaId === selectedFamiliarId)
    );
    return critical.reduce((acc, m) => {
        const familiarName = getFamiliarName(m.pessoaId);
        if (!acc[familiarName]) acc[familiarName] = [];
        acc[familiarName].push(m);
        return acc;
    }, {} as Record<string, Medicamento[]>);
  }, [medicamentos, familiars, selectedFamiliarId]);

  const getFamiliarBadgeStyle = (id: string) => {
    const found = familiars.find(f => f.id === id);
    if (!found) return 'bg-slate-100 text-slate-700';
    switch (found.color) {
      case 'indigo': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'rose': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'emerald': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'amber': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'purple': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  const getFrequencyLabel = (code?: number) => {
    if (!code) return 'Não definido';
    if (code >= 1 && code <= 4) return `${code}x ao dia`;
    if (code === 5) return '1x no mês';
    if (code === 6) return 'Eventual / Sob Demanda';
    return 'Manual';
  };

  const hasActiveFiltersOrSort = searchQuery !== '' || selectedFamiliarId !== 'all' || filterCritical === true;

  const handleClearFiltersAndSort = () => {
    setSearchQuery('');
    setSelectedFamiliarId('all');
    setFilterCritical(false);
  };

  return (
    <div id="medicamentos_panel" className="flex-1 flex flex-col min-h-0 space-y-6 text-left overflow-hidden">
      {/* Header da Tela - Div Superior com Título/Ícone, Busca e Cadastro */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3 w-full md:w-[400px] shrink-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <Pill className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans">Controle de Medicamentos</h1>
            <p className="text-xs text-slate-500 mt-1">Gerencie seus medicamentos e estoque</p>
          </div>
        </div>
        
        <div className="flex-1 flex justify-start w-full lg:w-auto lg:ml-2">
          <PinnedItemsHeader pinnedItems={pinnedItems} onDropItem={onDropItem} onNavigateToTab={onNavigateToTab} activeTab="medicamentos" />
        </div>

        {/* Botão Cadastrar Medicamento */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer h-10 whitespace-nowrap w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Medicamento</span>
          </button>
        </div>
      </div>

      {/* Div Inferior com Filtros e Relatórios */}
      <div className="bg-white pt-[17px] pb-4 px-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shrink-0">
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
            title={hasActiveFiltersOrSort ? "Limpar todos os filtros de busca" : "Nenhum filtro ativo"}
          >
            <FilterX className="w-4 h-4" />
          </button>

          {/* Familiar Selector Filter */}
          <div className="relative shrink-0">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedFamiliarId}
              onChange={(e) => setSelectedFamiliarId(e.target.value)}
              className="pl-9 pr-8 pt-[9px] pb-[7px] bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer font-semibold text-slate-600 min-w-[160px] w-full sm:w-auto h-9"
            >
              <option value="all">
                Todos os Familiares ({
                  (medicamentos || []).filter(m => !filterCritical || m.quantidadeAtual < m.estoqueMinimo).length
                })
              </option>
              {[...familiars].sort((a, b) => a.name.localeCompare(b.name)).map(fam => {
                const count = (medicamentos || []).filter(m => m.pessoaId === fam.id && (!filterCritical || m.quantidadeAtual < m.estoqueMinimo)).length;
                return (
                  <option key={fam.id} value={fam.id}>
                    {fam.name} ({count})
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-2.5 top-3 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Toggle Stock Filter */}
          <button
            onClick={() => {
              const nextVal = !filterCritical;
              setFilterCritical(nextVal);
              if (nextVal) {
                setSelectedFamiliarId('all');
              }
            }}
            className={`w-full sm:w-auto px-4 py-2 h-9 border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              filterCritical 
                ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-xs' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Ver Apenas Críticos</span>
          </button>
        </div>

        {/* Botões de Relatório e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto lg:justify-end">
          {/* Busca */}
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar medicamento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all h-9 shadow-xs"
            />
          </div>

          {/* Download Summary Report */}
          <button
            onClick={() => {
              const doc = new jsPDF({ orientation: 'landscape' });
              doc.setFontSize(16);
              doc.text('Resumo Completo de Medicamentos', 14, 20);
              
              autoTable(doc, {
                startY: 30,
                head: [['Paciente', 'Medicamento', 'Dosagem', 'Princípio Ativo', 'Frequência', 'Estoque', 'Mínimo', 'Posologia']],
                body: medicamentos.map(med => [
                  getFamiliarName(med.pessoaId),
                  med.nome,
                  med.dosagem,
                  med.principioAtivo || '-',
                  getFrequencyLabel(med.vezesAoDia),
                  med.quantidadeAtual.toString(),
                  med.estoqueMinimo.toString(),
                  med.posologia || '-'
                ]),
                styles: { fontSize: 8 },
              });
              doc.save('Resumo_Medicamentos.pdf');
            }}
            className="w-full sm:w-auto px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-all cursor-pointer h-9 shadow-xs whitespace-nowrap"
          >
            <Bookmark className="w-4 h-4" />
            <span>Baixar Resumo</span>
          </button>

          {/* Download Table Report */}
          <button
            disabled={selectedFamiliarId === 'all'}
            onClick={() => {
              const doc = new jsPDF();
              const familiarName = selectedFamiliarId === 'all' ? 'TODOS' : getFamiliarName(selectedFamiliarId).toUpperCase();
              
              doc.setFontSize(16);
              doc.text(`MEDICAMENTOS / FAMILIAR - ${familiarName}`, 14, 20);
              
              const sortedMeds = [...filteredMeds].sort((a, b) => {
                const getPriority = (m: Medicamento) => {
                  if (m.doseManha && m.doseManha.trim() !== '') return 1;
                  if (m.doseMeioDia && m.doseMeioDia.trim() !== '') return 2;
                  if (m.doseTarde && m.doseTarde.trim() !== '') return 3;
                  if (m.doseNoite && m.doseNoite.trim() !== '') return 4;
                  return 5;
                };
                return getPriority(a) - getPriority(b);
              });

              autoTable(doc, {
                startY: 30,
                head: [['Medicamento', 'Manhã', 'Almoco', 'Tarde', 'Noite', 'Obs.']],
                body: sortedMeds.map(med => [
                  `${med.nome} ${med.dosagem}\n${med.principioAtivo}`,
                  med.doseManha || '-',
                  med.doseMeioDia || '-',
                  med.doseTarde || '-',
                  med.doseNoite || '-',
                  med.posologia || '-'
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [241, 245, 249], textColor: [100, 116, 139] },
                columnStyles: {
                  0: { cellWidth: 'auto' },
                  1: { cellWidth: 18 },
                  2: { cellWidth: 18 },
                  3: { cellWidth: 18 },
                  4: { cellWidth: 18 },
                },
              });
              
              doc.save(`Medicamentos_${familiarName}.pdf`);
            }}
            className="w-full sm:w-auto px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-all cursor-pointer h-9 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white whitespace-nowrap shadow-xs"
          >
            <Table className="w-4 h-4" />
            <span>Baixar Tabela</span>
          </button>
        </div>
      </div>

      {/* Medicines Inventory List Grid */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6">
      {filteredMeds.length === 0 ? (
        <div className="bg-white py-16 px-4 border border-slate-100 rounded-2xl text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 mx-auto">
            <Pill className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm">Nenhum medicamento encontrado</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed font-sans">
              Não há remédios cadastrados ou os filtros atuais não correspondem a nenhum resultado.
            </p>
          </div>
          {(searchQuery || selectedFamiliarId !== 'all' || filterCritical) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFamiliarId('all');
                setFilterCritical(false);
              }}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeds.map((med) => {
            const isCritical = med.quantidadeAtual < med.estoqueMinimo;
            
            return (
              <div 
                key={med.id}
                onDoubleClick={() => handleOpenModal(med)}
                className={`${isCritical ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-slate-100'} rounded-2xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 text-left cursor-pointer`}
              >
                {/* Medicine Main Header Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base">{med.nome}</h3>
                        {med.dosagem && (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                            {med.dosagem}
                          </span>
                        )}
                        <span className={`text-[12px] font-bold px-2 py-0.5 border rounded-md uppercase tracking-wider ${getFamiliarBadgeStyle(med.pessoaId)}`}>
                          {getFamiliarName(med.pessoaId)}
                        </span>
                      </div>
                      {med.principioAtivo && (
                        <p className="text-xs text-slate-400 font-mono">Princípio Ativo: {med.principioAtivo}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenModal(med)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar Medicamento"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMedToDelete(med)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Frequency and period-of-day badges + Orientação */}
                  <div className="flex flex-col gap-2 w-full">
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1.5 border border-slate-100/50 w-full">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">{getFrequencyLabel(med.vezesAoDia)}</span>
                        </div>
                        
                        {/* Active period schedules details if configured */}
                        <div className="flex gap-1.5 items-center">
                            {med.doseManha && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100" title={`Manhã: ${med.doseManha}`}>
                                {med.doseManha} ☀️ M
                              </span>
                            )}
                            {med.doseMeioDia && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100" title={`Almoço: ${med.doseMeioDia}`}>
                                {med.doseMeioDia} 🌤️ A
                              </span>
                            )}
                            {med.doseTarde && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100" title={`Tarde: ${med.doseTarde}`}>
                                {med.doseTarde} ⛅ T
                              </span>
                            )}
                            {med.doseNoite && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100" title={`Noite: ${med.doseNoite}`}>
                                {med.doseNoite} 🌙 N
                              </span>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Side-by-side layout: Observações (Posologia) on the left, Stock details on the right */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100 items-center justify-between w-full">
                      {/* Observações de Uso / Posologia */}
                      <div className="w-full sm:flex-1 relative">
                        {med.posologia ? (
                          <div className={med.posologia.length > 100 ? 'group' : ''}>
                            <p className="w-full text-xs text-slate-500 font-sans italic bg-slate-50/30 p-2.5 rounded-xl border border-dashed border-slate-200 truncate" title={med.posologia}>
                              {med.posologia.length > 100 ? `${med.posologia.slice(0, 100)}...` : med.posologia}
                            </p>
                            {/* Custom Tooltip */}
                            {med.posologia.length > 100 && (
                              <div className="absolute left-0 bottom-full mb-1 w-full bg-slate-50 text-slate-500 text-xs p-2.5 rounded-xl border border-dashed border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50 pointer-events-none shadow-lg italic">
                                {med.posologia}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="w-full text-xs text-slate-400 font-sans italic bg-slate-50/10 p-2.5 rounded-xl border border-dashed border-slate-100/50 truncate">
                            Sem observações de uso
                          </p>
                        )}
                      </div>

                      {/* Stock Info beside Observações */}
                      <div className="w-full sm:w-auto shrink-0 bg-slate-50 rounded-xl p-2 px-3 border border-slate-100 flex items-center justify-between gap-3 h-10">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-sans font-medium uppercase tracking-wider">Estoque:</span>
                          <span className={`text-base font-black font-mono ${
                            isCritical ? 'text-rose-600' : 'text-slate-800'
                          }`}>
                            {med.quantidadeAtual}
                          </span>
                        </div>
                        <div className="h-4 w-[1px] bg-slate-200" />
                        <span className="text-[10px] text-slate-400 font-mono">
                          Mínimo: {med.estoqueMinimo}
                        </span>
                        <div className="flex items-center">
                          {isCritical ? (
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md animate-pulse inline-flex items-center justify-center">
                              CRÍTICO
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-flex items-center justify-center">
                              OK
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Edit/Add Modal dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-600" />
                  {editingMed ? 'Editar Medicamento' : 'Novo Medicamento no Estoque'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Paciente e Nome */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Familiar (Paciente)</label>
                    <select
                      value={pessoaId}
                      onChange={(e) => setPessoaId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50 cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      {[...familiars].sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nome do Remédio</label>
                    <input
                      type="text"
                      placeholder="Ex: Dipirona, Losartana"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Concentração e Principio Ativo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Dosagem / Concentração</label>
                    <input
                      type="text"
                      placeholder="Ex: 500mg, 10ml, 1 comprimido"
                      value={dosagem}
                      onChange={(e) => setDosagem(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Princípio Ativo</label>
                    <input
                      type="text"
                      placeholder="Ex: Metamizol, Losartana Potássica"
                      value={principioAtivo}
                      onChange={(e) => setPrincipioAtivo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Quantidade Atual e Estoque Minimo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Quantidade Atual (Estoque)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={quantidadeAtual}
                        onChange={(e) => setQuantidadeAtual(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleOpenCalculator}
                        className={`px-3 py-2 border rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          showCalc 
                            ? 'bg-blue-50 border-blue-200 text-blue-600' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 active:scale-95'
                        }`}
                        title="Calcular estoque"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Calculator Dropdown/Popover */}
                    {showCalc && (
                      <div className="absolute top-full mt-1 left-0 right-0 sm:left-auto sm:w-[220px] z-[60] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5 text-left">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                            <Calculator className="w-3 h-3 text-blue-500" /> Calculadora
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCalc(false)}
                            className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Display */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-right font-mono text-slate-700 overflow-x-auto whitespace-nowrap scrollbar-none">
                          <div className="font-semibold text-[11px] text-slate-700 tracking-wide">{calcDisplay || '0'}</div>
                          <div className="text-[10px] text-blue-600 font-bold mt-0.5">Total: {safeEvaluate(calcExpression)}</div>
                        </div>

                        {/* Quick Adjust buttons */}
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(10)}
                            className="py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition-colors cursor-pointer border border-blue-100/50"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(30)}
                            className="py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition-colors cursor-pointer border border-blue-100/50"
                          >
                            +30
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(60)}
                            className="py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition-colors cursor-pointer border border-blue-100/50"
                          >
                            +60
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(-1)}
                            className="py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold transition-colors cursor-pointer border border-rose-100/50"
                          >
                            -1
                          </button>
                        </div>

                        {/* Standard Numpad Grid */}
                        <div className="grid grid-cols-4 gap-1 text-[11px]">
                          {['7', '8', '9', '/'].map(btn => (
                            <button
                              key={btn}
                              type="button"
                              onClick={() => handleCalcBtnClick(btn)}
                              className="py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold font-mono transition-colors cursor-pointer active:scale-95 border border-slate-100"
                            >
                              {btn}
                            </button>
                          ))}
                          {['4', '5', '6', '*'].map(btn => (
                            <button
                              key={btn}
                              type="button"
                              onClick={() => handleCalcBtnClick(btn)}
                              className="py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold font-mono transition-colors cursor-pointer active:scale-95 border border-slate-100"
                            >
                              {btn}
                            </button>
                          ))}
                          {['1', '2', '3', '-'].map(btn => (
                            <button
                              key={btn}
                              type="button"
                              onClick={() => handleCalcBtnClick(btn)}
                              className="py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold font-mono transition-colors cursor-pointer active:scale-95 border border-slate-100"
                            >
                              {btn}
                            </button>
                          ))}
                          {['C', '0', 'DEL', '+'].map(btn => (
                            <button
                              key={btn}
                              type="button"
                              onClick={() => handleCalcBtnClick(btn)}
                              className={`py-1.5 rounded-lg font-bold font-mono transition-colors cursor-pointer active:scale-95 border ${
                                btn === 'C' ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-100' : 
                                btn === 'DEL' ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-100 text-[9px]' : 
                                'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-100'
                              }`}
                            >
                              {btn === 'DEL' ? '⌫' : btn}
                            </button>
                          ))}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleApplyCalc}
                            className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm shadow-blue-100 cursor-pointer text-center"
                          >
                            Inserir no Estoque
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Mínimo de Segurança</label>
                    <input
                      type="number"
                      min="0"
                      value={estoqueMinimo}
                      onChange={(e) => setEstoqueMinimo(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50 font-mono"
                    />
                  </div>
                </div>

                {/* Frequência (Posologia) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Frequência de Uso</label>
                  <select
                    value={vezesAoDia}
                    onChange={(e) => {
                      setVezesAoDia(Number(e.target.value));
                      setDoseManha('');
                      setDoseMeioDia('');
                      setDoseTarde('');
                      setDoseNoite('');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50 cursor-pointer"
                  >
                    <option value={1}>1 vez ao dia (Diário)</option>
                    <option value={2}>2 vezes ao dia (Diário)</option>
                    <option value={3}>3 vezes ao dia (Diário)</option>
                    <option value={4}>4 vezes ao dia (Diário)</option>
                    <option value={5}>1 vez ao mês (Frequência Mensal)</option>
                    <option value={6}>Uso Eventual / Sob Demanda / Manual</option>
                  </select>
                </div>

                {/* Condicional de Períodos se Frequência diária selecionada */}
                {vezesAoDia >= 1 && vezesAoDia <= 4 && (() => {
                  const showManha = filledCount < vezesAoDia || !!doseManha.trim();
                  const showMeioDia = filledCount < vezesAoDia || !!doseMeioDia.trim();
                  const showTarde = filledCount < vezesAoDia || !!doseTarde.trim();
                  const showNoite = filledCount < vezesAoDia || !!doseNoite.trim();

                  const activeCount = 
                    (showManha ? 1 : 0) + 
                    (showMeioDia ? 1 : 0) + 
                    (showTarde ? 1 : 0) + 
                    (showNoite ? 1 : 0);

                  return (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Especificação de Doses por Período</span>
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                          {filledCount} de {vezesAoDia} preenchidos
                        </span>
                      </div>
                      
                      <div className="grid gap-2.5 w-full" style={{ gridTemplateColumns: `repeat(${activeCount}, minmax(0, 1fr))` }}>
                        {showManha && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 block truncate">☀️ Manhã</label>
                            <input
                              type="text"
                              placeholder="Ex: 1 comp"
                              value={doseManha}
                              onChange={(e) => setDoseManha(e.target.value)}
                              maxLength={8}
                              className={`w-full px-2 py-1.5 border ${showErrors && isInvalid && !doseManha.trim() ? 'border-rose-500' : 'border-slate-200'} rounded-lg text-xs focus:outline-none bg-white text-center`}
                            />
                          </div>
                        )}

                        {showMeioDia && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 block truncate">🌤️ Almoço</label>
                            <input
                              type="text"
                              placeholder="Ex: 1 comp"
                              value={doseMeioDia}
                              onChange={(e) => setDoseMeioDia(e.target.value)}
                              maxLength={8}
                              className={`w-full px-2 py-1.5 border ${showErrors && isInvalid && !doseMeioDia.trim() ? 'border-rose-500' : 'border-slate-200'} rounded-lg text-xs focus:outline-none bg-white text-center`}
                            />
                          </div>
                        )}

                        {showTarde && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 block truncate">⛅ Tarde</label>
                            <input
                              type="text"
                              placeholder="Ex: 1 comp"
                              value={doseTarde}
                              onChange={(e) => setDoseTarde(e.target.value)}
                              maxLength={8}
                              className={`w-full px-2 py-1.5 border ${showErrors && isInvalid && !doseTarde.trim() ? 'border-rose-500' : 'border-slate-200'} rounded-lg text-xs focus:outline-none bg-white text-center`}
                            />
                          </div>
                        )}

                        {showNoite && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 block truncate">🌙 Noite</label>
                            <input
                              type="text"
                              placeholder="Ex: 1 comp"
                              value={doseNoite}
                              onChange={(e) => setDoseNoite(e.target.value)}
                              maxLength={8}
                              className={`w-full px-2 py-1.5 border ${showErrors && isInvalid && !doseNoite.trim() ? 'border-rose-500' : 'border-slate-200'} rounded-lg text-xs focus:outline-none bg-white text-center`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Posologia Gerais / Notas */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Observações de Uso / Posologia</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Tomar de estômago cheio. Evitar laticínios 2 horas antes de ingerir."
                    value={posologia}
                    onChange={(e) => setPosologia(e.target.value)}
                    maxLength={300}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50"
                  />
                </div>

                {/* Submit button bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer h-10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer h-10"
                  >
                    Salvar Medicamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {medToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 text-center space-y-4"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Remover Medicamento?</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  Tem certeza que deseja remover o medicamento <strong className="text-slate-800">{medToDelete.nome}</strong> do estoque? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setMedToDelete(null)}
                  className="w-full py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer h-10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(medToDelete.id)}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer h-10"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
