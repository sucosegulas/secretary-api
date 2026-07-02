
import { Smartphone, CheckCircle, RefreshCcw } from 'lucide-react';

interface QrCodeProps {
  status: string;
  qrCode: string;
}

export default function QrCode({ status, qrCode }: QrCodeProps) {
  return (
    <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800">Conexão WhatsApp</h2>
        <p className="text-sm text-slate-500">Conecte seu aparelho para ativar a secretaria virtual.</p>
      </div>
      
      <div className="p-8 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold flex-shrink-0">1</div>
              <p className="text-slate-600">Abra o WhatsApp no seu celular</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold flex-shrink-0">2</div>
              <p className="text-slate-600">Toque em <strong>Mais opções</strong> (três pontinhos) no Android, ou em <strong>Configurações</strong> no iPhone</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold flex-shrink-0">3</div>
              <p className="text-slate-600">Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong></p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold flex-shrink-0">4</div>
              <p className="text-slate-600">Aponte seu celular para esta tela para capturar o código QR</p>
            </div>
          </div>
        </div>

        <div className="w-64 flex flex-col items-center">
          {status === 'CONNECTED' ? (
            <div className="w-64 h-64 bg-green-50 rounded-2xl flex flex-col items-center justify-center border-2 border-green-100 p-6 text-center">
              <CheckCircle size={48} className="text-green-500 mb-4" />
              <h3 className="font-semibold text-green-700">WhatsApp Conectado!</h3>
              <p className="text-sm text-green-600 mt-2">A secretaria virtual está pronta para receber mensagens.</p>
            </div>
          ) : status === 'QR_READY' && qrCode ? (
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100">
              <img src={qrCode} alt="QR Code" className="w-56 h-56" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 p-6 text-center text-slate-400">
              <RefreshCcw size={32} className="animate-spin mb-4" />
              <p>Gerando QR Code...</p>
            </div>
          )}
          
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
            <Smartphone size={16} />
            <span>Mantenha o celular conectado à internet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
