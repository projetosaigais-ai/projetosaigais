export interface Appointment {
  id: string; // Will correspond to Google Calendar event ID
  title: string;
  type: 'consulta' | 'exame' | 'retorno' | 'outros';
  specialty: string;
  doctorName?: string;
  clinicName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  notes?: string;
  status: 'scheduled' | 'completed' | 'canceled';
  googleEventId?: string;
  color?: string; // e.g., 'emerald', 'teal', 'blue', 'purple', 'rose'
  allDay?: boolean;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
}

export interface HealthCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  timeZone?: string;
}

export interface ProcedureHistoryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  providerName?: string;
  notes?: string;
}

export interface ProcedureStep {
  id: string;
  title: string; // e.g., "Consulta", "Exame", "Re-consulta"
  targetDate: string; // YYYY-MM-DD
  completed: boolean;
  scheduled?: boolean;
  appointmentId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  allDay?: boolean;
}

export interface Procedure {
  id: string;
  name: string; // e.g. "Consulta", "Exame", "Re-consulta"
  category?: string; // e.g. "Dentista", "Checkup", "Vacinas", "Medicamento", "Tratamento"
  providerId?: string; // Reference to HealthProvider
  providerName: string; // Doctor or Clinic (fallback/denormalized)
  familiarId?: string; // Reference to Familiar
  familiarName?: string; // Family member name (fallback/denormalized)
  frequencyValue: number;
  frequencyUnit: 'days' | 'weeks' | 'months' | 'years';
  lastDate?: string; // YYYY-MM-DD (Last execution date)
  nextDate?: string; // YYYY-MM-DD (Next execution date)
  history?: ProcedureHistoryEntry[];
  status?: string;
  steps?: ProcedureStep[];
  manualNextDate?: boolean;
  isEmProcesso?: boolean;
  nextDateInstructions?: string;
  specificity?: string;
}

export interface HealthProvider {
  id: string;
  name: string; // Dr. John Doe, Clinic XYZ
  specialty?: string; // Cardiology, Pediatrics, etc.
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
}

export interface ProcedureType {
  id: string;
  name: string; // "Consulta de Rotina", "Exame de Sangue", etc.
  description?: string;
  defaultFrequencyValue?: number;
  defaultFrequencyUnit?: 'days' | 'weeks' | 'months' | 'years';
  isGeneric?: boolean;
}

export interface Familiar {
  id: string;
  name: string; // Name of the family member
  phone?: string;
  email?: string;
  birthDate?: string; // YYYY-MM-DD
  color?: string; // Color identifier for custom identification
}

export interface MedicamentoTratamento {
  id: string;
  nomeMedicamento: string;
  dosagem: string;
  intervaloHoras: number; // Posologia: de tanto em tanto tempo (ex: 8 para 8/8h)
  duracaoDias: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string; // e.g. 'image/*', 'application/pdf'
  data: string; // Base64 representation of file
}

export interface Tratamento {
  id: string;
  ownerId: string;
  nomeTratamento: string; // Nome do tratamento, ex: "Tratamento de Garganta"
  dataInicio: string; // YYYY-MM-DD
  horaInicio?: string; // Horário de início do tratamento (HH:MM)
  sintomas?: string; // Sintomas a serem tratados
  familiarId?: string; // Opcional: Paciente vinculado
  medicamentos: MedicamentoTratamento[];
  arquivado?: boolean; // Propriedade para arquivar tratamentos
  attachments?: Attachment[];
}

export interface Medicamento {
  id: string;                  // ID único gerado pelo Firestore
  pessoaId: string;            // ID do familiar vinculado (Paciente)
  nome: string;                // Nome do medicamento (ex: Dipirona)
  principioAtivo?: string;     // Princípio ativo opcional (ex: Metamizol)
  dosagem?: string;            // Concentração (ex: 500mg, 10ml)
  quantidadeAtual: number;     // Estoque físico atual na prateleira
  estoqueMinimo: number;       // Ponto crítico (se quantidadeAtual < estoqueMinimo -> Comprar)
  posologia?: string;          // Observações de uso ou prescrição geral
  
  // Lógica de horários e períodos
  vezesAoDia?: number;         // Frequência: 1 a 4 (diário), 5 (mensal), 6 (eventual/manual)
  doseManha?: string;          // Quantidade ou dose do período matutino
  doseMeioDia?: string;        // Quantidade ou dose do período do almoço
  doseTarde?: string;          // Quantidade ou dose do período vespertino
  doseNoite?: string;          // Quantidade ou dose do período noturno
  
  // Controle operacional e auditoria
  ownerId: string;             // ID do usuário criador (isolamento de contas)
  dataAlteracaoEstoque?: string; // Última data em que o estoque foi recalculado (formato YYYY-MM-DD)
  ultimoEmailEnviadoEm?: string; // Data do último e-mail de alerta de estoque crítico (YYYY-MM-DD)
  lastProcessedDate?: string;   // Data do último processamento de decremento diário (YYYY-MM-DD)
}

export interface ProcedureCategory {
  id: string;
  name: string;
}



