/**
 * WhatsApp Integration Utility
 * Opens WhatsApp chat with pre-filled message
 * Phone: +51 932 101 907 (Gerencia ROAS Ingenieros)
 */

const WHATSAPP_NUMBER = '51932101907';

export const openWhatsApp = (message: string) => {
  const encoded = encodeURIComponent(message.trim());
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`, '_blank');
};

export const generateQuoteMessage = (items: { name: string; qty: number; price?: string }[]): string => {
  const lines = items.map(item => `- ${item.qty}x ${item.name}${item.price ? ` (${item.price})` : ''}`).join('\n');
  return `Hola ROAS Ingenieros, solicito cotización para los siguientes productos:\n\n${lines}\n\nQuedo atento a su cotización. Gracias.`;
};

export const generateServiceQuoteMessage = (service: string, details: string): string => {
  return `Hola ROAS Ingenieros, estoy interesado en el servicio de ${service}. ${details}`;
};
