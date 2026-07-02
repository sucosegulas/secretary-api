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

const instances = {}; // instanceId -> { sock, qrCodeData, connectionStatus, phone, mode, protected, pairingCode }
const INSTANCE_FILE = '.instance_config.json';
const AUTH_BASE = fs.existsSync('/data') ? '/data' : __dirname;

function saveConfig(instanceId, data) {
  try { fs.writeFileSync(`${AUTH_BASE}/auth_info_${instanceId}/${INSTANCE_FILE}`, JSON.stringify(data)); } catch {}
}
function loadConfig(instanceId) {
  try { return JSON.parse(fs.readFileSync(`${AUTH_BASE}/auth_info_${instanceId}/${INSTANCE_FILE}`, 'utf8')); } catch { return {}; }
}
const chats = {}; // chatId -> { messages, state, unread, phone, instanceId, remoteJid, userName, userInterest }

async function connectToWhatsApp(instanceId, mode = 'bot', isProtected = false) {
  const authFolder = `${AUTH_BASE}/auth_info_${instanceId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Secretaria Virtual', 'Chrome', '1.0.0']
  });

  saveConfig(instanceId, { mode, protected: isProtected });
  if (!instances[instanceId]) {
    instances[instanceId] = { sock: null, qrCodeData: '', connectionStatus: 'DISCONNECTED', phone: '', mode, protected: false, pairingCode: '' };
  }
  instances[instanceId].sock = sock;
  instances[instanceId].mode = mode;
  instances[instanceId].protected = isProtected;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    const safeData = {
      connectionStatus: instances[instanceId].connectionStatus,
      qrCodeData: instances[instanceId].qrCodeData,
      phone: instances[instanceId].phone,
      mode: instances[instanceId].mode,
      protected: instances[instanceId].protected,
      pairingCode: instances[instanceId].pairingCode
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

      const chatId = `${instanceId}:${remoteJid}`;

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

      // Bot Logic (apenas se modo for 'bot')
      const instanceMode = instances[instanceId]?.mode || 'bot';
      if (instanceMode !== 'bot') continue;

      const chatState = chats[chatId].state;
      if (chatState.startsWith('bot_')) {
        let replyText = '';
        let linkText = '';
        const lowerText = text.toLowerCase();

        if (chatState === 'bot_waiting_name') {
           if (chats[chatId].messages.length === 1) {
             replyText = 'Olá! Bem-vindo(a) à Trailercar Motorhomes. 🚐✨\n\nPara eu conseguir te ajudar da melhor forma, como posso te chamar?';
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
             linkText = 'Enquanto aguarda, veja nosso trabalho e inspire-se em nosso site: \nhttps://trailercarmotorhome.com';
           } else if (lowerText.includes('2') || lowerText.includes('comprar')) {
             chats[chatId].userInterest = 'Quero Comprar';
             chats[chatId].state = 'human';
             replyText = 'Excelente! Trabalhamos com Motorhomes sob medida e seminovos. Um dos nossos vendedores assumirá o atendimento em breve.';
             linkText = 'Confira nossos modelos disponíveis em nosso site: \nhttps://trailercarmotorhome.com';
           } else if (lowerText.includes('3') || lowerText.includes('alugar')) {
             chats[chatId].userInterest = 'Quero Alugar';
             chats[chatId].state = 'human';
             replyText = 'Legal! Nosso setor de locação vai verificar as datas disponíveis. Qual seria o período da viagem? Um consultor já vai falar com você.';
             linkText = 'Veja as opções de locação em nosso site: \nhttps://trailercarmotorhome.com/locacao.html';
           } else if (lowerText.includes('4') || lowerText.includes('dúvidas')) {
             chats[chatId].userInterest = 'Apenas dúvidas';
             chats[chatId].state = 'human';
             replyText = 'Sem problemas, estamos aqui para ajudar. Digite sua dúvida que alguém da nossa equipe vai te responder.';
             linkText = 'Enquanto isso, você pode tirar muitas dúvidas visitando nosso site: \nhttps://trailercarmotorhome.com';
           } else {
             replyText = 'Por favor, escolha uma das opções:\n\n1️⃣ Já tenho veículo\n2️⃣ Quero Comprar\n3️⃣ Quero Alugar\n4️⃣ Apenas dúvidas';
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
            await new Promise(resolve => setTimeout(resolve, 1000)); // pequeno delay para parecer natural
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
    }
  });
}

// API Routes
app.get('/instances', (req, res) => {
  const safeInstances = Object.keys(instances).reduce((acc, id) => {
    acc[id] = {
      connectionStatus: instances[id].connectionStatus,
      qrCodeData: instances[id].qrCodeData,
      phone: instances[id].phone,
      mode: instances[id].mode,
      protected: instances[id].protected,
      pairingCode: instances[id].pairingCode
    };
    return acc;
  }, {});
  res.json(safeInstances);
});

app.post('/instances', (req, res) => {
  const instanceId = crypto.randomBytes(4).toString('hex');
  const mode = req.body?.mode || 'bot';
  const isProtected = req.body?.protected === true;
  connectToWhatsApp(instanceId, mode, isProtected);
  res.json({ instanceId, mode, protected: isProtected, message: `Instance created and connecting (mode: ${mode})` });
});

app.post('/instances/pair', async (req, res) => {
  const { phone, mode } = req.body;
  if (!phone) return res.status(400).json({ error: 'Número de telefone é obrigatório' });

  const instanceId = crypto.randomBytes(4).toString('hex');
  const isProtected = req.body?.protected === true;
  const authFolder = `${AUTH_BASE}/auth_info_${instanceId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Secretaria Virtual', 'Chrome', '1.0.0']
  });

  saveConfig(instanceId, { mode: mode || 'bot', protected: isProtected });
  instances[instanceId] = { sock, qrCodeData: '', connectionStatus: 'PAIRING', phone, mode: mode || 'bot', protected: isProtected, pairingCode: '' };

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    const safeData = () => ({
      connectionStatus: instances[instanceId].connectionStatus,
      qrCodeData: instances[instanceId].qrCodeData,
      phone: instances[instanceId].phone,
      mode: instances[instanceId].mode,
      protected: instances[instanceId].protected,
      pairingCode: instances[instanceId].pairingCode
    });

    if (qr && !instances[instanceId].pairingCode) {
      instances[instanceId].qrCodeData = await qrcode.toDataURL(qr);
      instances[instanceId].connectionStatus = 'QR_READY';
      io.emit('instance_update', { instanceId, data: safeData() });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      instances[instanceId].connectionStatus = 'DISCONNECTED';
      io.emit('instance_update', { instanceId, data: safeData() });
      if (shouldReconnect) {
        connectToWhatsApp(instanceId);
      } else {
        fs.rmSync(authFolder, { recursive: true, force: true });
        instances[instanceId].qrCodeData = '';
        instances[instanceId].sock = null;
        io.emit('instance_update', { instanceId, data: safeData() });
      }
    } else if (connection === 'open') {
      instances[instanceId].connectionStatus = 'CONNECTED';
      instances[instanceId].qrCodeData = '';
      instances[instanceId].pairingCode = '';
      instances[instanceId].phone = sock.user.id.split(':')[0];
      io.emit('instance_update', { instanceId, data: safeData() });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Request pairing code after a brief delay
  setTimeout(async () => {
    try {
      const code = await sock.requestPairingCode(phone);
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
      instances[instanceId].pairingCode = formattedCode;
      instances[instanceId].connectionStatus = 'PAIRING';
      io.emit('instance_update', { instanceId, data: {
        connectionStatus: 'PAIRING',
        qrCodeData: '',
        phone,
        mode: instances[instanceId].mode,
        protected: instances[instanceId].protected,
        pairingCode: formattedCode
      }});
    } catch (err) {
      console.error(`Pairing code error for ${phone}:`, err);
    }
  }, 2000);

  res.json({ instanceId, phone, pairingRequested: true, message: 'Solicitação de pareamento enviada' });
});

