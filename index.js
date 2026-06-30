const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const instances = {}; // instanceId -> { sock, qrCodeData, connectionStatus, phone }
const chats = {}; // chatId -> { messages, state, unread, phone, instanceId, remoteJid, userName, userInterest }

// Timestamp de inicialização do servidor (em segundos, igual ao messageTimestamp do WhatsApp)
// Usado para ignorar mensagens "antigas" reenviadas pelo WhatsApp/Baileys após reconexão.
const SERVER_START_TIME = Math.floor(Date.now() / 1000);

// Controle de mensagens já processadas, para evitar reprocessar a mesma mensagem
// mais de uma vez (o que causava o bot "emendar" várias respostas do fluxo seguidas).
const processedMessageIds = new Set();

// Trava por chat: enquanto está true, o bot não processa nova mensagem desse chat,
// garantindo que cada etapa do fluxo só avance depois que o cliente responder.
const chatLocks = {};

async function connectToWhatsApp(instanceId) {
  const authFolder = `auth_info_${instanceId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Secretaria Virtual', 'Chrome', '1.0.0']
  });

  if (!instances[instanceId]) {
    instances[instanceId] = { sock: null, qrCodeData: '', connectionStatus: 'DISCONNECTED', phone: '' };
  }
  instances[instanceId].sock = sock;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    const safeData = {
      connectionStatus: instances[instanceId].connectionStatus,
      qrCodeData: instances[instanceId].qrCodeData,
      phone: instances[instanceId].phone
    };

    if (qr) {
      instances[instanceId].qrCodeData = await qrcode.toDataURL(qr);
      instances[instanceId].connectionStatus = 'QR_READY';
      safeData.qrCodeData = instances[instanceId].qrCodeData;
      safeData.connectionStatus = 'QR_READY';
      io.emit('instance_update', { instanceId, data: safeData });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      instances[instanceId].connectionStatus = 'DISCONNECTED';
      safeData.connectionStatus = 'DISCONNECTED';
      io.emit('instance_update', { instanceId, data: safeData });
      if (shouldReconnect) {
        connectToWhatsApp(instanceId);
      } else {
        fs.rmSync(authFolder, { recursive: true, force: true });
        instances[instanceId].qrCodeData = '';
        instances[instanceId].sock = null;
        safeData.qrCodeData = '';
        io.emit('instance_update', { instanceId, data: safeData });
      }
    } else if (connection === 'open') {
      instances[instanceId].connectionStatus = 'CONNECTED';
      instances[instanceId].qrCodeData = '';
      instances[instanceId].phone = sock.user.id.split(':')[0];
      
      safeData.connectionStatus = 'CONNECTED';
      safeData.qrCodeData = '';
      safeData.phone = instances[instanceId].phone;
      io.emit('instance_update', { instanceId, data: safeData });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;
      
      const remoteJid = msg.key.remoteJid;

      // Ignorar TODOS os contextos que não sejam chats individuais (1 a 1)
      if (remoteJid.includes('@g.us')) continue;       // Grupos
      if (remoteJid.includes('@broadcast')) continue;  // Listas de transmissão
      if (remoteJid === 'status@broadcast') continue;  // Status do WhatsApp
      if (msg.key.participant) continue;               // Mensagens de grupos com participante definido

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (!text) continue;

      // Ignora mensagens antigas (backlog reenviado pelo WhatsApp/Baileys após reconexão)
      const msgTimestamp = Number(msg.messageTimestamp) || 0;
      if (msgTimestamp && msgTimestamp < SERVER_START_TIME) continue;

      // Ignora mensagens já processadas (evita reprocessar e disparar respostas duplicadas/em sequência)
      if (msg.key.id) {
        if (processedMessageIds.has(msg.key.id)) continue;
        processedMessageIds.add(msg.key.id);
      }

      const chatId = `${instanceId}:${remoteJid}`;

      // Trava: se já existe um processamento em andamento para este chat, ignora
      // (evita que duas mensagens do mesmo chat sejam processadas "ao mesmo tempo"
      // e o bot acabe respondendo mais de uma etapa do fluxo de uma vez)
      if (chatLocks[chatId]) continue;
      chatLocks[chatId] = true;

      if (!chats[chatId]) {
        chats[chatId] = { 
          instanceId,
          remoteJid,
          messages: [], 
          state: 'bot_waiting_name', 
          unread: 0, 
          phone: remoteJid.split('@')[0],
          userName: '',
          userInterest: ''
        };
      }

      chats[chatId].messages.push({
        id: msg.key.id,
        text,
        fromMe: false,
        timestamp: Date.now()
      });
      chats[chatId].unread += 1;

      io.emit('chat_update', { chatId, chat: chats[chatId] });

      try {
      // Bot Logic (Trailercar Flow sem IA)
      const chatState = chats[chatId].state;

      // Se um humano já assumiu o atendimento, o bot NUNCA responde automaticamente.
      if (chatState === 'human') {
        continue;
      }

      if (chatState.startsWith('bot_')) {
        let replyText = '';
        let linkText = '';
        const lowerText = text.toLowerCase();

        if (chatState === 'bot_waiting_name') {
           if (chats[chatId].messages.length === 1) {
             replyText = 'Olá! Bem-vindo(a) à Trailercar Motorhome. 🚐✨\n\nPara eu conseguir te ajudar da melhor forma, como posso te chamar?';
           } else {
             chats[chatId].userName = text;
             chats[chatId].state = 'bot_waiting_interest';
             replyText = `Prazer, ${text}! Você já tem um veículo para montar o motorhome, quer um semi-novo nosso ou deseja alugar?\n\n1️⃣ Já tenho veículo\n2️⃣ Quero Comprar\n3️⃣ Quero Alugar\n4️⃣ Apenas dúvidas`;
           }
        } 
        else if (chatState === 'bot_waiting_interest') {
           const name = chats[chatId].userName;
           
           if (lowerText.includes('1') || lowerText.includes('veículo')) {
             chats[chatId].userInterest = 'Já tenho veículo';
             chats[chatId].state = 'human';
             replyText = 'Ótimo! Para agilizarmos, nos informe o modelo/ano do veículo e qual tipo de montagem tem em mente. Um especialista já vai te atender!';
             linkText = 'Enquanto aguarda, veja nosso trabalho em nosso site: \nhttps://trailercarmotorhome.com';
           } else if (lowerText.includes('2') || lowerText.includes('comprar')) {
             chats[chatId].userInterest = 'Quero Comprar';
             chats[chatId].state = 'human';
             replyText = 'Excelente! Trabalhamos com Motorhomes sob medida e seminovos. Um dos nossos vendedores assumirá o atendimento em breve.';
             linkText = 'Confira nossos modelos disponíveis em nosso site: \nhttps://trailercarmotorhome.com';
           } else if (lowerText.includes('3') || lowerText.includes('alugar')) {
             chats[chatId].userInterest = 'Quero Alugar';
             chats[chatId].state = 'human';
             replyText = 'Legal! Qual seria o período da viagem? Nosso setor de locação vai verificar as datas disponíveis. ';
             linkText = 'Veja as opções de locação em nosso site: \nhttps://trailercarmotorhome.com/locacao.html';
           } else if (lowerText.includes('4') || lowerText.includes('dúvidas')) {
             chats[chatId].userInterest = 'Apenas dúvidas';
             chats[chatId].state = 'human';
             replyText = 'Sem problemas, estamos aqui para ajudar. Digite sua dúvida que alguém da nossa equipe vai te responder.';
             linkText = 'ou se preferir também pode visitar nosso site: \nhttps://trailercarmotorhome.com';
           } else {
             replyText = 'Por favor, escolha uma das opções:\n\n1️⃣ Já tenho veículo\n2️⃣ Quero Comprar\n3️⃣ Quero Alugar\n4️⃣ Dúvidas/Falar com Vendas';
           }

           if (chats[chatId].state === 'human') {
             io.emit('chat_update', { chatId, chat: chats[chatId] });
           }
        }

        if (replyText) {
          await sock.sendMessage(remoteJid, { text: replyText });
          chats[chatId].messages.push({
            id: 'bot-' + Date.now(),
            text: replyText,
            fromMe: true,
            timestamp: Date.now()
          });
          io.emit('chat_update', { chatId, chat: chats[chatId] });

          // Envia a segunda mensagem com o link, se houver
          if (linkText) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // pequeno delay para parecer natural
            await sock.sendMessage(remoteJid, { text: linkText });
            chats[chatId].messages.push({
              id: 'bot-link-' + Date.now(),
              text: linkText,
              fromMe: true,
              timestamp: Date.now()
            });
            io.emit('chat_update', { chatId, chat: chats[chatId] });
          }
        }
      }
      } finally {
        chatLocks[chatId] = false;
      }
    }
  });
}

// API Routes
app.get('/instances', (req, res) => {
  const safeInstances = Object.keys(instances).reduce((acc, id) => {
    acc[id] = {
      connectionStatus: instances[id].connectionStatus,
      qrCodeData: instances[id].qrCodeData,
      phone: instances[id].phone
    };
    return acc;
  }, {});
  res.json(safeInstances);
});

app.post('/instances', (req, res) => {
  const instanceId = crypto.randomBytes(4).toString('hex');
  connectToWhatsApp(instanceId);
  res.json({ instanceId, message: 'Instance created and connecting' });
});

app.post('/instances/:id/logout', (req, res) => {
  const { id } = req.params;
  if (instances[id] && instances[id].sock) {
     instances[id].sock.logout();
     res.json({ success: true });
  } else {
     res.status(404).json({ error: 'Instance not found' });
  }
});

app.get('/chats', (req, res) => {
  res.json(chats);
});

app.post('/send', async (req, res) => {
  const { chatId, text } = req.body;
  const chat = chats[chatId];
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  
  const instance = instances[chat.instanceId];
  if (!instance || !instance.sock || instance.connectionStatus !== 'CONNECTED') {
    return res.status(400).json({ error: 'Instância desconectada' });
  }

  try {
    await instance.sock.sendMessage(chat.remoteJid, { text });
    const newMsg = { id: 'human-' + Date.now(), text, fromMe: true, timestamp: Date.now() };
    chats[chatId].messages.push(newMsg);
    chats[chatId].unread = 0;
    io.emit('chat_update', { chatId, chat: chats[chatId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/resolve', (req, res) => {
   const { chatId } = req.body;
   if (chats[chatId]) {
      chats[chatId].state = 'bot_waiting_name';
      chats[chatId].userName = '';
      chats[chatId].userInterest = '';
      io.emit('chat_update', { chatId, chat: chats[chatId] });
      res.json({ success: true });
   } else {
      res.status(404).json({ error: 'Chat not found' });
   }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Connect default instance if exists, else it waits for POST /instances
  // To make it easy, we will auto-load any folder starting with auth_info_
  const folders = fs.readdirSync(__dirname).filter(f => f.startsWith('auth_info_'));
  if (folders.length > 0) {
    folders.forEach(f => {
      const id = f.replace('auth_info_', '');
      connectToWhatsApp(id);
    });
  } else {
    // start one default instance for backward compatibility
    connectToWhatsApp('default');
  }
});
