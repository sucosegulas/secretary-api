
import { MessageSquare, Settings, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logout, getAuthUser } from '../auth';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  connectionStatus: string;
}

export default function Sidebar({ activeTab, setActiveTab, connectionStatus }: SidebarProps) {
  const navigate = useNavigate();
  const authUser = getAuthUser();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
      <div className="p-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white">SV</span>
          Secretaria
        </h2>
      </div>

      <div className="px-4 py-2 mb-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
          connectionStatus === 'CONNECTED' ? 'bg-green-500/10 text-green-400' :
          connectionStatus === 'QR_READY' ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          {connectionStatus === 'CONNECTED' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
          <span className="truncate">
            {connectionStatus === 'CONNECTED' ? 'WhatsApp Conectado' : 
             connectionStatus === 'QR_READY' ? 'Aguardando QR Code' : 'Desconectado'}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            activeTab === 'chats' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <MessageSquare size={20} />
          Atendimentos
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            activeTab === 'settings' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Settings size={20} />
          Configurações
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="px-4 py-2 mb-2 text-xs text-slate-500 truncate">
          👤 {authUser?.user || 'Atendente'}
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut size={20} />
          Sair do Painel
        </button>
      </div>
    </div>
  );
}
