
import type { Instance } from '../pages/Dashboard';
import { Smartphone, CheckCircle, RefreshCcw, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface InstancesListProps {
  instances: { [key: string]: Instance };
}

export default function InstancesList({ instances }: InstancesListProps) {
  const instanceEntries = Object.entries(instances);

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
            {instance.connectionStatus === 'CONNECTED' && (
              <button onClick={() => handleLogout(id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Desconectar">
                <LogOut size={16} />
              </button>
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
    