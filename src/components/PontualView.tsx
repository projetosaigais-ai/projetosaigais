import { useState, useMemo, useEffect, useRef } from 'react';
import { Tratamento, Familiar, MedicamentoTratamento, Attachment } from '../types';
import { 
  Plus, 
  Clock, 
  Trash2, 
  Calendar as CalendarIcon, 
  Pill, 
  Info, 
  Pencil, 
  User, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown,
  AlertCircle,
  FolderHeart,
  UserCheck,
  Archive,
  ArchiveRestore,
  FileText,
  X,
  Activity,
  Paperclip,
  Eye,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PinnedItemsHeader } from './PinnedItemsHeader';

interface PontualViewProps {
  tratamentos: Tratamento[];
  onSaveTratamentos: (updated: Tratamento[]) => void;
  familiars: Familiar[];
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  filterFamiliar?: string;
  onFilterFamiliarChange?: (familiarId: string) => void;
  pinnedItems?: string[];
  onDropItem?: (item: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export default function PontualView({
  tratamentos,
  onSaveTratamentos,
  familiars,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  filterFamiliar: externalFilterFamiliar,
  onFilterFamiliarChange,
  pinnedItems = [],
  onDropItem = () => {},
  onNavigateToTab = () => {},
}: PontualViewProps) {
  // Normalize treatments from older versions just in case
  const normalizedTratamentos = useMemo(() => {
    return tratamentos.map(t => {
      const anyT = t as any;
      if (anyT.medicamentos && Array.isArray(anyT.medicamentos)) {
        return {
          ...t,
          horaInicio: anyT.horaInicio || '06:00',
          sintomas: anyT.sintomas || ''
        };
      }
      return {
        id: t.id,
        ownerId: t.ownerId || 'user_local',
        nomeTratamento: anyT.nomeTratamento || anyT.nomeMedicamento || 'Tratamento Sem Nome',
        dataInicio: t.dataInicio || new Date().toISOString().split('T')[0],
        horaInicio: anyT.horaInicio || '06:00',
        sintomas: anyT.sintomas || '',
        familiarId: anyT.familiarId || 'proprio',
        medicamentos: [
          {
            id: `med_${Date.now()}_legacy`,
            nomeMedicamento: anyT.nomeMedicamento || '',
            dosagem: anyT.dosagem || '',
            intervaloHoras: anyT.intervaloHoras || 8,
            duracaoDias: anyT.duracaoDias || 7,
          }
        ]
      } as Tratamento;
    });
  }, [tratamentos]);

  // Tratamento Form States
  const [nomeTratamento, setNomeTratamento] = useState('');
  const [familiarId, setFamiliarId] = useState<string>('proprio');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [horaInicio, setHoraInicio] = useState('06:00');
  const [sintomas, setSintomas] = useState('');

  // Get familiar name safely
  const getFamiliarName = (fid?: string) => {
    if (!fid || fid === 'proprio') return 'Próprio Usuário';
    const fam = familiars.find(f => f.id === fid);
    return fam ? fam.name : 'Familiar';
  };

  const [tempMedicamentos, setTempMedicamentos] = useState<MedicamentoTratamento[]>([]);
  const [tempAttachments, setTempAttachments] = useState<Attachment[]>([]);

  // Lightbox modal state for viewing attachments
  const [lightboxAttachment, setLightboxAttachment] = useState<Attachment | null>(null);

  // Editing state for the whole treatment
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setLocalSearchQuery(val);
    }
  };