app.post('/instances/pair-with-chat', async (req, res) => {
  const { chatId, phone: reqPhone } = req.body;
  const chat = chats[chatId];
  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });

  const sourceInstance = instances[chat.instanceId];
  if (!sourceInstance || !sourceInstance.sock || sourceInstance.connectionStatus !== 'CONNECTED') {
    return res.status(400).json({ error: 'Instância de origem não está conectada' });
  }

  const phone = reqPhone || chat.phone;
  const instanceId = crypto.randomBytes(4).toString('hex');
  const isProtected = req.body?.protected === true;
  const authFolder = `${AUTH_BASE}/auth_info_${instanceId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Secretaria Virtual', 'Chrome', '1.0.0']
  });

  saveConfig(instanceId, { mode: 'monitor', protected: isProtected });
  instances[instanceId] = { sock, qrCodeData: '', connectionStatus: 'PAIRING', phone, mode: 'monitor', protected: isProtected, pairingCode: '' };

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    const safeData = () => ({
      connectionStatus: instances[instanceId].connectionStatus,
      qrCodeData: instances[instanceId].qrCodeData,
      phone: instances[instanceId].phone,
      mode: instances[instanceId].mode,
      protected: instances[instanceId].protected,
      pairingCode: instances[instanceId].pairingCode
    });

    if (qr && !instances[instanceId].pairingCode) {
      instances[instanceId].qrCodeData = await qrcode.toDataURL(qr);
      instances[instanceId].connectionStatus = 'QR_READY';
      io.emit('instance_update', { instanceId, data: safeData() });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      instances[instanceId].connectionStatus = 'DISCONNECTED';
      io.emit('instance_update', { instanceId, data: safeData() });
      if (shouldReconnect) {
        connectToWhatsApp(instanceId);
      } else {
        fs.rmSync(authFolder, { recursive: true, force: true });
        instances[instanceId].qrCodeData = '';
        instances[instanceId].sock = null;
        io.emit('instance_update', { instanceId, data: safeData() });
      }
    } else if (connection === 'open') {
      instances[instanceId].connectionStatus = 'CONNECTED';
      instances[instanceId].qrCodeData = '';
      instances[instanceId].pairingCode = '';
      instances[instanceId].phone = sock.user.id.split(':')[0];
      io.emit('instance_update', { instanceId, data: safeData() });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  setTimeout(async () => {
    try {
      const code = await sock.requestPairingCode(phone);
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
      instances[instanceId].pairingCode = formattedCode;

      await sourceInstance.sock.sendMessage(chat.remoteJid, {
        text: `🔐 *Código de Conexão*\n\nPara conectar seu número ao nosso atendimento sem precisar escanear QR:\n\n1️⃣ Abra o WhatsApp\n2️⃣ Toque nos ⋮ (3 pontinhos) > *Dispositivos Conectados*\n3️⃣ Toque em *"Conectar com número de telefone"*\n4️⃣ Digite o código abaixo:\n\n*${formattedCode}*`
      });

      io.emit('instance_update', { instanceId, data: {
        connectionStatus: 'PAIRING',
        qrCodeData: '',
        phone,
        mode: instances[instanceId].mode,
        protected: instances[instanceId].protected,
        pairingCode: formattedCode
      }});
    } catch (err) {
      console.error(`Pairing chat error for ${phone}:`, err);
    }
  }, 2000);

  res.json({ instanceId, phone, pairingRequested: true, message: 'Código enviado via WhatsApp' });
});

app.post('/instances/:id/mode', (req, res) => {
  const { id } = req.params;
  const { mode } = req.body;
  if (!mode || !['bot', 'monitor'].includes(mode)) {
    return res.status(400).json({ error: 'Modo inválido. Use "bot" ou "monitor".' });
  }
  if (!instances[id]) return res.status(404).json({ error: 'Instance not found' });
  instances[id].mode = mode;
  saveMode(id, mode);
  io.emit('instance_update', { instanceId: id, data: {
    connectionStatus: instances[id].connectionStatus,
    qrCodeData: instances[id].qrCodeData,
    phone: instances[id].phone,
    mode,
    protected: instances[id].protected,
    pairingCode: instances[id].pairingCode
  }});
  res.json({ success: true, mode });
});

app.post('/instances/:id/protect', (req, res) => {
  const { id } = req.params;
  if (!instances[id]) return res.status(404).json({ error: 'Instance not found' });
  const isProtected = req.body?.protected === true;
  instances[id].protected = isProtected;
  saveConfig(id, { mode: instances[id].mode, protected: isProtected });
  io.emit('instance_update', { instanceId: id, data: {
    connectionStatus: instances[id].connectionStatus,
    qrCodeData: instances[id].qrCodeData,
    phone: instances[id].phone,
    mode: instances[id].mode,
    protected: isProtected,
    pairingCode: instances[id].pairingCode
  }});
  res.json({ success: true, protected: isProtected });
});

app.post('/instances/:id/logout', (req, res) => {
  const { id } = req.params;
  if (!instances[id]) return res.status(404).json({ error: 'Instance not found' });
  if (instances[id].protected) {
    return res.status(403).json({ error: 'Instância protegida — remova a proteção antes de desconectar' });
  }
  if (instances[id].sock) {
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

  if (instance.mode === 'monitor') {
    return res.status(403).json({ error: 'Instância em modo monitor — não é permitido enviar mensagens' });
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
  const folders = fs.readdirSync(AUTH_BASE).filter(f => f.startsWith('auth_info_'));
  if (folders.length > 0) {
    folders.forEach(f => {
      const id = f.replace('auth_info_', '');
      const cfg = loadConfig(id);
      connectToWhatsApp(id, cfg.mode || 'bot', cfg.protected === true);
    });
  } else {
    // start one default instance for backward compatibility
    connectToWhatsApp('default');
  }
});
