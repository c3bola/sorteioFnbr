/**
 * Utilitário para extrair informações da legenda do sorteio
 * 
 * Formato esperado:
 * Título: Clube Fortnite de Novembro
 * Data do Sorteio: 08/11/2025
 * Tipo de Sorteio: Teste
 * Descrição do Prêmio:
 * 🔹 Traje Velocidade Máxxima
 * 🔹 Mochila Central de Controle
 * ...
 */

/**
 * Extrai informações estruturadas da legenda
 * @param {string} caption - Legenda completa do sorteio
 * @returns {Object} Objeto com as informações extraídas
 */
function parseCaptionInfo(caption) {
  if (!caption) {
    return {
      title: null,
      raffleDate: null,
      raffleType: null,
      prizeDescription: null,
      rawCaption: caption
    };
  }

  const info = {
    title: null,
    raffleDate: null,
    raffleType: null,
    prizeDescription: null,
    rawCaption: caption
  };

  try {
    // Extrair Título
    const titleMatch = caption.match(/Título:\s*(.+?)(?:\n|$)/i);
    if (titleMatch) {
      info.title = titleMatch[1].trim();
    }

    // Extrair Data do Sorteio
    const dateMatch = caption.match(/Data do Sorteio:\s*(.+?)(?:\n|$)/i);
    if (dateMatch) {
      info.raffleDate = dateMatch[1].trim();
    }

    // Extrair Tipo de Sorteio
    const typeMatch = caption.match(/Tipo de Sorteio:\s*(.+?)(?:\n|$)/i);
    if (typeMatch) {
      info.raffleType = typeMatch[1].trim();
    }

    // Extrair Descrição do Prêmio (tudo após "Descrição do Prêmio:" até "Participantes:" ou fim)
    const prizeMatch = caption.match(/Descrição do Prêmio:\s*([\s\S]+?)(?:Participantes:|$)/i);
    if (prizeMatch) {
      info.prizeDescription = prizeMatch[1].trim();
    }

  } catch (error) {
    console.error('Erro ao fazer parse da legenda:', error);
  }

  return info;
}

/**
 * Formata as informações extraídas para exibição
 * @param {Object} info - Informações extraídas
 * @returns {string} String formatada para log
 */
function formatCaptionInfo(info) {
  let formatted = '';
  
  if (info.title) {
    formatted += `📋 Título: ${info.title}\n`;
  }
  if (info.raffleDate) {
    formatted += `📅 Data: ${info.raffleDate}\n`;
  }
  if (info.raffleType) {
    formatted += `🎯 Tipo: ${info.raffleType}\n`;
  }
  if (info.prizeDescription) {
    formatted += `🎁 Prêmio:\n${info.prizeDescription}\n`;
  }
  
  return formatted || 'Informações não disponíveis';
}

/**
 * Verifica se a legenda está no novo formato
 * @param {string} caption - Legenda para verificar
 * @returns {boolean} True se está no novo formato
 */
function isNewFormat(caption) {
  if (!caption) return false;
  
  return caption.includes('Título:') && 
         caption.includes('Data do Sorteio:') &&
         caption.includes('Descrição do Prêmio:');
}

module.exports = {
  parseCaptionInfo,
  formatCaptionInfo,
  isNewFormat
};
