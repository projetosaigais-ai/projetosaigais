import React from 'react';
import { Medicamento } from '../types';

interface MedicamentosTableProps {
  medicamentos: Medicamento[];
  familiarName: string;
}

export default function MedicamentosTable({ medicamentos, familiarName }: MedicamentosTableProps) {
  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm print:p-0 print:border-0 print:shadow-none">
      <h2 className="text-xl font-bold text-slate-800 mb-6 print:text-black">
        MEDICAMENTOS / FAMILIAR - <span className="text-blue-600">{familiarName.toUpperCase()}</span>
      </h2>
      
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="py-3 px-2 text-xs font-bold text-slate-500 uppercase">Medicamento</th>
            <th className="py-3 px-2 text-xs font-bold text-slate-500 uppercase text-center">☀️ Manhã</th>
            <th className="py-3 px-2 text-xs font-bold text-slate-500 uppercase text-center">🌤️ Meio-Dia</th>
            <th className="py-3 px-2 text-xs font-bold text-slate-500 uppercase text-center">⛅ Tarde</th>
            <th className="py-3 px-2 text-xs font-bold text-slate-500 uppercase text-center">🌙 Noite</th>
            <th className="py-3 px-2 text-xs font-bold text-slate-500 uppercase">Observações</th>
          </tr>
        </thead>
        <tbody>
          {medicamentos.map((med) => (
            <tr key={med.id} className="border-b border-slate-100 hover:bg-slate-50 print:border-slate-200">
              <td className="py-3 px-2">
                <div className="font-bold text-slate-800 text-sm">{med.nome} {med.dosagem}</div>
                <div className="text-xs text-slate-500 italic">{med.principioAtivo}</div>
              </td>
              <td className="py-3 px-2 text-center text-xs font-semibold text-amber-700 bg-amber-50/50">{med.doseManha || '-'}</td>
              <td className="py-3 px-2 text-center text-xs font-semibold text-orange-700 bg-orange-50/50">{med.doseMeioDia || '-'}</td>
              <td className="py-3 px-2 text-center text-xs font-semibold text-blue-700 bg-blue-50/50">{med.doseTarde || '-'}</td>
              <td className="py-3 px-2 text-center text-xs font-semibold text-indigo-700 bg-indigo-50/50">{med.doseNoite || '-'}</td>
              <td className="py-3 px-2 text-xs text-slate-600">{med.posologia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
