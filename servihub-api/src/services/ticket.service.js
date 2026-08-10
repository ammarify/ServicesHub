// Kept separate from the controllers so a future Socket.IO layer can
// import appendMessage directly (or wrap it to emit after the save)
// without the controllers needing to know sockets exist.
export function appendMessage(ticket, { from, senderName, text }) {
  ticket.messages.push({ from, senderName, text, at: new Date() });
  return ticket.messages[ticket.messages.length - 1];
}
