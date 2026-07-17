import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Edit3, CheckSquare, Square, Pin, Sparkles, Filter, Copy, ChevronDown, MessageSquare, CornerDownRight, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DevImprovement {
  id: string;
  title: string;
  description: string;
  category: 'ui' | 'bug' | 'feature' | 'improvement';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  completed: boolean;
  completedAt?: string;
  createdAtMs?: number;
}

interface DevNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DevNotesModal({ isOpen, onClose }: DevNotesModalProps) {
  const [improvements, setImprovements] = useState<DevImprovement[]>(() => {
    const saved = localStorage.getItem('dev_app_improvements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing dev notes', e);
      }
    }
    // Seed initial demo data for a nice out-of-the-box experience if offline/empty
    return [
      {
        id: '1',
        title: 'Refatorar fluxo de agendamento na agenda integrada',
        description: 'Melhorar a sincronização automática com o Google Calendar para evitar concorrência.',
        category: 'improvement',
        priority: 'high',
        createdAt: new Date().toLocaleDateString('pt-BR'),
        completed: false,
        createdAtMs: Date.now() - 1000
      },
      {
        id: '2',
        title: 'Ajustar contraste do tema escuro das faturas',
        description: 'Algumas cores de texto estão com contraste baixo em telas menores.',
        category: 'ui',
        priority: 'medium',
        createdAt: new Date().toLocaleDateString('pt-BR'),
        completed: false,
        createdAtMs: Date.now()
      }
    ] as DevImprovement[];
  });

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // Added state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'ui' | 'bug' | 'feature' | 'improvement'>('improvement');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'ui' | 'bug' | 'feature' | 'improvement'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Position for floating/dragging window
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const dragHeaderRef = useRef<HTMLDivElement>(null);

  // Sync with Firestore in real-time
  useEffect(() => {
    try {
      const colRef = collection(db, 'dev_improvements');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const items: DevImprovement[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...docSnap.data()
          } as DevImprovement);
        });

        // Sort: newest first (using createdAtMs)
        items.sort((a, b) => {
          const tA = a.createdAtMs || 0;
          const tB = b.createdAtMs || 0;
          return tB - tA;
        });

        setImprovements(items);
        localStorage.setItem('dev_app_improvements', JSON.stringify(items));
      }, (error) => {
        console.error("Firestore sync error, using localStorage fallback:", error);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to connect to Firestore:", err);
    }
  }, []);

  // Set initial position to center/right
  useEffect(() => {
    if (isOpen) {
      const initialX = window.innerWidth - 460;
      const initialY = 120;
      setPosition({ 
        x: Math.max(20, initialX), 
        y: Math.max(20, initialY) 
      });
    }
  }, [isOpen]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    // Avoid dragging when clicking buttons in header
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    setDragging(true);
    setRel({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      // Constrain inside bounds
      const nextX = Math.min(Math.max(0, e.clientX - rel.x), window.innerWidth - 100);
      const nextY = Math.min(Math.max(0, e.clientY - rel.y), window.innerHeight - 50);
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, rel]);

  if (!isOpen) return null;

  // Add or Edit note in Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (editingId) {
        const docRef = doc(db, 'dev_improvements', editingId);
        await updateDoc(docRef, {
          title: title.trim(),
          description: description.trim(),
          category,
          priority
        });
        setEditingId(null);
      } else {
        const id = crypto.randomUUID();
        const newItem = {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          createdAt: new Date().toLocaleDateString('pt-BR'),
          createdAtMs: Date.now(),
          completed: false
        };
        await setDoc(doc(db, 'dev_improvements', id), newItem);
      }

      // Reset Form
      setTitle('');
      setDescription('');
      setCategory('improvement');
      setPriority('medium');
      setIsAdding(false);
    } catch (err) {
      console.error("Erro ao salvar no Firestore:", err);
      alert("Não foi possível salvar no Firestore. Verifique a conexão.");
    }
  };

  const startEdit = (item: DevImprovement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category);
    setPriority(item.priority);
    setIsAdding(true);
  };

  const toggleCompleted = async (id: string) => {
    const item = improvements.find(i => i.id === id);
    if (!item) return;

    try {
      const docRef = doc(db, 'dev_improvements', id);
      await updateDoc(docRef, {
        completed: !item.completed,
        completedAt: !item.completed ? new Date().toLocaleDateString('pt-BR') : null
      });
    } catch (err) {
      console.error("Erro ao atualizar status no Firestore:", err);
      alert("Erro ao atualizar status. Tente novamente.");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'dev_improvements', id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Erro ao excluir do Firestore:", err);
      alert("Erro ao excluir. Verifique o console ou tente novamente.");
    }
  };

  // Copy to clipboard in Markdown format
  const handleCopyToClipboard = () => {
    let text = `## 📋 Notas de Melhorias & Desenvolvimento - ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    const pending = improvements.filter(i => !i.completed);
    const completed = improvements.filter(i => i.completed);

    text += `### ⏳ Pendentes (${pending.length})\n`;
    if (pending.length === 0) text += '_Nenhuma melhoria pendente._\n';
    pending.forEach(i => {
      const p = i.priority === 'high' ? '🔴 ALTA' : i.priority === 'medium' ? '🟡 MÉDIA' : '🟢 BAIXA';
      const cat = i.category === 'bug' ? '🐛 Bug' : i.category === 'ui' ? '🎨 UI/UX' : i.category === 'feature' ? '✨ Recurso' : '⚙️ Melhoria';
      text += `- [ ] **${i.title}** [${cat}] (Prioridade: ${p}) - _Criado em: ${i.createdAt}_\n`;
      if (i.description) text += `  > ${i.description}\n`;
    });

    text += `\n### ⭘ Concluídos (${completed.length})\n`;
    if (completed.length === 0) text += '_Nenhuma melhoria concluída ainda._\n';
    completed.forEach(i => {
      const cat = i.category === 'bug' ? '🐛 Bug' : i.category === 'ui' ? '🎨 UI/UX' : i.category === 'feature' ? '✨ Recurso' : '⚙️ Melhoria';
      text += `- [x] ~~${i.title}~~ [${cat}] - _Concluído em: ${i.completedAt || i.createdAt}_\n`;
      if (i.description) text += `  > ${i.description}\n`;
    });

    navigator.clipboard.writeText(text);
    alert('Relatório de melhorias copiado para a área de transferência no formato Markdown!');
  };

  // Filter & Search Logic
  const filteredImprovements = improvements.filter(item => {
    const matchesStatus = 
      filterStatus === 'all' ? true : 
      filterStatus === 'completed' ? item.completed : !item.completed;
    
    const matchesPriority = filterPriority === 'all' ? true : item.priority === filterPriority;
    const matchesCategory = filterCategory === 'all' ? true : item.category === filterCategory;
    
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesPriority && matchesCategory && matchesSearch;
  });

  const getPriorityBadge = (p: 'low' | 'medium' | 'high') => {
    switch (p) {
      case 'high': return <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-rose-100 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Alta</span>;
      case 'medium': return <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-amber-100">Média</span>;
      case 'low': return <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-emerald-100">Baixa</span>;
    }
  };

  const getCategoryBadge = (c: 'ui' | 'bug' | 'feature' | 'improvement') => {
    switch (c) {
      case 'bug': return <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[9px] font-medium border border-red-200">🐛 Bug</span>;
      case 'ui': return <span className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded text-[9px] font-medium border border-violet-200">🎨 UI/UX</span>;
      case 'feature': return <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[9px] font-medium border border-indigo-200">✨ Feature</span>;
      case 'improvement': return <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium border border-slate-200">⚙️ Melhoria</span>;
    }
  };

  return (
    <>
      {/* Minimized floating button when minimized */}
      {isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-[9999] bg-slate-900 text-white rounded-full p-3.5 shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-semibold text-xs animate-bounce cursor-pointer border border-slate-700"
          title="Abrir Painel de Melhorias"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Anotações Dev ({improvements.filter(i => !i.completed).length})</span>
        </button>
      )}

      {/* Main Draggable Floating Window */}
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '420px',
          maxHeight: '80vh',
          display: isMinimized ? 'none' : 'flex',
          flexDirection: 'column',
        }}
        className="z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 font-sans"
      >
        {/* Title Bar / Drag Handle */}
        <div
          ref={dragHeaderRef}
          onMouseDown={handleMouseDown}
          className={`px-4 py-3 bg-slate-900 text-white flex items-center justify-between select-none cursor-move transition-colors ${dragging ? 'bg-slate-800' : ''}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-amber-500 text-slate-900">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-xs">Painel de Melhorias (Ambiente Dev)</h3>
              <p className="text-[9px] text-slate-300 font-medium">Arraste para mover • Apenas visível para você</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] font-bold px-2"
              title="Minimizar janela"
            >
              Minimizar
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-rose-600 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Window Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh] bg-slate-50">
          {isAdding ? (
            /* ADD / EDIT FORM */
            <form onSubmit={handleSubmit} className="bg-white p-3 rounded-xl border border-slate-200 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {editingId ? '✏️ Editar Anotação' : '✨ Nova Melhoria/Sugestão'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setTitle('');
                    setDescription('');
                  }}
                  className="text-slate-400 hover:text-slate-600 text-[10px] font-semibold"
                >
                  Cancelar
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Título da Melhoria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Melhorar design do botão de exclusão..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Descrição / Detalhes</label>
                <textarea
                  rows={3}
                  placeholder="Detalhes sobre a melhoria ou etapas para implementação..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                  >
                    <option value="improvement">⚙️ Melhoria</option>
                    <option value="ui">🎨 UI/UX</option>
                    <option value="bug">🐛 Bug / Correção</option>
                    <option value="feature">✨ Recurso Novo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Prioridade</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                  >
                    <option value="low">🟢 Baixa</option>
                    <option value="medium">🟡 Média</option>
                    <option value="high">🔴 Alta</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs py-2 rounded-lg font-bold transition-all mt-2 cursor-pointer shadow-sm shadow-slate-900/10"
              >
                {editingId ? 'Salvar Alterações' : 'Cadastrar Melhoria'}
              </button>
            </form>
          ) : (
            /* SEARCH, FILTER & ACTIONS BAR */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setIsAdding(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-amber-500/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Anotação</span>
                </button>

                <button
                  onClick={handleCopyToClipboard}
                  className="bg-white hover:bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
                  title="Copiar todas no formato Markdown"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Relatório</span>
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5 shadow-sm">
                <input
                  type="text"
                  placeholder="Pesquisar notas..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />

                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase block mb-0.5">Status</span>
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value as any)}
                      className="w-full px-1.5 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none"
                    >
                      <option value="pending">⏳ Pendentes</option>
                      <option value="completed">✓ Concluídos</option>
                      <option value="all">👁 Ver Todos</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold uppercase block mb-0.5">Prioridade</span>
                    <select
                      value={filterPriority}
                      onChange={e => setFilterPriority(e.target.value as any)}
                      className="w-full px-1.5 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none"
                    >
                      <option value="all">Ver Todas</option>
                      <option value="high">Alta</option>
                      <option value="medium">Média</option>
                      <option value="low">Baixa</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold uppercase block mb-0.5">Categoria</span>
                    <select
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value as any)}
                      className="w-full px-1.5 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none"
                    >
                      <option value="all">Ver Todas</option>
                      <option value="bug">Bug</option>
                      <option value="ui">UI/UX</option>
                      <option value="feature">Feature</option>
                      <option value="improvement">Melhoria</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTES LIST */}
          {!isAdding && (
            <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
              {filteredImprovements.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 space-y-1">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">Nenhuma anotação encontrada</p>
                  <p className="text-[10px]">Experimente mudar os filtros ou criar uma nota.</p>
                </div>
              ) : (
                filteredImprovements.map(item => (
                  <div
                    key={item.id}
                    className={`bg-white p-3 rounded-xl border transition-all flex flex-col justify-between shadow-sm hover:shadow ${
                      item.completed 
                        ? 'border-slate-100 bg-slate-50/50 opacity-70' 
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCompleted(item.id)}
                        className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title={item.completed ? "Marcar como pendente" : "Marcar como concluído"}
                      >
                        {item.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold text-slate-800 block leading-snug break-words ${item.completed ? 'line-through text-slate-400' : ''}`}>
                          {item.title}
                        </span>
                        
                        {item.description && (
                          <p className={`text-[10px] text-slate-500 mt-1 break-words leading-relaxed ${item.completed ? 'line-through opacity-60' : ''}`}>
                            {item.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {getCategoryBadge(item.category)}
                          {getPriorityBadge(item.priority)}
                          <span className="text-[8px] text-slate-400 font-mono flex items-center">
                            📅 {item.completed ? `Concluído: ${item.completedAt || item.createdAt}` : `Criado: ${item.createdAt}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                      {deleteConfirmId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => confirmDelete(item.id)}
                            className="text-[10px] bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700 transition-all cursor-pointer"
                          >
                            Confirmar?
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-300 transition-all cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Floating Window Footer */}
        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 text-center text-[9px] text-slate-500 font-medium">
          Total: {improvements.length} • Pendentes: {improvements.filter(i => !i.completed).length} • Concluídos: {improvements.filter(i => i.completed).length}
        </div>
      </div>
    </>
  );
}
