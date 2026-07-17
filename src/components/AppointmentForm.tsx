import { useState, useEffect, FormEvent } from 'react';
import { Appointment } from '../types';
import { X, Calendar, Clock, MapPin, User, Tag, HelpCircle, Check, Trash2, AlertTriangle, FileText } from 'lucide-react';

interface AppointmentFormProps {
  appointment?: Appointment | null; // If passed, we are editing; else creating
  initialDate?: string;
  onSave: (app: Omit<Appointment, 'id'> & { id?: string }) => Promise<any>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

const COMMON_SPECIALTIES = [
  'Clínico Geral',
  'Cardiologia',
  'Dentista',
  'Dermatologia',
  'Ginecologia',
  'Ortopedia',
  'Oftalmologia',
  'Pediatria',
  'Psicologia',
  'Exame Laboratorial',
  'Fisioterapia',
  'Outro'
];

export default function AppointmentForm({
  appointment,
  initialDate,
  onSave,
  onDelete,
  onClose,
}: AppointmentFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Appointment['type']>('consulta');
  const [specialty, setSpecialty] = useState('Clínico Geral');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Appointment['status']>('scheduled');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  useEffect(() => {
    if (appointment) {
      setTitle(appointment.title);
      setType(appointment.type);
      if (COMMON_SPECIALTIES.includes(appointment.specialty)) {
        setSpecialty(appointment.specialty);
        setCustomSpecialty('');
      } else {
        setSpecialty('Outro');
        setCustomSpecialty(appointment.specialty);
      }
      setDoctorName(appointment.doctorName || '');
      setClinicName(appointment.clinicName || '');
      setDate(appointment.date);
      setStartTime(appointment.startTime);
      setEndTime(appointment.endTime);
      setNotes(appointment.notes || '');
      setStatus(appointment.status);
    } else {
      setTitle('');
      setType('consulta');
      setSpecialty('Clínico Geral');
      setCustomSpecialty('');
      setDoctorName('');
      setClinicName('');
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setStartTime('09:00');
      setEndTime('10:00');
      setNotes('');
      setStatus('scheduled');
    }
  }, [appointment, initialDate]);

  // Adjust end time when start time changes to default to 1 hour
  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const [hours, minutes] = val.split(':').map(Number);
    const endHours = (hours + 1) % 24;
    const endVal = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setEndTime(endVal);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // If we are editing, display a confirmation modal first before modifying external calendar data
    if (appointment) {
      setShowEditConfirm(true);
    } else {
      await saveAction();
    }
  };

  const saveAction = async () => {
    setIsSubmitting(true);
    try {
      const finalSpecialty = specialty === 'Outro' ? customSpecialty || 'Outro' : specialty;
      
      await onSave({
        ...(appointment && { id: appointment.id }),
        title,
        type,
        specialty: finalSpecialty,
        doctorName: doctorName.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        date,
        startTime,
        endTime,
        notes: notes.trim() || undefined,
        status,
      });
      onClose();
    } catch (err) {
      console.error('Error saving appointment:', err);
    } finally {
      setIsSubmitting(false);
      setShowEditConfirm(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment || !onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(appointment.id);
      onClose();
    } catch (err) {
      console.error('Error deleting appointment:', err);
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div id="form_overlay" className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div id="form_container" className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden flex flex-col relative max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 font-sans">
                {appointment ? 'Editar Compromisso' : 'Novo Compromisso'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {appointment ? 'sincronizado com google agenda' : 'cadastrar consulta ou exame'}
              </p>
            </div>
          </div>
          <button
            id="close_form_btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
              Título do Compromisso *
            </label>
            <input
              id="input_title"
              type="text"
              required
              placeholder="Ex: Consulta Anual, Exame de Sangue, Dentista"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 font-sans"
            />
          </div>

          {/* Type Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 font-sans">
              Tipo
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['consulta', 'exame', 'retorno', 'outros'] as Appointment['type'][]).map((t) => (
                <button
                  key={t}
                  type="button"
                  id={`btn_type_${t}`}
                  onClick={() => setType(t)}
                  className={`py-2 text-xs font-medium rounded-xl border capitalize transition-all cursor-pointer ${
                    type === t
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t === 'consulta' ? 'Consulta' : t === 'exame' ? 'Exame' : t === 'retorno' ? 'Retorno' : 'Outros'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Specialty */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
                Especialidade
              </label>
              <select
                id="select_specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:border-blue-500 outline-none transition-all cursor-pointer font-sans"
              >
                {COMMON_SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
                Status
              </label>
              <select
                id="select_status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Appointment['status'])}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:border-blue-500 outline-none transition-all cursor-pointer font-sans"
              >
                <option value="scheduled">Agendado</option>
                <option value="completed">Realizado</option>
                <option value="canceled">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Custom Specialty input if "Outro" is selected */}
          {specialty === 'Outro' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
                Escreva a Especialidade
              </label>
              <input
                id="input_custom_specialty"
                type="text"
                required
                placeholder="Ex: Endocrinologia, Nutricionista"
                value={customSpecialty}
                onChange={(e) => setCustomSpecialty(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 font-sans"
              />
            </div>
          )}

          {/* Doctor Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
              Profissional de Saúde / Médico(a)
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                id="input_doctor"
                type="text"
                placeholder="Ex: Dr. Carlos Eduardo, Dra. Marina"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-sans"
              />
            </div>
          </div>

          {/* Clinic Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
              Clínica / Hospital / Laboratório
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                id="input_clinic"
                type="text"
                placeholder="Ex: Centro Médico Barra, Labs Sabin"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-sans"
              />
            </div>
          </div>

          {/* Date and Time Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
                Data *
              </label>
              <div className="relative">
                <input
                  id="input_date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all font-sans cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
                Início *
              </label>
              <input
                id="input_start_time"
                type="time"
                required
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all font-mono cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
                Fim *
              </label>
              <input
                id="input_end_time"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all font-mono cursor-pointer"
              />
            </div>
          </div>

          {/* Notes / Preparations */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 font-sans">
              Observações / Instruções de Preparo
            </label>
            <textarea
              id="input_notes"
              rows={3}
              placeholder="Ex: Jejum de 8h, trazer exames anteriores, receita, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 resize-none font-sans"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {appointment && onDelete ? (
              <button
                id="trigger_delete_btn"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                id="cancel_form_btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="submit_form_btn"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm shadow-blue-600/10 hover:shadow-blue-600/20 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar no Calendar'}
              </button>
            </div>
          </div>
        </form>

        {/* Edit Confirmation Dialog */}
        {showEditConfirm && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl max-w-sm w-full text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-800 mb-1 font-sans">Sincronizar alteração?</h4>
              <p className="text-xs text-slate-500 mb-5 font-sans">
                Esta ação atualizará o evento correspondente em sua conta do Google Agenda de forma bidirecional.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  id="cancel_edit_confirm_btn"
                  type="button"
                  onClick={() => setShowEditConfirm(false)}
                  className="px-4 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  id="confirm_edit_btn"
                  type="button"
                  onClick={saveAction}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Confirmar e Enviar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl max-w-sm w-full text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-800 mb-1 font-sans">Remover Compromisso?</h4>
              <p className="text-xs text-slate-500 mb-5 font-sans">
                Você tem certeza que deseja excluir o compromisso <strong>{title}</strong>? Ele também será removido permanentemente do seu Google Agenda.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  id="cancel_delete_confirm_btn"
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="confirm_delete_btn"
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Excluir Permanente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
