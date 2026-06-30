// Estado dos chats gerenciados pelo bot
const chatStates = new Map();

// Helper function to get sessions (avoid circular dependency)
function getSessions() {
  return require('./sessions').sessions;
}

// Configurações do bot
const BOT_CONFIG = {
  ENABLED: process.env.BOT_ENABLED === 'true',
  PHONE_NUMBER: '04932250710',
  SITE_URL: 'trailercarmotorhome.com',
  MAX_UNANSWERED_MESSAGES: 3,
  FLOW_STEPS: []
};

// Define flow steps after BOT_CONFIG is initialized
BOT_CONFIG.FLOW_STEPS = [
  { step: 1, message: 'Olá! Bem-vindo à Trailercar Motorhomes. Como posso ajudar?' },
  { step: 2, message: 'Você está interessado em quais modelos?' },
  { step: 3, message: 'Temos opções excelentes! Gostaria de saber mais sobre?' },
  { step: 4, message: `Confira nosso site: ${BOT_CONFIG.SITE_URL}` }
];

console.log('Bot initialized. ENABLED:', BOT_CONFIG.ENABLED);

// Inicializar estado do chat
function initChatState(chatId) {
  if (!chatStates.has(chatId)) {
    chatStates.set(chatId, {
      currentStep: 0,
      unansweredCount: 0,
      isHumanActive: false,
      lastBotMessage: null,
      messageHistory: []
    });
  }
  return chatStates.get(chatId);
}

// Verificar se mensagem é de humano
function isHumanMessage(message) {
  return message.fromMe === false;
}

// Verificar se mensagem é do receptor (atendente humano)
function isHumanAttendant(message, chatId) {
  const state = chatStates.get(chatId);
  if (!state) return false;
  
  // Se detectarmos que um humano está respondendo ativamente
  const recentMessages = state.messageHistory.slice(-5);
  const humanResponses = recentMessages.filter(m => m.fromMe && m.isAttendant);
  
  return humanResponses.length > 0;
}

// Processar mensagem recebida
async function processIncomingMessage(sessionId, message) {
  console.log('Bot: Processing incoming message from', message.from, 'BOT_ENABLED:', BOT_CONFIG.ENABLED);
  
  if (!BOT_CONFIG.ENABLED) {
    console.log('Bot: Disabled, skipping message processing');
    return;
  }

  const sessions = getSessions();
  const client = sessions.get(sessionId);
  if (!client) {
    console.log('Bot: Client not found for session', sessionId);
    return;
  }

  const chatId = message.from;
  const state = initChatState(chatId);

  console.log('Bot: Chat state - currentStep:', state.currentStep, 'isHumanActive:', state.isHumanActive, 'unansweredCount:', state.unansweredCount);

  // Adicionar mensagem ao histórico
  state.messageHistory.push({
    fromMe: message.fromMe,
    text: message.body,
    timestamp: Date.now(),
    isAttendant: false
  });

  // Se humano já está ativo, não intervir
  if (state.isHumanActive) {
    console.log('Bot: Human is active, not intervening');
    state.unansweredCount = 0;
    return;
  }

  // Verificar se é mensagem do cliente (não do bot)
  if (!message.fromMe) {
    state.unansweredCount++;
    console.log('Bot: Client message, unanswered count:', state.unansweredCount);
    
    // Regra 3: Se 3 mensagens sem resposta, enviar fallback
    if (state.unansweredCount >= BOT_CONFIG.MAX_UNANSWERED_MESSAGES) {
      console.log('Bot: Sending fallback message');
      await sendFallbackMessage(client, chatId);
      state.unansweredCount = 0;
      return;
    }

    // Avançar no fluxo do bot
    console.log('Bot: Advancing bot flow');
    await advanceBotFlow(client, chatId, state);
  }
}

// Processar mensagem enviada (para detectar intervenção humana)
async function processOutgoingMessage(sessionId, message) {
  console.log('Bot: Processing outgoing message to', message.to, 'BOT_ENABLED:', BOT_CONFIG.ENABLED);
  
  if (!BOT_CONFIG.ENABLED) {
    console.log('Bot: Disabled, skipping outgoing message processing');
    return;
  }

  const sessions = getSessions();
  const client = sessions.get(sessionId);
  if (!client) {
    console.log('Bot: Client not found for session', sessionId);
    return;
  }

  const chatId = message.to;
  const state = initChatState(chatId);

  console.log('Bot: Human intervention detected, stopping bot for chat', chatId);

  // Adicionar mensagem ao histórico
  state.messageHistory.push({
    fromMe: true,
    text: message.body,
    timestamp: Date.now(),
    isAttendant: true // Marcamos como atendente humano
  });

  // Regra 1: Se humano envia mensagem, bot para de interagir
  state.isHumanActive = true;
  state.currentStep = 0; // Resetar fluxo
  state.unansweredCount = 0;
}

// Avançar fluxo do bot
async function advanceBotFlow(client, chatId, state) {
  // Regra 2: Esperar resposta da penúltima pergunta antes de enviar site
  if (state.currentStep === BOT_CONFIG.FLOW_STEPS.length - 1) {
    // Último passo (site) - só enviar após resposta anterior
    const lastMessage = state.messageHistory[state.messageHistory.length - 2];
    if (lastMessage && !lastMessage.fromMe) {
      await sendBotMessage(client, chatId, BOT_CONFIG.FLOW_STEPS[state.currentStep].message);
      state.currentStep = 0; // Resetar após completar
    }
    return;
  }

  // Enviar próxima mensagem do fluxo
  if (state.currentStep < BOT_CONFIG.FLOW_STEPS.length) {
    await sendBotMessage(client, chatId, BOT_CONFIG.FLOW_STEPS[state.currentStep].message);
    state.currentStep++;
    state.unansweredCount = 0;
  }
}

// Enviar mensagem do bot
async function sendBotMessage(client, chatId, text) {
  try {
    await client.sendMessage(chatId, text);
  } catch (error) {
    console.error('Erro ao enviar mensagem do bot:', error);
  }
}

// Enviar mensagem de fallback
async function sendFallbackMessage(client, chatId) {
  const fallbackMessage = `Se sua resposta estiver demorando você pode nos ligar no ${BOT_CONFIG.PHONE_NUMBER}`;
  await sendBotMessage(client, chatId, fallbackMessage);
}

// Resetar estado do chat (quando atendimento é finalizado)
function resetChatState(chatId) {
  chatStates.delete(chatId);
}

// Reativar bot (quando humano sai do atendimento)
function reactivateBot(chatId) {
  const state = chatStates.get(chatId);
  if (state) {
    state.isHumanActive = false;
    state.unansweredCount = 0;
  }
}

module.exports = {
  processIncomingMessage,
  processOutgoingMessage,
  resetChatState,
  reactivateBot,
  initChatState
};
