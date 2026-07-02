import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import InstancesList from '../components/InstancesList';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
}

export interface Chat {
  instanceId: string;
  remoteJid: string;
  phone: string;
  messages: Message[];
  state: string;
  unread: number;
  userName: string;
  userInterest: string;
}

export interface Instance {
  connectionStatus: string;
  qrCodeData: string;
  phone: string;
  mode: 'bot' | 'monitor';
  protected: boolean;
  pairingCode: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('chats');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [instances, setInstances] = useState<{ [key: string]: Instance }>({});
  const [chats, setChats] = useState<{ [key: string]: Chat }>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('instance_update', ({ instanceId, data }) => {
      setInstances(prev => ({ ...prev, [instanceId]: data }));
    });
    
    newSocket.on('chat_update', ({ chatId, chat }) => {
      setChats(prev => ({ ...prev, [chatId]: chat }));
    });

    fetch(`${API_URL}/instances`)
      .then(res => res.json())
      .then(data => setInstances(data))
      .catch(console.error);

    fetch(`${API_URL}/chats`)
      .then(res => res.json())
      .then(data => setChats(data))
      .catch(console.error);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!activeChatId) return;
    
    try {
      await fetch(`${API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChatId, text })
      });
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleResolve = async () => {
    if (!activeChatId) return;
    try {
      await fetch(`${API_URL}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChatId })
      });
      setActiveChatId(null);
    } catch (err) {
      console.error('Failed to resolve', err);
    }
  };

  const addInstance = async () => {
    const usePairing = window.confirm('Clique OK para conectar com CÓDIGO DE PAR (envia código para o número)\nClique Cancelar para conectar com QR CODE');
    const mode = window.confirm('Clique OK para modo ROBÔ (responde automaticamente)\nClique Cancelar para modo MONITOR (apenas visualizar)')
      ? 'bot'
      : 'monitor';

    if (usePairing) {
      const phone = prompt('Digite o número do WhatsApp com DDD (ex: 5549998400285):');
      if (!phone) return;
      try {
        await fetch(`${API_URL}/instances/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, mode }),
        });
      } catch (err) {
        console.error('Failed to pair instance', err);
      }
    } else {
      try {
        await fetch(`${API_URL}/instances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
      } catch (err) {
        console.error('Failed to add instance', err);
      }
    }
  };

  const getGlobalStatus = () => {
    const vals = Object.values(instances);
    if (vals.length === 0) return 'DISCONNECTED';
    if (vals.some(i => i.connectionStatus === 'CONNECTED')) return 'CONNECTED';
    if (vals.some(i => i.connectionStatus === 'QR_READY')) return 'QR_READY';
    return 'DISCONNECTED';
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-800">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        connectionStatus={getGlobalStatus()} 
      />
      
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'chats' && (
          <>
            <div className="w-1/3 min-w-[320px] border-r border-slate-200 bg-white">
               <ChatList 
                 chats={chats} 
                 instances={instances}
                 activeChatId={activeChatId} 
                 setActiveChatId={setActiveChatId} 
               />
            </div>
            <div className="flex-1 bg-[#efeae2] relative shadow-inner">
              {activeChatId && chats[activeChatId] ? (
                <ChatWindow 
                  chat={chats[activeChatId]} 
                  onSend={handleSendMessage}
                  onResolve={handleResolve}
                  instances={instances}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <div className="text-center p-8 bg-white/50 backdrop-blur-md rounded-3xl border border-white">
                    <h2 className="text-2xl font-bold text-slate-600 mb-2">Secretaria Virtual</h2>
                    <p>Selecione um chat para começar a atender</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Celulares Conectados</h1>
                <button onClick={addInstance} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-primary-500/30 transition-all active:scale-95">
                  + Adicionar Celular
                </button>
              </div>
              <InstancesList instances={instances} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
