
import type { Instance } from '../pages/Dashboard';
import { Smartphone, CheckCircle, RefreshCcw, LogOut, Eye, Bot, Lock, Unlock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface InstancesListProps {
  instances: { [key: string]: Instance };
}

export default function InstancesList({ instances }: InstancesListProps) {
  const instanceEntries = Object.entries(instances);

  const handleToggleProtect = async (id: string, isProtected: boolean) => {
    try {
      await fetch(`${API_URL}/instances/${id}/protect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protected: !isProtected }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMode = async (id: string, currentMode: string) => {
    const newMode = currentMode === 'monitor' ? 'bot' : 'monitor';
    try {
      await fetch(`${API_URL}/instances/${id}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async (id: string) => {
    try {
      await fetch(`${API_URL}/instances/${id}/logout`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {instanceEntries.length === 0 && (
        <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
          Nenhum celular conectado. Clique em "Adicionar Celular" para começar.
        </div>
      )}
      
      {instanceEntries.map(([id, instance]) => (
        <div key={id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Smartphone size={18} className="text-primary-500" />
              <span>Instância: {id.substring(0, 6)}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${instance.mode === 'monitor' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {instance.mode === 'monitor' ? 'MONITOR' : 'ROBÔ'}
            </span>
            <button onClick={() => handleToggleProtect(id, instance.protected)} className={`p-1.5 rounded-lg transition-colors ${instance.protected ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`} title={instance.protected ? 'Protegido — clique para desproteger' : 'Proteger contra desconexão acidental'}>
              {instance.protected ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            {instance.connectionStatus === 'CONNECTED' && (
              <>
                <button onClick={() => handleToggleMode(id, instance.mode)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors" title={instance.mode === 'monitor' ? 'Mudar para Robô' : 'Mudar para Monitor'}>
                  {instance.mode === 'monitor' ? <Bot size={16} /> : <Eye size={16} />}
                </button>
                {!instance.protected && (
                  <button onClick={() => {
                    if (confirm('Tem certeza que deseja desconectar esta instância?')) handleLogout(id);
                  }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Desconectar">
                    <LogOut size={16} />
                  </button>
                )}
              </>
            )}
          </div>
          
          <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[250px]">
            {instance.connectionStatus === 'CONNECTED' ? (
              <div className="text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-800 text-lg mb-1">Conectado</h3>
                <p className="text-sm text-slate-500 font-medium">+{instance.phone}</p>
                <div className="mt-4 text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full inline-block font-medium">
                  Pronto para enviar/receber
                </div>
              </div>
            ) : instance.connectionStatus === 'PAIRING' && instance.pairingCode ? (
              <div className="text-center">
                <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl p-6 mb-4">
                  <p className="text-xs text-blue-600 font-medium mb-2">CÓDIGO DE PAR</p>
                  <p className="text-3xl font-bold text-blue-800 tracking-widest">{instance.pairingCode}</p>
                </div>
                <p className="text-sm text-slate-600 mb-1">Envie este código para {instance.phone}</p>
                <p className="text-xs text-slate-400">A pessoa deve abrir o WhatsApp > Dispositivos Conectados > Conectar com número de telefone</p>
              </div>
            ) : instance.connectionStatus === 'QR_READY' && instance.qrCodeData ? (
              <div className="text-center">
                <img src={instance.qrCodeData} alt="QR Code" className="w-48 h-48 mx-auto mb-4 rounded-xl shadow-sm border border-slate-100" />
                <p className="text-sm text-slate-500">Escaneie o QR Code</p>
              </div>
            ) : (
              <div className="text-center text-slate-400">
                <RefreshCcw size={32} className="animate-spin mx-auto mb-4" />
                <p>Inicializando...</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
