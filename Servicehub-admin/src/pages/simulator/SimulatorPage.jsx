import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useSimulatorSocket } from "./useSimulatorSocket";

const PRIORITIES = ["low", "medium", "high"];

export function SimulatorPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("medium");
  const [firstMessage, setFirstMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [formError, setFormError] = useState("");

  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const threadRef = useRef(null);
  const socket = useSimulatorSocket();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/tickets/simulator/options")
      .then((res) => {
        if (!cancelled) setCustomers(res.data.customers);
      })
      .catch(() => {
        if (!cancelled) setOptionsError("Couldn't load demo customers. Is the API running?");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeTicket) return undefined;
    const unsubscribe = socket.onMessage((payload) => {
      if (payload.ticketId !== activeTicket._id) return;
      setMessages((prev) => [...prev, payload.message]);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicket?._id]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

  function resetPicker() {
    setSelectedCustomerId("");
    setSelectedBookingId("");
    setSubject("");
    setPriority("medium");
    setFirstMessage("");
    setFormError("");
  }

  function handleStartOver() {
    if (activeTicket) socket.leaveTicket(activeTicket._id);
    setActiveTicket(null);
    setMessages([]);
    resetPicker();
  }

  async function handleStartTicket(event) {
    event.preventDefault();
    setFormError("");
    if (!selectedBookingId || !subject.trim() || !firstMessage.trim()) {
      setFormError("Pick a booking, and fill in a subject and message.");
      return;
    }
    setIsStarting(true);
    try {
      const res = await api.post("/tickets", {
        customerId: selectedCustomerId,
        bookingId: selectedBookingId,
        subject: subject.trim(),
        text: firstMessage.trim(),
        priority,
      });
      const ticket = res.data.ticket;
      setActiveTicket(ticket);
      setMessages(ticket.messages);
      socket.joinTicket(ticket._id);
    } catch (error) {
      setFormError(error.response?.data?.message ?? "Couldn't start the ticket.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleContinueTicket(ticketRef) {
    setFormError("");
    setIsStarting(true);
    try {
      const res = await api.get(`/tickets/simulator/${ticketRef.id}`);
      const ticket = res.data.ticket;
      setActiveTicket(ticket);
      setMessages(ticket.messages);
      socket.joinTicket(ticket._id);
    } catch (error) {
      setFormError(error.response?.data?.message ?? "Couldn't load that ticket.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeTicket) return;
    setSendError("");
    setIsSending(true);
    try {
      await socket.sendMessage(activeTicket._id, text);
      setDraft("");
    } catch (error) {
      setSendError(error.message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-mono text-[13px] text-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 border-2 border-dashed border-gray-400 bg-yellow-50 p-3">
          <div className="text-[15px] font-bold">Demo Customer Simulator</div>
          <p className="mt-1 text-gray-600">
            This is a test harness for the live support demo — it is not part of the admin panel
            and has no login. It stands in for a real customer-facing chat widget.
          </p>
        </div>

        {!activeTicket ? (
          <div className="flex flex-col gap-4">
            <div className="border border-gray-300 bg-white p-4">
              <label className="block font-bold" htmlFor="customer-select">
                1. Pick a customer
              </label>
              {isLoadingOptions ? (
                <p className="mt-2 text-gray-500">Loading…</p>
              ) : optionsError ? (
                <p className="mt-2 text-red-600">{optionsError}</p>
              ) : (
                <select
                  id="customer-select"
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value);
                    setSelectedBookingId("");
                    setFormError("");
                  }}
                  className="mt-2 w-full border border-gray-400 bg-white p-2"
                >
                  <option value="">— select a customer —</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedCustomer && (
              <>
                {selectedCustomer.openTickets.length > 0 && (
                  <div className="border border-gray-300 bg-white p-4">
                    <div className="font-bold">2a. Continue an existing open ticket</div>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {selectedCustomer.openTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          disabled={isStarting}
                          onClick={() => handleContinueTicket(ticket)}
                          className="border border-gray-400 bg-gray-50 p-2 text-left hover:bg-gray-200 disabled:opacity-50"
                        >
                          <span className="text-gray-500">{ticket.code}</span> — {ticket.subject}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border border-gray-300 bg-white p-4">
                  <div className="font-bold">
                    {selectedCustomer.openTickets.length > 0 ? "2b. Or start" : "2. Start"} a new
                    ticket
                  </div>
                  <form onSubmit={handleStartTicket} className="mt-2 flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1">
                      Booking
                      <select
                        value={selectedBookingId}
                        onChange={(event) => setSelectedBookingId(event.target.value)}
                        className="border border-gray-400 bg-white p-2"
                      >
                        <option value="">— select a booking —</option>
                        {selectedCustomer.bookings.map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.code} — {booking.service}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      Priority
                      <select
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                        className="border border-gray-400 bg-white p-2"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      Subject
                      <input
                        type="text"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        placeholder="e.g. AC still not cooling"
                        className="border border-gray-400 bg-white p-2"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      Message
                      <textarea
                        value={firstMessage}
                        onChange={(event) => setFirstMessage(event.target.value)}
                        rows={3}
                        placeholder="Describe the issue…"
                        className="border border-gray-400 bg-white p-2"
                      />
                    </label>

                    {formError && <p className="text-red-600">{formError}</p>}

                    <button
                      type="submit"
                      disabled={isStarting}
                      className="w-fit border border-blue-700 bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isStarting ? "Starting…" : "Start ticket"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col border border-gray-300 bg-white">
            <div className="flex items-center justify-between border-b border-gray-300 bg-gray-50 p-3">
              <div>
                <div className="font-bold">{activeTicket.subject}</div>
                <div className="text-gray-500">
                  {activeTicket.code} · {activeTicket.status}
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartOver}
                className="border border-gray-400 bg-white px-2 py-1 hover:bg-gray-200"
              >
                Start over
              </button>
            </div>

            {socket.typingFrom === "agent" && (
              <div className="border-b border-gray-300 bg-gray-50 px-3 py-1 text-gray-500">
                Agent is typing…
              </div>
            )}

            <div ref={threadRef} className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.from === "customer"
                      ? "ml-auto max-w-[75%] border border-blue-300 bg-blue-50 p-2"
                      : "mr-auto max-w-[75%] border border-gray-300 bg-gray-50 p-2"
                  }
                >
                  <div className="text-gray-500">{message.senderName}</div>
                  <div>{message.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-300 p-3">
              <input
                type="text"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  socket.emitTyping(activeTicket._id);
                }}
                placeholder="Type a message…"
                className="flex-1 border border-gray-400 bg-white p-2"
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="border border-blue-700 bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
            {sendError && <p className="border-t border-gray-300 p-2 text-red-600">{sendError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
