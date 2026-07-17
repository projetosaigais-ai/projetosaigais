import React from 'react';
import { AlertTriangle, XCircle, CheckCircle2, Split } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MultiInstanceModalProps {
  isOpen: boolean;
  onContinueHere: () => void;
  onCloseThis: () => void;
  onKeepBoth: () => void;
}

export const MultiInstanceModal: React.FC<MultiInstanceModalProps> = ({
  isOpen,
  onContinueHere,
  onCloseThis,
  onKeepBoth
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-100"
          >
            <div className="bg-amber-50 p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-amber-900 mb-2">Múltiplas Abas Detectadas</h2>
              <p className="text-amber-800 text-[12px] leading-relaxed">
                Este aplicativo utiliza a tecnologia <strong>BroadcastChannel</strong> para sincronizar as abas do seu navegador. 
                Detectamos que outra instância já está ativa. Para evitar conflitos de gravação e proteger a integridade dos seus dados, 
                escolha como deseja prosseguir:
              </p>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={onContinueHere}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-left group"
              >
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-bold text-sm text-emerald-900">Continuar Aqui e Fechar Outras</div>
                  <div className="text-[11px] text-emerald-600">Torna esta aba a principal e desativa as demais</div>
                </div>
              </button>

              <button
                onClick={onCloseThis}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors text-left group"
              >
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="font-bold text-sm text-rose-900">Fechar esta Janela</div>
                  <div className="text-[11px] text-rose-600">Encerra o aplicativo nesta aba imediatamente</div>
                </div>
              </button>

              <button
                onClick={onKeepBoth}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors text-left group"
              >
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                  <Split className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Manter Ambos Abertos</div>
                  <div className="text-[11px] text-gray-500">Permite o uso simultâneo (não recomendado)</div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
