const { resetChatState, reactivateBot, initChatState } = require('../botLogic');
const { sendErrorResponse } = require('../utils');

/**
 * Resetar estado do bot para um chat específico
 */
const resetBotChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return sendErrorResponse(res, 400, 'chatId is required');
    }
    
    resetChatState(chatId);
    res.json({ success: true, message: 'Bot state reset for chat' });
  } catch (error) {
    sendErrorResponse(res, 500, error.message);
  }
};

/**
 * Reativar bot para um chat específico (quando humano sai)
 */
const reactivateBotChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return sendErrorResponse(res, 400, 'chatId is required');
    }
    
    reactivateBot(chatId);
    res.json({ success: true, message: 'Bot reactivated for chat' });
  } catch (error) {
    sendErrorResponse(res, 500, error.message);
  }
};

/**
 * Obter estado atual do bot para um chat
 */
const getBotState = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return sendErrorResponse(res, 400, 'chatId is required');
    }
    
    const state = initChatState(chatId);
    res.json({ success: true, state });
  } catch (error) {
    sendErrorResponse(res, 500, error.message);
  }
};

module.exports = {
  resetBotChat,
  reactivateBotChat,
  getBotState
};
