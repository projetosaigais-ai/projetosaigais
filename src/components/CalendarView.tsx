import { useState } from 'react';
import { Appointment } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, MapPin, User as UserIcon, Tag, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PinnedItemsHeader } from './PinnedItemsHeader';

interface CalendarViewProps {
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  onAddAppointmentOnDate: (date: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  pinnedItems?: string[];
  onDropItem?: (item: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export default function CalendarView({
  appointments,
  onSelectAppointment,
  onAddAppointmentOnDate,
  onRefresh,
  isRefreshing,
  pinnedItems = [],
  onDropItem = () => {},
  onNavigateToTab = () => {},
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Get first day of the month
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Get total days in the month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Generate calendar days
  const calendarDays = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    const dateStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({
      day: d,
      isCurrentMonth: false,
      dateString: dateStr,
      date: new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d)
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      dateString: dateStr,
      date: new Date(year, month, d)
    });
  }

  // Next month padding days
  const remainingCells = 42 - calendarDays.length; // 6 rows of 7 days
  for (let d = 1; d <= remainingCells; d++) {
    const dateStr = `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({
      day: d,
      isCurrentMonth: false,
      dateString: dateStr,
      date: new Date(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, d)
    });
  }

  // Get appointments for a specific date (YYYY-MM-DD)
  const getAppointmentsForDate = (dateStr: string) => {
    return appointments.filter((app) => app.date === dateStr);
  };

  const formattedSelectedDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const selectedDateAppointments = getAppointmentsForDate(formattedSelectedDate);

  // Helper to format text representation of types
  const getTypeBadge = (type: Appointment['type']) => {
    switch (type) {
      case 'consulta':
        return { text: 'Consulta', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'exame':
        return { text: 'Exame', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'retorno':
        return { text: 'Retorno', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { text: 'Outros', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'scheduled':
        return { text: 'Agendado', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'completed':
        return { text: 'Realizado', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'canceled':
        return { text: 'Cancelado', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
  };

  const getColorClasses = (colorName: string = 'slate') => {
    return {
      bg: 'bg-emerald-500',
      text: 'text-emerald-800',
      border: 'border-emerald-200/80',
      lightBg: 'bg-[#effcf9]',
      dot: 'bg-emerald-500'
    };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 overflow-hidden">
      {/* Header da Tela */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3 w-full md:w-[400px] shrink-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans">Agenda Integrada</h1>
            <p className="text-xs text-slate-500 mt-1">Sincronize os procedimentos com Google Agenda</p>
          </div>
        </div>
        
        <div className="flex-1 flex justify-start w-full lg:w-auto lg:ml-2">
          <PinnedItemsHeader pinnedItems={pinnedItems} onDropItem={onDropItem} onNavigateToTab={onNavigateToTab} activeTab="calendar" />
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              id="sync_now_btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto h-10"
              title="Sincronizar compromissos com o Google Agenda"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6">
      <div id="calendar_wrapper" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Monthly Calendar Grid */}
      <div id="calendar_grid_panel" className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h2 id="current_month_title" className="text-xl font-semibold text-slate-800 font-sans tracking-tight">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-slate-400 font-mono">calendário integrado</p>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-xl">
              <button
                id="prev_month_btn"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                id="today_btn"
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 rounded-lg hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
              >
                Hoje
              </button>
              <button
                id="next_month_btn"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {daysOfWeek.map((day, idx) => (
            <div
              key={idx}
              className={`text-xs font-medium font-sans py-2 ${
                idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid Body */}
        <div id="calendar_days_grid" className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell, idx) => {
            const dayAppointments = getAppointmentsForDate(cell.dateString);
            const isToday = new Date().toDateString() === cell.date.toDateString();
            const isSelected = selectedDate.toDateString() === cell.date.toDateString();

            return (
              <button
                key={idx}
                id={`cell_${cell.dateString}`}
                onClick={() => setSelectedDate(cell.date)}
                className={`min-h-[72px] p-1.5 rounded-xl border flex flex-col items-start justify-between transition-all group relative cursor-pointer ${
                  cell.isCurrentMonth
                    ? 'bg-white border-slate-50 hover:border-blue-100 hover:bg-blue-50/10'
                    : 'bg-slate-50/50 border-transparent text-slate-300'
                } ${
                  isSelected
                    ? '!border-blue-500 ring-2 ring-blue-500/10 !bg-blue-50/20'
                    : ''
                }`}
              >
                <div className="w-full flex justify-between items-center mb-1">
                  <span
                    className={`text-sm font-semibold h-6 w-6 flex items-center justify-center rounded-full font-mono ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                        : cell.isCurrentMonth
                        ? isSelected ? 'text-blue-700 font-bold' : 'text-slate-700'
                        : 'text-slate-300'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {/* Icon indicator to schedule */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>

                {/* Day Appointment Indicator Badges */}
                <div className="w-full space-y-0.5 mt-auto">
                  {dayAppointments.slice(0, 2).map((app) => {
                    const colors = getColorClasses(app.color);
                    return (
                      <div
                        key={app.id}
                        className={`text-[10px] truncate px-1.5 py-0.5 rounded-md font-sans border flex items-center gap-1 ${colors.lightBg} ${colors.border} ${colors.text}`}
                        title={`${app.title} - ${app.startTime}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.bg}`} />
                        <span className="truncate font-medium">{app.title}</span>
                      </div>
                    );
                  })}
                  {dayAppointments.length > 2 && (
                    <div className="text-[9px] text-center font-bold text-slate-400 font-sans">
                      + {dayAppointments.length - 2} mais
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Side panel */}
      <div id="agenda_details_panel" className="lg:col-span-5 flex flex-col">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center space-x-2.5">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-slate-800 font-sans">
                  {selectedDate.toLocaleDateString('pt-BR', {
                    day: 'numeric',
                    month: 'long',
                    weekday: 'short',
                  })}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedDateAppointments.length === 1 
                    ? '1 compromisso' 
                    : `${selectedDateAppointments.length} compromissos`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-3.5">
            <AnimatePresence mode="popLayout">
              {selectedDateAppointments.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center py-12 px-4"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-3 border border-dashed border-slate-200">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">Sem compromissos hoje</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                    Nenhuma consulta ou exame agendado para esta data.
                  </p>
                </motion.div>
              ) : (
                selectedDateAppointments.map((app) => {
                  const colors = getColorClasses(app.color);
                  const typeBadge = getTypeBadge(app.type);
                  const statusBadge = getStatusBadge(app.status);

                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      id={`appointment_item_${app.id}`}
                      onClick={() => onSelectAppointment(app)}
                      className={`p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 hover:shadow-sm transition-all cursor-pointer flex flex-col relative overflow-hidden group`}
                    >
                      {/* Left accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colors.bg}`} />

                      <div className="flex justify-between items-start mb-2 pl-1">
                        <div className="flex flex-col">
                          <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                            {app.title}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {app.startTime} - {app.endTime}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${typeBadge.bg}`}>
                            {typeBadge.text}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusBadge.bg}`}>
                            {statusBadge.text}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pl-1">
                        {app.doctorName && (
                          <div className="flex items-center text-xs text-slate-500 font-sans gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{app.doctorName}</span>
                          </div>
                        )}
                        {app.clinicName && (
                          <div className="flex items-center text-xs text-slate-500 font-sans gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{app.clinicName}</span>
                          </div>
                        )}
                        {app.specialty && (
                          <div className="flex items-center text-xs text-slate-500 font-sans gap-2">
                            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{app.specialty}</span>
                          </div>
                        )}
                      </div>

                      {app.notes && (
                        <div className="mt-3.5 pt-3 border-t border-slate-50 text-xs text-slate-400 font-sans pl-1 italic line-clamp-2">
                          {app.notes}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
