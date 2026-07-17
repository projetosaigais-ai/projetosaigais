import React from 'react';
import { 
  Stethoscope, 
  Pill, 
  CalendarIcon, 
  LayoutDashboard, 
  User 
} from 'lucide-react';

interface PinnedItemsHeaderProps {
  pinnedItems: string[];
  onDropItem: (item: string) => void;
  onNavigateToTab: (tab: string) => void;
  activeTab?: string;
}

export function PinnedItemsHeader({ pinnedItems, onDropItem, onNavigateToTab, activeTab }: PinnedItemsHeaderProps) {
  const safePinnedItems = pinnedItems || [];

  const isActive = (item: string) => {
    if (!activeTab) return false;
    switch (item) {
      case 'Painel': return activeTab === 'dashboard';
      case 'Procedimentos': return activeTab === 'procedures';
      case 'Medicamentos': return activeTab === 'medicamentos' || activeTab === 'controle';
      case 'Agenda': return activeTab === 'calendar';
      case 'Cadastros': return activeTab === 'registrations';
      default: return false;
    }
  };

  return (
    <div 
      className="flex items-center gap-2 min-h-[40px] bg-slate-50 p-1.5 rounded-xl border border-dashed border-slate-300 w-fit max-w-lg"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const item = e.dataTransfer.getData("text");
        onDropItem(item);
      }}
    >
      {safePinnedItems.length === 0 && <span className="text-xs text-slate-400 px-4">Arraste itens aqui</span>}
      {safePinnedItems.map(item => {
        const active = isActive(item);
        return (
          <div 
            key={item} 
            className={`p-1.5 rounded-lg shadow-sm border scale-100 cursor-pointer transition-all ${
              active 
                ? 'bg-[#edf5fd] border-blue-200 text-[#45556c]' 
                : 'bg-white border-slate-100 hover:bg-slate-50'
            }`}
            onClick={() => {
              switch (item) {
                case 'Painel': onNavigateToTab('dashboard'); break;
                case 'Procedimentos': onNavigateToTab('procedures'); break;
                case 'Medicamentos': onNavigateToTab('medicamentos'); break;
                case 'Agenda': onNavigateToTab('calendar'); break;
                case 'Cadastros': onNavigateToTab('registrations'); break;
              }
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text", item);
              e.dataTransfer.effectAllowed = 'move';
            }}
          >
            {item === 'Procedimentos' && <Stethoscope className="w-5 h-5 text-indigo-600" />}
            {item === 'Medicamentos' && <Pill className="w-5 h-5 text-amber-600" />}
            {item === 'Agenda' && <CalendarIcon className="w-5 h-5 text-emerald-600" />}
            {item === 'Painel' && <LayoutDashboard className="w-5 h-5 text-sky-600" />}
            {item === 'Cadastros' && <User className="w-5 h-5 text-rose-600" />}
          </div>
        );
      })}
    </div>
  );
}
