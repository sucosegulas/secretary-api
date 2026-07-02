
import type { Chat, Instance } from '../pages/Dashboard';
import { User, Bot, Smartphone } from 'lucide-react';

interface ChatListProps {
  chats: { [key: string]: Chat };
  instances: { [key: string]: Instance };
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
}

export default function ChatList({ chats, instances, activeChatId, setActiveChatId }: ChatListProps) {
  const chatEntries = Object.entries(chats).sort(([, a], [, b]) => {
    const timeA = a.messages[a.messages.length - 1]?.timestamp || 0;
    const timeB = b.messages[b.messages.length - 1]?.timestamp || 0;
    return timeB - timeA;
  });

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-lg">Conversas</h3>
        <div className="bg-primary-50 text-primary-600 text-xs px-2.5 py-1 rounded-full font-semibold">
          {chatEntries.length}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chatEntries.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Nenhuma conversa no momento.
          </div>
        ) : (
          chatEntries.map(([chatId, chat]) => {
            const lastMsg = chat.messages[chat.messages.length - 1];
            const instancePhone = instances[chat.instanceId]?.phone || 'Desconhecido';

            return (
              <div 
                key={chatId}
                onClick={() => setActiveChatId(chatId)}
                className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 flex items-start gap-4 ${
                  activeChatId === chatId ? 'bg-primary-50/50 border-l-4 border-l-primary-500' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 relative shadow-sm">
                  <User className="text-slate-400" size={24} />
                  {chat.state.startsWith('bot_') && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm" title="No robô">
                      <Bot size={12} />
                    </div>
                  )}
                  {chat.unread > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                      {chat.unread}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-semibold text-slate-800 truncate">{chat.userName || chat.phone}</h4>
                    <span className="text-xs text-slate-400 font-medium">
                      {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-1.5 ${chat.unread > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
                    {lastMsg ? lastMsg.text : 'Sem mensagens'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded flex-shrink-0 font-medium">
                      <Smartphone size={10} />
                      {instancePhone}
                    </span>
                    {chat.userInterest && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded truncate font-medium">
                        {chat.userInterest}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