  // Temp Medication Form States
  const [medNome, setMedNome] = useState('');
  const [medDosagem, setMedDosagem] = useState('');
  const [medIntervalo, setMedIntervalo] = useState<number>(8);
  const [medDias, setMedDias] = useState<number>(7);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);

  // Taken doses persistence
  const [takenDoses, setTakenDoses] = useState<Record<string, boolean>>({});

  // Filter states for Agenda
  const [localFilterFamiliar, setLocalFilterFamiliar] = useState<string>('todos');
  const filterFamiliar = externalFilterFamiliar !== undefined ? externalFilterFamiliar : localFilterFamiliar;
  const setFilterFamiliar = (val: string) => {
    if (onFilterFamiliarChange) {
      onFilterFamiliarChange(val);
    } else {
      setLocalFilterFamiliar(val);
    }
  };
  const [filterTratamento, setFilterTratamento] = useState<string>('todos');

  // Status filter for treatments list (Ativos, Arquivados)
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'arquivados'>('ativos');

  const handleToggleArchiveTreatment = (id: string) => {
    const updated = normalizedTratamentos.map(t => 
      t.id === id ? { ...t, arquivado: !t.arquivado } : t
    );
    onSaveTratamentos(updated);
  };

  // Expanded days state for the accordion
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // State for Custom Delete Confirmation Modal
  const [treatmentIdToDelete, setTreatmentIdToDelete] = useState<string | null>(null);

  // Selected Treatment for Right Detailed Panel
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  // Auto-select the first treatment matching the status filter on initial load or filter change
  useEffect(() => {
    const available = normalizedTratamentos.filter(t => {
      if (statusFilter === 'ativos' && t.arquivado) return false;
      if (statusFilter === 'arquivados' && !t.arquivado) return false;
      return true;
    });

    if (available.length > 0) {
      if (isFirstRender.current) {
        setSelectedTreatmentId(available[0].id);
        isFirstRender.current = false;
      } else if (!selectedTreatmentId || !available.some(t => t.id === selectedTreatmentId)) {
        setSelectedTreatmentId(available[0].id);
      }
    } else {
      setSelectedTreatmentId(null);
    }
  }, [normalizedTratamentos, statusFilter, selectedTreatmentId]);

  // Synchronize Agenda filters with the selected Treatment Card
  useEffect(() => {
    if (selectedTreatmentId) {
      setFilterTratamento(selectedTreatmentId);
      // Auto-adjust familiar filter to match the selected treatment to avoid empty results
      const selT = normalizedTratamentos.find(t => t.id === selectedTreatmentId);
      if (selT) {
        setFilterFamiliar(selT.familiarId || 'proprio');
      }
    } else {
      setFilterTratamento('todos');
    }
  }, [selectedTreatmentId, normalizedTratamentos]);

  const selectedTreatment = useMemo(() => {
    return normalizedTratamentos.find(t => t.id === selectedTreatmentId) || null;
  }, [normalizedTratamentos, selectedTreatmentId]);

  // Load taken doses state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('taken_doses_log');
    if (saved) {
      try {
        setTakenDoses(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Filter treatments for the list (Ativos, Arquivados, Todos)
  const filteredTratamentos = useMemo(() => {
    return normalizedTratamentos.filter(t => {
      // Status filter
      if (statusFilter === 'ativos' && t.arquivado) return false;
      if (statusFilter === 'arquivados' && !t.arquivado) return false;

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nomeFam = getFamiliarName(t.familiarId).toLowerCase();
        const nomeTrat = (t.nomeTratamento || "").toLowerCase();
        const matchesMed = t.medicamentos.some(m => m.nomeMedicamento.toLowerCase().includes(query));
        
        if (!nomeFam.includes(query) && !nomeTrat.includes(query) && !matchesMed) {
          return false;
        }
      }

      return true;
    });
  }, [normalizedTratamentos, statusFilter, searchQuery, familiars]);

  // Handle temporary medication additions/edits
  const handleAddTempMed = () => {
    if (!medNome.trim() || !medDosagem.trim()) return;

    if (editingMedId) {
      setTempMedicamentos(prev => prev.map(m => m.id === editingMedId ? {
        ...m,
        nomeMedicamento: medNome,
        dosagem: medDosagem,
        intervaloHoras: medIntervalo,
        duracaoDias: medDias
      } : m));
      setEditingMedId(null);
    } else {
      const newMed: MedicamentoTratamento = {
        id: `temp_med_${Date.now()}`,
        nomeMedicamento: medNome,
        dosagem: medDosagem,
        intervaloHoras: medIntervalo,
        duracaoDias: medDias
      };
      setTempMedicamentos(prev => [...prev, newMed]);
    }

    setMedNome('');
    setMedDosagem('');
    setMedIntervalo(8);
    setMedDias(7);
  };

  const handleEditTempMed = (med: MedicamentoTratamento) => {
    setEditingMedId(med.id);
    setMedNome(med.nomeMedicamento);
    setMedDosagem(med.dosagem);
    setMedIntervalo(m => med.intervaloHoras);
    setMedDias(m => med.duracaoDias);
  };

  const handleRemoveTempMed = (id: string) => {
    setTempMedicamentos(prev => prev.filter(m => m.id !== id));
    if (editingMedId === id) {
      setEditingMedId(null);
      setMedNome('');
      setMedDosagem('');
    }
  };

  const handleFileAdd = (file: File) => {
    if (!file) return;
    
    // Check file size (e.g., max 4MB for localStorage comfort)
    if (file.size > 4 * 1024 * 1024) {
      alert("O arquivo é muito grande. O tamanho máximo permitido é 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        const newAttachment: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          data: base64
        };
        setTempAttachments(prev => [...prev, newAttachment]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save the complete treatment
  const handleSaveTreatment = () => {
    if (!nomeTratamento.trim() || tempMedicamentos.length === 0) return;

    if (editingTreatmentId) {
      // Edit existing
      const updated = normalizedTratamentos.map(t => t.id === editingTreatmentId ? {
        ...t,
        nomeTratamento: nomeTratamento.trim(),
        familiarId,
        dataInicio,
        horaInicio,
        sintomas,
        medicamentos: tempMedicamentos,
        attachments: tempAttachments
      } : t);
      onSaveTratamentos(updated);
      setEditingTreatmentId(null);
    } else {
      // Create new
      const newTreatment: Tratamento = {
        id: `trat_${Date.now()}`,
        ownerId: 'user_local',
        nomeTratamento: nomeTratamento.trim(),
        familiarId,
        dataInicio,
        horaInicio,
        sintomas,
        medicamentos: tempMedicamentos,
        attachments: tempAttachments
      };
      onSaveTratamentos([...normalizedTratamentos, newTreatment]);
    }

    // Reset Form
    setNomeTratamento('');
    setFamiliarId('proprio');
    setDataInicio(new Date().toISOString().split('T')[0]);
    setHoraInicio('06:00');
    setSintomas('');
    setTempMedicamentos([]);
    setTempAttachments([]);
    setIsFormOpen(false);
  };

  // Edit saved treatment - load into form
  const handleLoadEditTreatment = (t: Tratamento) => {
    setEditingTreatmentId(t.id);
    setNomeTratamento(t.nomeTratamento);
    setFamiliarId(t.familiarId || 'proprio');
    setDataInicio(t.dataInicio);
    setHoraInicio(t.horaInicio || '06:00');
    setSintomas(t.sintomas || '');
    setTempMedicamentos(t.medicamentos || []);
    setTempAttachments(t.attachments || []);
    setIsFormOpen(true);
  };

  const handleDeleteTreatment = (id: string) => {
    setTreatmentIdToDelete(id);
  };

  const handleConfirmDelete = () => {
    if (treatmentIdToDelete) {
      onSaveTratamentos(normalizedTratamentos.filter(t => t.id !== treatmentIdToDelete));
      if (editingTreatmentId === treatmentIdToDelete) {
        setEditingTreatmentId(null);
        setNomeTratamento('');
        setFamiliarId('proprio');
        setTempMedicamentos([]);
        setTempAttachments([]);
        setIsFormOpen(false);
      }
      if (selectedTreatmentId === treatmentIdToDelete) {
        // Encontrar outro tratamento para selecionar ou desmarcar
        const remaining = normalizedTratamentos.filter(t => t.id !== treatmentIdToDelete);
        if (remaining.length > 0) {
          setSelectedTreatmentId(remaining[0].id);
        } else {
          setSelectedTreatmentId(null);
        }
      }
      setTreatmentIdToDelete(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingTreatmentId(null);
    setNomeTratamento('');
    setFamiliarId('proprio');
    setDataInicio(new Date().toISOString().split('T')[0]);
    setHoraInicio('06:00');
    setSintomas('');
    setTempMedicamentos([]);
    setTempAttachments([]);
    setIsFormOpen(false);
  };

  // Toggle dose check state
  const handleToggleDose = (key: string) => {
    const updated = { ...takenDoses, [key]: !takenDoses[key] };
    setTakenDoses(updated);
    localStorage.setItem('taken_doses_log', JSON.stringify(updated));
  };

  // PDF Generation State and Function (Alternative B: Direct Vector Drawing with jsPDF + jspdf-autotable)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // 1. Initial configuration
      const pdf = new jsPDF('p', 'mm', 'a4');
      let currentY = 15;

      // Header and Footer decoration helper
      const drawHeaderFooter = (doc: jsPDF, pageNum: number) => {
        doc.saveGraphicsState();
        
        // Footer (A4: height is 297mm)
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Página ${pageNum}`, 195, 287, { align: 'right' });
        doc.text(`Agenda de Saúde - Gerado de forma inteligente para sua família`, 15, 287);
        
        // Top border line on subsequent pages
        if (pageNum > 1) {
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.3);
          doc.line(15, 12, 195, 12);
          
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text("CRONOGRAMA DE TRATAMENTO TEMPORÁRIO", 15, 9);
        }
        
        doc.restoreGraphicsState();
      };

      // 2. Title Banner (solid bar matching the visual attachment)
      pdf.setFillColor(109, 40, 217); // Purple-700 (#6d28d9)
      pdf.rect(15, currentY, 180, 11, 'F');
      
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text('CRONOGRAMA DE TRATAMENTO TEMPORÁRIO', 20, currentY + 7);
      currentY += 17;

      // 3. Metadata Layout Block (Divided into two clean columns)
      // Calculate period min/max and emission date
      const emissionStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      let familiarValue = 'Todos Pacientes';
      if (selectedTreatment) {
        familiarValue = getFamiliarName(selectedTreatment.familiarId);
      } else if (filterFamiliar !== 'todos') {
        familiarValue = getFamiliarName(filterFamiliar);
      }

      let durationValue = `${agendaData.sortedDates.length} dias`;
      if (selectedTreatment) {
        const maxDuration = Math.max(...selectedTreatment.medicamentos.map(m => m.duracaoDias), 0);
        durationValue = `${maxDuration} ${maxDuration === 1 ? 'dia' : 'dias'}`;
      }

      let periodValue = '-';
      if (agendaData.sortedDates.length > 0) {
        const minDateStr = agendaData.sortedDates[0].split('-').reverse().join('/');
        const maxDateStr = agendaData.sortedDates[agendaData.sortedDates.length - 1].split('-').reverse().join('/');
        periodValue = `${minDateStr} a ${maxDateStr}`;
      }

      // Column 1
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text('FAMILIAR:', 15, currentY);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.text(familiarValue.toUpperCase(), 42, currentY);

      pdf.setTextColor(100, 116, 139);
      pdf.text('PERÍODO:', 15, currentY + 6.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(periodValue, 42, currentY + 6.5);

      // Column 2
      pdf.setTextColor(100, 116, 139);
      pdf.text('DURAÇÃO GERAL:', 110, currentY);
      pdf.setTextColor(30, 41, 59);
      pdf.text(durationValue, 150, currentY);

      pdf.setTextColor(100, 116, 139);
      pdf.text('DATA DE EMISSÃO:', 110, currentY + 6.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(emissionStr, 150, currentY + 6.5);

      currentY += 16;

      // 4. "MEDICAMENTOS PROGRAMADOS" Section
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(109, 40, 217); // Purple-700
      pdf.text('MEDICAMENTOS PROGRAMADOS', 15, currentY);
      currentY += 4;

      // Compile active matching medicines list
      const activeMedicamentos: Array<{ nome: string; dosagem: string; intervalo: string; duracao: string }> = [];
      normalizedTratamentos.forEach(t => {
        if (t.arquivado) return;
        if (filterFamiliar !== 'todos' && t.familiarId !== filterFamiliar) return;
        if (filterTratamento !== 'todos' && t.id !== filterTratamento) return;
        
        t.medicamentos.forEach(m => {
          const alreadyExists = activeMedicamentos.some(x => x.nome === m.nomeMedicamento && x.dosagem === m.dosagem && x.intervalo.includes(`${m.intervaloHoras || 8}h`));
          if (!alreadyExists) {
            activeMedicamentos.push({
              nome: m.nomeMedicamento,
              dosagem: m.dosagem,
              intervalo: `De ${m.intervaloHoras || 8}h em ${m.intervaloHoras || 8}h (Primeira às ${t.horaInicio || '06:00'})`,
              duracao: `${m.duracaoDias} ${m.duracaoDias === 1 ? 'dia' : 'dias'}`
            });
          }
        });
      });

      autoTable(pdf, {
        startY: currentY,
        head: [['Medicamento', 'Dosagem / Posologia', 'Intervalo Calculado', 'Duração']],
        body: activeMedicamentos.map(med => [med.nome, med.dosagem, med.intervalo, med.duracao]),
        theme: 'grid',
        headStyles: {
          fillColor: [245, 243, 255], // Light purple background (#f5f3ff)
          textColor: [109, 40, 217], // Dark purple text (#6d28d9)
          font: 'helvetica',
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
        },
        bodyStyles: {
          font: 'helvetica',
          fontSize: 8,
          textColor: [51, 65, 85], // Slate-700
          cellPadding: 3,
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [30, 41, 59], cellWidth: 50 }, // Name
          1: { cellWidth: 35 }, // Dosagem
          2: { cellWidth: 70 }, // Intervalo
          3: { cellWidth: 25, halign: 'center' } // Duration
        },
        styles: {
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.25,
        },
        margin: { left: 15, right: 15 }
      });
      currentY = (pdf as any).lastAutoTable.finalY + 12;

      // 5. "ACOMPANHAMENTO DA POSOLOGIA DIÁRIA" Header
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(11.5);
      pdf.setTextColor(109, 40, 217); // Purple-700
      pdf.text('ACOMPANHAMENTO DA POSOLOGIA DIÁRIA', 15, currentY);

      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(147, 51, 234); // violet-600
      pdf.text('Gerado de forma inteligente para sua família', 195, currentY, { align: 'right' });
      currentY += 8;

      // 6. Chronological Days Cards Block
      agendaData.sortedDates.forEach(dateKey => {
        const dateInfo = agendaData.groupedByDate[dateKey];
        
        // Group doses by period
        const manhaDoses = dateInfo.doses.filter(d => d.period === 'Manhã');
        const tardeDoses = dateInfo.doses.filter(d => d.period === 'Tarde');
        const noiteDoses = dateInfo.doses.filter(d => d.period === 'Noite');

        // Estimate block height
        const getColHeight = (dosesCount: number) => {
          if (dosesCount === 0) return 15; // height for empty italic line
          return 15 + (dosesCount * 6.5); // header padding + row heights
        };

        const maxColHeight = Math.max(
          getColHeight(manhaDoses.length),
          getColHeight(tardeDoses.length),
          getColHeight(noiteDoses.length)
        );

        const totalDayHeight = 10 + maxColHeight + 8; // header + max col height + margin

        // Check page budget, add new page if necessary
        if (currentY + totalDayHeight > 275) {
          pdf.addPage();
          currentY = 20;
        }

        // Draw Day Badge & Header Info
        // 1. Pill badge: "Dia X"
        pdf.setFillColor(109, 40, 217); // Purple-700
        pdf.roundedRect(15, currentY, 18, 5.5, 1.2, 1.2, 'F');
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Dia ${dateInfo.dayIndex}`, 24, currentY + 3.8, { align: 'center' });

        // 2. Date Text: "DD/MM (weekday)"
        const friendly = formatFriendlyDate(dateKey);
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59); // slate-800
        pdf.text(`${friendly.day}`, 36, currentY + 4);
        
        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(148, 163, 184); // slate-400
        pdf.text(` (${friendly.weekday.toLowerCase()})`, 46, currentY + 4);

        // 3. Right-aligned Doses Count
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${dateInfo.doses.length} DOSE(S)`, 195, currentY + 4, { align: 'right' });
        
        currentY += 8;

        // Draw 3 Period Columns side-by-side
        // Columns parameters
        const colW = 57;
        const colGap = 4.5;
        const xCoords = [15, 15 + colW + colGap, 15 + (colW + colGap) * 2];

        // Background card outline for each period
        xCoords.forEach(x => {
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(226, 232, 240); // slate-200
          pdf.setLineWidth(0.25);
          pdf.roundedRect(x, currentY, colW, maxColHeight, 1.5, 1.5, 'FD');
        });

        // Helper to draw period content inside the outline
        const drawPeriodContent = (
          x: number,
          title: string,
          timeRange: string,
          indicatorColor: [number, number, number],
          doses: typeof dateInfo.doses
        ) => {
          pdf.saveGraphicsState();

          // Circle dot indicator
          pdf.setFillColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
          pdf.circle(x + 4, currentY + 3.5, 1, 'F');

          // Title Text (e.g. "MANHÃ")
          pdf.setFont('Helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(30, 41, 59);
          pdf.text(title, x + 7, currentY + 4.2);

          // Time Range (e.g. "(01:01 às 12:00)")
          pdf.setFont('Helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(148, 163, 184);
          pdf.text(timeRange, x + colW - 3, currentY + 4.2, { align: 'right' });

          // Header horizontal line divider
          pdf.setDrawColor(241, 245, 249);
          pdf.setLineWidth(0.25);
          pdf.line(x, currentY + 6.5, x + colW, currentY + 6.5);

          // Render dose items table or empty placeholder state
          if (doses.length === 0) {
            pdf.setFont('Helvetica', 'italic');
            pdf.setFontSize(7.5);
            pdf.setTextColor(148, 163, 184);
            pdf.text('Sem doses neste período', x + colW / 2, currentY + 11.5, { align: 'center' });
          } else {
            // Mini Header Row: Hora | Fami. | Med.
            pdf.setFillColor(71, 85, 105); // slate-600/700
            pdf.rect(x + 1.5, currentY + 8, colW - 3, 4, 'F');

            pdf.setFont('Helvetica', 'bold');
            pdf.setFontSize(6);
            pdf.setTextColor(255, 255, 255);
            pdf.text('Hora', x + 2.5, currentY + 11);
            pdf.text('Fami.', x + 9.5, currentY + 11);
            pdf.text('Med.', x + 21, currentY + 11);
            pdf.text('✓', x + colW - 4.5, currentY + 11);

            // Render Row Items
            doses.forEach((d, idx) => {
              const rowY = currentY + 12.2 + (idx * 6);

              // Alternating stripe backgrounds
              if (idx % 2 === 1) {
                pdf.setFillColor(248, 250, 252);
                pdf.rect(x + 1.5, rowY, colW - 3, 5.5, 'F');
              }

              // Divider lines between rows
              pdf.setDrawColor(241, 245, 249);
              pdf.line(x + 1.5, rowY + 5.5, x + colW - 1.5, rowY + 5.5);

              // Value: Hora (bold)
              pdf.setFont('Helvetica', 'bold');
              pdf.setFontSize(6.5);
              pdf.setTextColor(30, 41, 59);
              pdf.text(d.time, x + 2.5, rowY + 3.8);

              // Value: Familiar Name (shortened)
              pdf.setFont('Helvetica', 'normal');
              pdf.setFontSize(6);
              pdf.setTextColor(71, 85, 105);
              const famFirst = d.familiarName.split(' ')[0];
              pdf.text(famFirst, x + 9.5, rowY + 3.8);

              // Value: Medicine (truncated carefully)
              const maxL = 15;
              const truncatedMed = d.medName.length > maxL ? d.medName.substring(0, maxL) + '..' : d.medName;
              pdf.text(truncatedMed, x + 21, rowY + 3.8);

              // Status checkmark box
              const isTaken = takenDoses[d.key] || false;
              if (isTaken) {
                pdf.setFont('Helvetica', 'bold');
                pdf.setFontSize(7.5);
                pdf.setTextColor(16, 185, 129); // emerald-500
                pdf.text('✓', x + colW - 4.5, rowY + 4);
              } else {
                pdf.setDrawColor(148, 163, 184); // slate-400
                pdf.setLineWidth(0.2);
                pdf.rect(x + colW - 4.5, rowY + 1.5, 2.5, 2.5, 'S');
              }
            });
          }

          pdf.restoreGraphicsState();
        };

        // Draw Column Contents matching period specifications
        drawPeriodContent(xCoords[0], 'MANHÃ', '(01:01 às 12:00)', [245, 158, 11], manhaDoses);  // Amber-500
        drawPeriodContent(xCoords[1], 'TARDE', '(12:01 às 19:00)', [249, 115, 22], tardeDoses);  // Orange-500
        drawPeriodContent(xCoords[2], 'NOITE', '(19:01 às 01:00)', [99, 102, 241], noiteDoses);  // Indigo-500

        currentY += maxColHeight + 8;
      });

      // 7. Apply page stamps (Header, Footer, Page Counts) through all generated pages
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        drawHeaderFooter(pdf, p);
      }

      // 8. Trigger local download & preview
      const filename = `agenda-tratamento-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      
      try {
        const blobUrl = pdf.output('bloburl');
        window.open(blobUrl, '_blank');
      } catch (e) {
        console.warn('O navegador bloqueou a abertura automática do PDF em nova guia, mas o download foi concluído.', e);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Não foi possível gerar o relatório em PDF. Por favor, tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Compute schedule of doses grouped by Day index and Date
  const agendaData = useMemo(() => {
    // We group by "YYYY-MM-DD" which corresponds to actual calendar dates
    const groupedByDate: Record<string, {
      dateStr: string;
      dayIndex: number;
      doses: {
        key: string;
        time: string;
        medName: string;
        dosagem: string;
        treatmentName: string;
        familiarName: string;
        period: 'Manhã' | 'Tarde' | 'Noite';
      }[];
    }> = {};

    const getPeriod = (hora: string): 'Manhã' | 'Tarde' | 'Noite' => {
      const h = parseInt(hora.split(':')[0]);
      if (h >= 6 && h < 12) return 'Manhã';
      if (h >= 12 && h < 18) return 'Tarde';
      return 'Noite';
    };

    normalizedTratamentos.forEach(t => {
      // Filter by active/archived status based on statusFilter
      if (statusFilter === 'ativos' && t.arquivado) return;
      if (statusFilter === 'arquivados' && !t.arquivado) return;

      // Filter by selection
      if (filterFamiliar !== 'todos' && t.familiarId !== filterFamiliar) return;
      if (filterTratamento !== 'todos' && t.id !== filterTratamento) return;

      const start = new Date(t.dataInicio + 'T00:00:00');

      t.medicamentos.forEach(m => {
        const interval = m.intervaloHoras || 8;
        const dosesPerDay = Math.floor(24 / interval);
        const totalDoses = dosesPerDay * m.duracaoDias;

        const [startYear, startMonth, startDay] = t.dataInicio.split('-').map(Number);
        const [startH, startM] = (t.horaInicio || '06:00').split(':').map(Number);

        // Generate exactly totalDoses sequentially
        const currentDate = new Date(startYear, startMonth - 1, startDay, startH, startM, 0, 0);

        for (let i = 0; i < totalDoses; i++) {
          const yyyy = currentDate.getFullYear();
          const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
          const dd = String(currentDate.getDate()).padStart(2, '0');
          const dateKey = `${yyyy}-${mm}-${dd}`;

          const hora = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;
          const period = getPeriod(hora);

          const doseKey = `dose_${t.id}_${m.id}_${dateKey}_${hora}`;

          // Day relative to this treatment's start
          const startNoTime = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
          const currentNoTime = new Date(yyyy, currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
          const diffTime = Math.abs(currentNoTime.getTime() - startNoTime.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          const dayIndex = diffDays + 1;

          if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = {
              dateStr: dateKey,
              dayIndex: dayIndex,
              doses: []
            };
          }

          groupedByDate[dateKey].doses.push({
            key: doseKey,
            time: hora,
            medName: m.nomeMedicamento,
            dosagem: m.dosagem,
            treatmentName: t.nomeTratamento,
            familiarName: getFamiliarName(t.familiarId),
            period
          });

          // Advance to the next scheduled dose slot
          currentDate.setHours(currentDate.getHours() + interval);
        }
      });
    });

    // Sort doses within each date by time
    Object.keys(groupedByDate).forEach(dateKey => {
      groupedByDate[dateKey].doses.sort((a, b) => a.time.localeCompare(b.time));
    });

    const sortedDates = Object.keys(groupedByDate).sort();
    return { groupedByDate, sortedDates };
  }, [normalizedTratamentos, filterFamiliar, filterTratamento, familiars, statusFilter]);

  // Format dates beautifully
  const formatFriendlyDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    return { day, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
  };

  const toggleDayCollapse = (dateStr: string) => {
    setExpandedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const allDaysExpanded = useMemo(() => {
    if (agendaData.sortedDates.length === 0) return false;
    return agendaData.sortedDates.every(dateKey => {
      const dateInfo = agendaData.groupedByDate[dateKey];
      if (!dateInfo) return false;
      const isDayFinished = dateInfo.doses.length > 0 && dateInfo.doses.every(d => takenDoses[d.key]);
      const isCollapsed = expandedDays[dateKey] ?? isDayFinished;
      return !isCollapsed;
    });
  }, [agendaData, expandedDays, takenDoses]);

  const handleToggleExpandAll = () => {
    const nextState: Record<string, boolean> = {};
    const targetCollapsedValue = allDaysExpanded; // if all are expanded, collapse them all
    agendaData.sortedDates.forEach(dateKey => {
      nextState[dateKey] = targetCollapsedValue;
    });
    setExpandedDays(nextState);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 text-left overflow-hidden">
      {/* Header da Tela */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3 w-full md:w-[400px] shrink-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <Pill className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans">Agenda de Tratamentos Pontuais</h1>
            <p className="text-xs text-slate-500 mt-1">Cadastre os medicamentos de um tratamento pontual</p>
          </div>
        </div>

        <div className="flex-1 flex justify-start w-full lg:w-auto lg:ml-2">
          <PinnedItemsHeader pinnedItems={pinnedItems} onDropItem={onDropItem} onNavigateToTab={onNavigateToTab} activeTab="pontual" />
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              handleCancelEdit(); // clean form states
              setIsFormOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all w-full sm:w-auto justify-center cursor-pointer whitespace-nowrap h-10"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Tratamento</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6">
      {/* Main Grid: Live Dashboard, Existing Treatments and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle side: Detailed view + Agenda de Doses */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Detailed Treatment View (Moved above Agenda) */}
          {selectedTreatment && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-500" />
                  Detalhes do Tratamento Selecionado
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedTreatment.arquivado 
                    ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  {selectedTreatment.arquivado ? 'Arquivado' : 'Ativo'}
                </span>
              </div>

              <div className="space-y-5">
                {/* Basic Header Info */}
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <FolderHeart className="w-5 h-5 text-indigo-500" />
                    {selectedTreatment.nomeTratamento}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Paciente: <strong className="text-slate-700">{getFamiliarName(selectedTreatment.familiarId)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4 text-slate-400" />
                      <span>Data de Início: <strong className="text-slate-700">{selectedTreatment.dataInicio.split('-').reverse().join('/')}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Horário de Início: <strong className="text-slate-700">{selectedTreatment.horaInicio || '06:00'}</strong></span>
                    </div>
                    {selectedTreatment.sintomas && (
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-slate-400" />
                        <span>Sintomas: <strong className="text-slate-700 italic">{selectedTreatment.sintomas}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Medications List */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Medicamentos & Horários Planejados:
                  </p>
                  <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3 font-semibold text-slate-500">Medicamento</th>
                          <th className="px-4 py-3 font-semibold text-slate-500">Dosagem</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-center">Duração</th>
                          <th className="px-4 py-3 font-semibold text-slate-500">Horários Previstos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {selectedTreatment.medicamentos?.map((med, i) => {
                          const interval = med.intervaloHoras || 8;
                          const dosesPerDay = Math.floor(24 / interval);
                          const [startH, startM] = (selectedTreatment.horaInicio || '06:00').split(':').map(Number);
                          // Calculate individual hours
                          const hours = Array.from({ length: dosesPerDay }, (_, idx) => {
                            const h = (startH + idx * interval) % 24;
                            return `${h.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
                          });

                          return (
                            <tr key={med.id || i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3.5 font-semibold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <Pill className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  {med.nomeMedicamento}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-slate-600">
                                {med.dosagem}
                              </td>
                              <td className="px-4 py-3.5 text-center font-medium text-slate-600 whitespace-nowrap">
                                {med.duracaoDias} {med.duracaoDias === 1 ? 'dia' : 'dias'}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex flex-wrap gap-1">
                                  {hours.map((hr, idx) => (
                                    <span key={idx} className="bg-slate-50 border border-slate-200/80 text-slate-600 font-bold text-[10px] px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1 shrink-0">
                                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                                      {hr}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Receitas Médicas Anexadas */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                    Receitas Médicas Anexadas:
                  </p>

                  {!selectedTreatment.attachments || selectedTreatment.attachments.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Nenhuma receita médica anexada a este tratamento.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedTreatment.attachments.map(att => {
                        const isImg = att.type.startsWith('image/');
                        return (
                          <div key={att.id} className="bg-slate-50/60 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 flex items-center justify-between gap-3 text-xs shadow-2xs transition-all">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isImg ? (
                                <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                              )}
                              <span className="font-bold text-slate-700 truncate" title={att.name}>{att.name}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              {isImg && (
                                <button
                                  onClick={() => setLightboxAttachment(att)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200/60 shadow-2xs transition-all"
                                  title="Visualizar Receita"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <a
                                href={att.data}
                                download={att.name}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200/60 shadow-2xs transition-all"
                                title="Baixar Receita"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Contextual Quick Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadEditTreatment(selectedTreatment);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleArchiveTreatment(selectedTreatment.id);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    >
                      {selectedTreatment.arquivado ? (
                        <>
                          <ArchiveRestore className="w-3.5 h-3.5 text-indigo-500" />
                          Reativar
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5 text-slate-500" />
                          Arquivar
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTreatment(selectedTreatment.id);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100/80 text-rose-600 rounded-xl text-xs font-bold transition-colors border border-rose-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Tratamento
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50/80 p-5 md:p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-600"/> 
                Agenda Cronológica de Doses
              </h3>
              
              {/* Agenda Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleExpandAll}
                  disabled={agendaData.sortedDates.length === 0}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 active:scale-95 disabled:active:scale-100 disabled:opacity-50 text-slate-600 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center gap-1 font-semibold text-xs border border-slate-200/60 shadow-sm cursor-pointer"
                  title={allDaysExpanded ? "Recolher todos os dias" : "Expandir todos os dias"}
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                  <span>{allDaysExpanded ? "Recolher Tudo" : "Expandir Tudo"}</span>
                </button>

                <button
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPDF || agendaData.sortedDates.length === 0}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1 font-semibold text-xs border border-indigo-200/30 shadow-sm"
                  title="Salvar e Visualizar PDF"
                >
                  {isGeneratingPDF ? (
                    <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {agendaData.sortedDates.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 p-8 rounded-2xl text-center space-y-2">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">Nenhuma dose programada</p>
                <p className="text-xs text-slate-400">Cadastre um tratamento acima ou altere os filtros.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agendaData.sortedDates.map(dateKey => {
                  const dateInfo = agendaData.groupedByDate[dateKey];
                  const friendlyDate = formatFriendlyDate(dateKey);
                  
                  // Auto-collapse if all doses are checked, unless user manually toggled
                  const isDayFinished = dateInfo.doses.length > 0 && dateInfo.doses.every(d => takenDoses[d.key]);
                  const isCollapsed = expandedDays[dateKey] ?? isDayFinished;

                  const morningDoses = dateInfo.doses.filter(d => d.period === 'Manhã');
                  const afternoonDoses = dateInfo.doses.filter(d => d.period === 'Tarde');
                  const eveningDoses = dateInfo.doses.filter(d => d.period === 'Noite');

                  return (
                    <div key={dateKey} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden transition-all">
                      
                      {/* Day Header */}
                      <div 
                        onClick={() => toggleDayCollapse(dateKey)}
                        className={`px-5 py-3 flex items-center justify-between cursor-pointer border-b border-slate-100 select-none transition-colors ${
                          isDayFinished ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : 'bg-slate-50/70 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`${isDayFinished ? 'bg-emerald-600' : 'bg-indigo-600'} text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors`}>
                            Dia {dateInfo.dayIndex}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">
                            {friendlyDate.day}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            ({friendlyDate.weekday})
                          </span>
                          {isDayFinished && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-full uppercase tracking-tight">
                              <Check className="w-3 h-3" /> Concluído
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                          <span>{dateInfo.doses.length} DOSE(S)</span>
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Day Content (Divided exactly like print) */}
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                              
                              {/* MANHÃ (06:00 - 12:00) */}
                              <div className="space-y-4 pb-4 md:pb-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <span>🌅</span> MANHÃ
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-semibold">(06:00 às 12:00)</span>
                                </div>
                                
                                <div className="space-y-2">
                                  {morningDoses.length > 0 ? (
                                    morningDoses.map(dose => (
                                      <div 
                                        key={dose.key}
                                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                                          takenDoses[dose.key] 
                                            ? 'bg-emerald-50/50 border-emerald-100 shadow-2xs' 
                                            : 'bg-white border-slate-100 hover:border-slate-200'
                                        }`}
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`${takenDoses[dose.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'} text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors`}>
                                              {dose.time}
                                            </span>
                                            <span className={`${takenDoses[dose.key] ? 'text-emerald-600' : 'text-indigo-500'} text-[9px] font-bold uppercase tracking-wide transition-colors`}>
                                              {dose.treatmentName}
                                            </span>
                                          </div>
                                          <p className={`font-bold text-xs transition-colors ${takenDoses[dose.key] ? 'text-emerald-900' : 'text-slate-800'}`}>{dose.medName}</p>
                                          <p className={`text-[10px] transition-colors ${takenDoses[dose.key] ? 'text-emerald-600/80' : 'text-slate-500'}`}>Dose: {dose.dosagem}</p>
                                          <p className={`text-[9px] flex items-center gap-1 transition-colors ${takenDoses[dose.key] ? 'text-emerald-500/60' : 'text-slate-400'}`}>
                                            <User className="w-2.5 h-2.5" /> {dose.familiarName}
                                          </p>
                                        </div>
                                        
                                        <input 
                                          type="checkbox" 
                                          checked={takenDoses[dose.key] || false}
                                          onChange={() => handleToggleDose(dose.key)}
                                          className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                                        />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                      <p className="text-[10px] text-slate-400 font-medium">Sem doses</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* TARDE (12:00 - 18:00) */}
                              <div className="space-y-4 pt-4 md:pt-0 md:pl-6 pb-4 md:pb-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <span>☀️</span> TARDE
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-semibold">(12:00 às 18:00)</span>
                                </div>
                                
                                <div className="space-y-2">
                                  {afternoonDoses.length > 0 ? (
                                    afternoonDoses.map(dose => (
                                      <div 
                                        key={dose.key}
                                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                                          takenDoses[dose.key] 
                                            ? 'bg-emerald-50/50 border-emerald-100 shadow-2xs' 
                                            : 'bg-white border-slate-100 hover:border-slate-200'
                                        }`}
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`${takenDoses[dose.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'} text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors`}>
                                              {dose.time}
                                            </span>
                                            <span className={`${takenDoses[dose.key] ? 'text-emerald-600' : 'text-indigo-500'} text-[9px] font-bold uppercase tracking-wide transition-colors`}>
                                              {dose.treatmentName}
                                            </span>
                                          </div>
                                          <p className={`font-bold text-xs transition-colors ${takenDoses[dose.key] ? 'text-emerald-900' : 'text-slate-800'}`}>{dose.medName}</p>
                                          <p className={`text-[10px] transition-colors ${takenDoses[dose.key] ? 'text-emerald-600/80' : 'text-slate-500'}`}>Dose: {dose.dosagem}</p>
                                          <p className={`text-[9px] flex items-center gap-1 transition-colors ${takenDoses[dose.key] ? 'text-emerald-500/60' : 'text-slate-400'}`}>
                                            <User className="w-2.5 h-2.5" /> {dose.familiarName}
                                          </p>
                                        </div>
                                        
                                        <input 
                                          type="checkbox" 
                                          checked={takenDoses[dose.key] || false}
                                          onChange={() => handleToggleDose(dose.key)}
                                          className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                                        />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                      <p className="text-[10px] text-slate-400 font-medium">Sem doses</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* NOITE (18:00 - 06:00) */}
                              <div className="space-y-4 pt-4 md:pt-0 md:pl-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <span>🌙</span> NOITE
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-semibold">(18:00 às 06:00)</span>
                                </div>
                                
                                <div className="space-y-2">
                                  {eveningDoses.length > 0 ? (
                                    eveningDoses.map(dose => (
                                      <div 
                                        key={dose.key}
                                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                                          takenDoses[dose.key] 
                                            ? 'bg-emerald-50/50 border-emerald-100 shadow-2xs' 
                                            : 'bg-white border-slate-100 hover:border-slate-200'
                                        }`}
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`${takenDoses[dose.key] ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'} text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors`}>
                                              {dose.time}
                                            </span>
                                            <span className={`${takenDoses[dose.key] ? 'text-emerald-600' : 'text-indigo-500'} text-[9px] font-bold uppercase tracking-wide transition-colors`}>
                                              {dose.treatmentName}
                                            </span>
                                          </div>
                                          <p className={`font-bold text-xs transition-colors ${takenDoses[dose.key] ? 'text-emerald-900' : 'text-slate-800'}`}>{dose.medName}</p>
                                          <p className={`text-[10px] transition-colors ${takenDoses[dose.key] ? 'text-emerald-600/80' : 'text-slate-500'}`}>Dose: {dose.dosagem}</p>
                                          <p className={`text-[9px] flex items-center gap-1 transition-colors ${takenDoses[dose.key] ? 'text-emerald-500/60' : 'text-slate-400'}`}>
                                            <User className="w-2.5 h-2.5" /> {dose.familiarName}
                                          </p>
                                        </div>
                                        
                                        <input 
                                          type="checkbox" 
                                          checked={takenDoses[dose.key] || false}
                                          onChange={() => handleToggleDose(dose.key)}
                                          className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                                        />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                      <p className="text-[10px] text-slate-400 font-medium">Sem doses</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>


                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right side: List of active saved treatments */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                Tratamentos ({normalizedTratamentos.length})
              </h3>
            </div>

            {/* Status tabs/buttons filter */}
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button 
                onClick={() => setStatusFilter('ativos')} 
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === 'ativos' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ativos
              </button>
              <button 
                onClick={() => setStatusFilter('arquivados')} 
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === 'arquivados' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Arquivados
              </button>
            </div>
            
            <div className="space-y-3">
              {filteredTratamentos.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum tratamento {statusFilter === 'ativos' ? 'ativo' : statusFilter === 'arquivados' ? 'arquivado' : ''} encontrado.
                </div>
              ) : (
                filteredTratamentos.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setSelectedTreatmentId(t.id)}
                    className={`p-3.5 rounded-xl border transition-all text-xs space-y-2 relative overflow-hidden cursor-pointer ${
                      selectedTreatmentId === t.id 
                        ? 'border-indigo-600 bg-indigo-50/15 ring-2 ring-indigo-500/10 shadow-sm' 
                        : t.arquivado
                          ? 'border-slate-100 bg-slate-50/50 opacity-75'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/30 bg-white shadow-2xs'
                    }`}
                  >
                    {t.arquivado && (
                      <span className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-bl">
                        Arquivado
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          {t.nomeTratamento}
                        </h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          Paciente: {getFamiliarName(t.familiarId)}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <CalendarIcon className="w-3 h-3 text-slate-400" />
                          Início: {t.dataInicio.split('-').reverse().join('/')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Archive / Restore Button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArchiveTreatment(t.id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            t.arquivado 
                              ? 'text-indigo-600 hover:bg-indigo-50' 
                              : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                          }`}
                          title={t.arquivado ? "Reativar tratamento" : "Arquivar tratamento"}
                        >
                          {t.arquivado ? (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadEditTreatment(t);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar tratamento"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTreatment(t.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir tratamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100/80 pt-2 space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Medicamentos vinculados:
                      </p>
                      <div className="space-y-1">
                        {t.medicamentos?.map((med, i) => (
                          <div key={med.id || i} className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded">
                            <span className="font-semibold">{med.nomeMedicamento}</span>
                            <span className="text-slate-500 text-[10px]">
                              {med.dosagem} (c/{med.intervaloHoras}h por {med.duracaoDias} dias)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Elemento oculto renderizado especialmente para exportação de PDF de alta fidelidade */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '820px' }}>
        <div id="agenda-pdf-printable" style={{ padding: '32px', backgroundColor: '#ffffff', color: '#1e293b', fontFamily: 'sans-serif', minHeight: '100%' }}>
          
          {/* PDF Header */}
          <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '16px', display: 'flex', justifyContent: 'between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1e1b4b', margin: 0, letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💊 AGENDA DE MEDICAMENTOS & DOSES
              </h1>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, margin: '4px 0 0 0' }}>
                Relatório gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
              </p>
            </div>
            <div style={{ textAlignment: 'right', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
              <p style={{ fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Agenda de Saúde</p>
              <p style={{ margin: '2px 0 0 0' }}>Controle de Doses Diárias</p>
            </div>
          </div>

          {/* Active filters summary */}
          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', fontSize: '12px', marginBottom: '24px' }}>
            <div>
              <span style={{ fontWeight: 'bold', color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '2px' }}>Paciente Filtrado:</span>
              <span style={{ color: '#1e293b', fontWeight: 'semibold' }}>
                {filterFamiliar === 'todos' ? 'Todos os Pacientes' : getFamiliarName(filterFamiliar)}
              </span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold', color: '#64748b', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '2px' }}>Tratamento Filtrado:</span>
              <span style={{ color: '#1e293b', fontWeight: 'semibold' }}>
                {filterTratamento === 'todos' ? 'Todos os Tratamentos Ativos' : normalizedTratamentos.find(t => t.id === filterTratamento)?.nomeTratamento || 'Tratamento'}
              </span>
            </div>
          </div>

          {/* Agenda Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {agendaData.sortedDates.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>Nenhuma dose programada para exibir no relatório.</p>
            ) : (
              agendaData.sortedDates.map(dateKey => {
                const dateInfo = agendaData.groupedByDate[dateKey];
                const friendlyDate = formatFriendlyDate(dateKey);
                const morningDoses = dateInfo.doses.filter(d => d.period === 'Manhã');
                const afternoonDoses = dateInfo.doses.filter(d => d.period === 'Tarde');
                const eveningDoses = dateInfo.doses.filter(d => d.period === 'Noite');

                return (
                  <div key={dateKey} style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                    {/* Day Header */}
                    <div style={{ backgroundColor: '#f1f5f9', paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px', borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ backgroundColor: '#4f46e5', color: '#ffffff', fontSize: '12px', fontWeight: 'bold', paddingLeft: '8px', paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px', borderRadius: '4px' }}>
                          Dia {dateInfo.dayIndex}
                        </span>
                        <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12px', marginLeft: '8px' }}>
                          {friendlyDate.day} - {friendlyDate.weekday}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>
                        {dateInfo.doses.length} dose(s) programada(s)
                      </span>
                    </div>

                    {/* Day Columns */}
                    <div style={{ padding: '16px', display: 'flex', gap: '16px' }}>
                      {/* Manhã */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🌅 MANHÃ <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'normal' }}>(06h - 12h)</span>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {morningDoses.length > 0 ? (
                            morningDoses.map(dose => (
                              <div key={dose.key} style={{ padding: '8px', borderRadius: '8px', border: takenDoses[dose.key] ? '1px solid #a7f3d0' : '1px solid #e2e8f0', backgroundColor: takenDoses[dose.key] ? '#ecfdf5' : '#ffffff', fontSize: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                                  <span style={{ fontWeight: 900, color: '#4338ca' }}>{dose.time}</span>
                                  <span style={{ paddingLeft: '4px', paddingRight: '4px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: takenDoses[dose.key] ? '#d1fae5' : '#f1f5f9', color: takenDoses[dose.key] ? '#065f46' : '#64748b' }}>
                                    {takenDoses[dose.key] ? 'Tomado' : 'Pendente'}
                                  </span>
                                </div>
                                <p style={{ fontWeight: 'bold', color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word', margin: '4px 0 2px 0', lineHeight: '1.4', paddingBottom: '2px' }}>{dose.medName}</p>
                                <p style={{ color: '#64748b', fontSize: '9px', margin: 0 }}>{dose.dosagem} • {dose.familiarName}</p>
                              </div>
                            ))
                          ) : (
                            <p style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0', margin: 0 }}>Sem doses</p>
                          )}
                        </div>
                      </div>

                      {/* Tarde */}
                      <div style={{ flex: 1, minWidth: 0, paddingLeft: '12px', borderLeft: '1px solid #f1f5f9' }}>
                        <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ☀️ TARDE <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'normal' }}>(12h - 18h)</span>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {afternoonDoses.length > 0 ? (
                            afternoonDoses.map(dose => (
                              <div key={dose.key} style={{ padding: '8px', borderRadius: '8px', border: takenDoses[dose.key] ? '1px solid #a7f3d0' : '1px solid #e2e8f0', backgroundColor: takenDoses[dose.key] ? '#ecfdf5' : '#ffffff', fontSize: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                                  <span style={{ fontWeight: 900, color: '#4338ca' }}>{dose.time}</span>
                                  <span style={{ paddingLeft: '4px', paddingRight: '4px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: takenDoses[dose.key] ? '#d1fae5' : '#f1f5f9', color: takenDoses[dose.key] ? '#065f46' : '#64748b' }}>
                                    {takenDoses[dose.key] ? 'Tomado' : 'Pendente'}
                                  </span>
                                </div>
                                <p style={{ fontWeight: 'bold', color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word', margin: '4px 0 2px 0', lineHeight: '1.4', paddingBottom: '2px' }}>{dose.medName}</p>
                                <p style={{ color: '#64748b', fontSize: '9px', margin: 0 }}>{dose.dosagem} • {dose.familiarName}</p>
                              </div>
                            ))
                          ) : (
                            <p style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0', margin: 0 }}>Sem doses</p>
                          )}
                        </div>
                      </div>

                      {/* Noite */}
                      <div style={{ flex: 1, minWidth: 0, paddingLeft: '12px', borderLeft: '1px solid #f1f5f9' }}>
                        <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🌙 NOITE <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'normal' }}>(18h - 06h)</span>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {eveningDoses.length > 0 ? (
                            eveningDoses.map(dose => (
                              <div key={dose.key} style={{ padding: '8px', borderRadius: '8px', border: takenDoses[dose.key] ? '1px solid #a7f3d0' : '1px solid #e2e8f0', backgroundColor: takenDoses[dose.key] ? '#ecfdf5' : '#ffffff', fontSize: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                                  <span style={{ fontWeight: 900, color: '#4338ca' }}>{dose.time}</span>
                                  <span style={{ paddingLeft: '4px', paddingRight: '4px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: takenDoses[dose.key] ? '#d1fae5' : '#f1f5f9', color: takenDoses[dose.key] ? '#065f46' : '#64748b' }}>
                                    {takenDoses[dose.key] ? 'Tomado' : 'Pendente'}
                                  </span>
                                </div>
                                <p style={{ fontWeight: 'bold', color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word', margin: '4px 0 2px 0', lineHeight: '1.4', paddingBottom: '2px' }}>{dose.medName}</p>
                                <p style={{ color: '#64748b', fontSize: '9px', margin: 0 }}>{dose.dosagem} • {dose.familiarName}</p>
                              </div>
                            ))
                          ) : (
                            <p style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '8px 0', margin: 0 }}>Sem doses</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer info */}
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '24px' }}>
            <p style={{ margin: 0 }}>Gerado pelo aplicativo Agenda de Saúde de forma segura e offline.</p>
            <p style={{ fontWeight: 'semibold', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>Mantenha sua saúde sempre em dia!</p>
          </div>

        </div>
      </div>
      </div>

      {/* Modal para Adicionar / Editar Tratamento */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelEdit}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Container for Centering */}
            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.4 }}
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <FolderHeart className="w-5 h-5 text-indigo-500" />
                    {editingTreatmentId ? 'Editar Tratamento' : 'Cadastrar Novo Tratamento'}
                  </h3>
                  <button 
                    onClick={handleCancelEdit}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Content */}
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6 text-left">
                  {/* Treatment metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome do Tratamento</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Pós-Operatório, Gripe" 
                        value={nomeTratamento} 
                        onChange={(e) => setNomeTratamento(e.target.value)} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" 
                      />
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Familiar Vinculado</label>
                      <select 
                        value={familiarId} 
                        onChange={(e) => setFamiliarId(e.target.value)} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="proprio">Próprio Usuário (Mim)</option>
                        {familiars.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data de Início</label>
                      <input 
                        type="date" 
                        value={dataInicio} 
                        onChange={(e) => setDataInicio(e.target.value)} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" 
                      />
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Horário de Início</label>
                      <input 
                        type="time" 
                        value={horaInicio} 
                        onChange={(e) => setHoraInicio(e.target.value)} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" 
                      />
                    </div>

                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sintomas Sendo Tratados</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Tosse, Febre, Dor no corpo" 
                        value={sintomas} 
                        onChange={(e) => setSintomas(e.target.value)} 
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" 
                      />
                    </div>
                  </div>

                  {/* Inner sub-form to add medicines inside this treatment */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-indigo-500" />
                      {editingMedId ? 'Editar Medicamento no Tratamento' : 'Adicionar Medicamento ao Tratamento'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4 flex flex-col space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Medicamento</label>
                        <input 
                          type="text" 
                          placeholder="Nome" 
                          value={medNome} 
                          onChange={(e) => setMedNome(e.target.value)} 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Dosagem</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 1 cp, 10ml" 
                          value={medDosagem} 
                          onChange={(e) => setMedDosagem(e.target.value)} 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Intervalo (h)</label>
                        <select 
                          value={medIntervalo} 
                          onChange={(e) => setMedIntervalo(Number(e.target.value))} 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                        >
                          <option value={24}>24/24 h (uma vez ao dia)</option>
                          <option value={12}>12/12 h (duas vezes ao dia)</option>
                          <option value={8}>8/8 h (três vezes ao dia)</option>
                          <option value={6}>6/6 h (quatro vezes ao dia)</option>
                          <option value={4}>4/4 h (seis vezes ao dia)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2 flex flex-col space-y-1">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Duração (Dias)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 7" 
                          value={medDias} 
                          onChange={(e) => setMedDias(Number(e.target.value))} 
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={handleAddTempMed}
                        className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-900 transition-all shadow-sm"
                      >
                        {editingMedId ? 'Atualizar Item' : 'Inserir na Lista'}
                      </button>
                    </div>

                    {/* Temporary Medicines list within this treatment being built */}
                    {tempMedicamentos.length > 0 && (
                      <div className="border-t border-slate-200/60 pt-3 mt-2 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Medicamentos Incluídos neste Tratamento:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {tempMedicamentos.map(m => (
                            <div key={m.id} className="bg-white p-3 rounded-xl border border-slate-200/50 flex items-center justify-between text-xs shadow-sm">
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-800">{m.nomeMedicamento}</p>
                                <p className="text-[10px] text-slate-500">
                                  Dose: {m.dosagem} • De {m.intervaloHoras}h em {m.intervaloHoras}h • Por {m.duracaoDias} dias
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => handleEditTempMed(m)}
                                  className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleRemoveTempMed(m.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Seção de Anexos / Receita Médica */}
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Receita Médica (Anexar Imagem ou PDF)
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Area de Drag & Drop / Selecionador */}
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            handleFileAdd(files[0]);
                          }
                        }}
                        className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/30 hover:bg-indigo-50/5 transition-all group min-h-[110px]"
                        onClick={() => {
                          const input = document.getElementById('treatment-recipe-upload');
                          if (input) input.click();
                        }}
                      >
                        <input 
                          type="file" 
                          id="treatment-recipe-upload" 
                          className="hidden" 
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              handleFileAdd(files[0]);
                            }
                          }}
                        />
                        <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        <div className="text-center">
                          <p className="text-[11px] font-bold text-slate-700">Arraste ou clique para anexar</p>
                          <p className="text-[9px] text-slate-400">Suporta imagens (PNG, JPG) ou PDFs de até 4MB</p>
                        </div>
                      </div>

                      {/* Lista de Arquivos Anexados Temporários */}
                      <div className="border border-slate-100 rounded-2xl p-3 bg-slate-50/40 space-y-2 min-h-[110px] flex flex-col justify-start">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Receitas Selecionadas ({tempAttachments.length})
                        </span>

                        {tempAttachments.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
                            <span className="text-[10px] text-slate-400 italic">Nenhuma receita anexada ainda</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5 overflow-y-auto max-h-[120px] pr-1">
                            {tempAttachments.map(att => (
                              <div key={att.id} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200/50 shadow-2xs text-[11px]">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {att.type.startsWith('image/') ? (
                                    <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                  )}
                                  <span className="font-semibold text-slate-700 truncate">{att.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setTempAttachments(prev => prev.filter(a => a.id !== att.id))}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-rose-500 hover:text-rose-700 transition-colors"
                                  title="Remover receita"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                  <button 
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveTreatment}
                    disabled={!nomeTratamento.trim() || tempMedicamentos.length === 0}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    {editingTreatmentId ? 'Salvar Alterações' : 'Salvar Tratamento'}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
        {/* Custom Delete Confirmation Modal */}
        {treatmentIdToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-rose-600">
                  <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Excluir Tratamento</h3>
                    <p className="text-xs text-slate-500">Esta ação não pode ser desfeita.</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza de que deseja excluir o tratamento <strong className="text-slate-800">
                    {normalizedTratamentos.find(t => t.id === treatmentIdToDelete)?.nomeTratamento}
                  </strong>? Todas as doses e planejamentos vinculados serão removidos permanentemente.
                </p>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => setTreatmentIdToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Lightbox Image Preview Modal */}
        {lightboxAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 text-slate-800">
                  <ImageIcon className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-xs truncate max-w-[220px] sm:max-w-md">{lightboxAttachment.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={lightboxAttachment.data}
                    download={lightboxAttachment.name}
                    className="p-1.5 hover:bg-slate-100 text-indigo-600 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Baixar</span>
                  </a>
                  <button
                    onClick={() => setLightboxAttachment(null)}
                    className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-900/5 flex items-center justify-center max-h-[70vh] overflow-auto">
                <img
                  src={lightboxAttachment.data}
                  alt={lightboxAttachment.name}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
