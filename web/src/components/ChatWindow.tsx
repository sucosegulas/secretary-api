import React, { useState, useRef, useEffect } from 'react';
import type { Chat } from '../pages/Dashboard';
import { Send, CheckCircle } from 'lucide-react';

interface ChatWindowProps {
  chat: Chat;
  onSend: (text: string) => void;
  onResolve: () => void;
}

export default function ChatWindow({ chat, onSend, onResolve }: ChatWindowProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSend(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-[#efeae2] relative shadow-inner">
      {/* WhatsApp-like background pattern */}
      <div className="absolute inset-0 opacity-[0.06] bg-[url('https://static.whatsapp.net/rsrc.php/v3/yl/r/r-x41-U_E9V.png')] z-0"></div>
      
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shadow-sm border border-slate-200">
            {chat.userName ? chat.userName.substring(0, 2).toUpperCase() : chat.phone.substring(0, 2)}
          </div>
          <div>
            <h2 className="font-bold text-slate-800">{chat.userName || `+${chat.phone}`}</h2>
            <p className="text-xs text-slate-500 font-medium">
              {chat.state.startsWith('bot_') ? 'Sendo atendido pelo Robô' : 'Em atendimento humano'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {chat.state === 'human' && (
            <button 
              onClick={onResolve}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <CheckCircle size={16} />
              Finalizar Atendimento
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 z-10">
        <div className="flex flex-col gap-3 max-w-3xl mx-auto">
          {chat.messages.map((msg) => {
            const isMe = msg.fromMe;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm relative ${
                    isMe 
                      ? 'bg-primary-500 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-100' : 'text-slate-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white p-4 border-t border-slate-200 z-10">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-end gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={chat.state.startsWith('bot_')}
            placeholder={chat.state.startsWith('bot_') ? 'Atendimento está com o robô...' : 'Digite uma mensagem...'}
            className="flex-1 bg-slate-100 border-none px-5 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={chat.state.startsWith('bot_') || !inputText.trim()}
            className="w-12 h-12 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-colors shadow-sm flex-shrink-0"
          >
            <Send size={20} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
