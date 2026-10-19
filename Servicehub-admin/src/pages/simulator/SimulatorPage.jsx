import clsx from "clsx";
import { ArrowLeft, FlaskConical, MessageSquarePlus, Moon, SendHorizontal, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { TypingDots } from "../../components/ui/TypingDots";
import { useTheme } from "../../context/ThemeContext";
import { api, errorMessage } from "../../lib/api";
import { formatTime } from "../../lib/formatters";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useSimulatorSocket } from "./useSimulatorSocket";

const PRIORITIES = ["low", "medium", "high"];

function appendUnique(messages, message) {
  const exists = messages.some((m) => m.from === message.from && m.text === message.text && m.at === message.at);
  return exists ? messages : [...messages, message];
}

export function SimulatorPage() {
  useDocumentTitle("Customer simulator");
  const { theme, toggleTheme } = useTheme();
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

  // { ticket, token } for the open conversation.
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const threadRef = useRef(null);
  const socket = useSimulatorSocket();
  const activeTicketId = active?.ticket._id;

  useEffect(() => {
    let cancelled = false;
    api
      .get("/tickets/simulator/options")
      .then((res) => {
        if (!cancelled) setCustomers(res.data.customers);
      })
      .catch((error) => {
        if (cancelled) return;
        setOptionsError(
          error.response?.status === 404
            ? "The customer simulator is turned off on this server (DEMO_MODE is disabled)."
            : "Couldn't load demo customers. Is the API running?"
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { onMessage, onTicketUpdated } = socket;
  useEffect(() => {
    if (!activeTicketId) return undefined;
    const stopMessages = onMessage((payload) => {
      if (payload.ticketId !== activeTicketId) return;
      setMessages((prev) => appendUnique(prev, payload.message));
    });
    const stopUpdates = onTicketUpdated((payload) => {
      if (payload.ticketId !== activeTicketId) return;
      setActive((prev) => (prev ? { ...prev, ticket: { ...prev.ticket, status: payload.status } } : prev));
    });
    return () => {
      stopMessages();
      stopUpdates();
    };
  }, [activeTicketId, onMessage, onTicketUpdated]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, socket.typingFrom]);

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
    if (active) socket.leaveTicket(active.ticket._id);
    setActive(null);
    setMessages([]);
    setDraft("");
    setSendError("");
    resetPicker();
  }

  async function openConversation({ ticket, token }) {
    setActive({ ticket, token });
    setMessages(ticket.messages);
    try {
      await socket.joinTicket(ticket._id, token);
    } catch (error) {
      setSendError(error.message);
    }
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
      await openConversation(res.data);
    } catch (error) {
      setFormError(errorMessage(error, "Couldn't start the ticket."));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleContinueTicket(ticketRef) {
    setFormError("");
    setIsStarting(true);
    try {
      const res = await api.post("/tickets/simulator/session", {
        customerId: selectedCustomerId,
        ticketId: ticketRef.id,
      });
      await openConversation(res.data);
    } catch (error) {
      setFormError(errorMessage(error, "Couldn't load that ticket."));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    setSendError("");
    setIsSending(true);
    try {
      const message = await socket.sendMessage(active.ticket._id, text);
      setMessages((prev) => appendUnique(prev, message));
      setDraft("");
    } catch (error) {
      setSendError(error.message);
    } finally {
      setIsSending(false);
    }
  }

  const customerName = selectedCustomer?.name ?? "";

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-[13px] font-semibold">ServiHub</span>
            <span className="inline-flex items-center gap-1.5 rounded-btn border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              <FlaskConical size={12} aria-hidden="true" />
              Demo customer simulator
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-8 w-8 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-start lg:py-12">
        <section className="flex flex-col gap-4 lg:pt-4">
          <h1 className="text-balance text-[22px] font-semibold leading-snug">Play the customer to try live support.</h1>
          <p className="max-w-[480px] text-[13px] leading-relaxed text-text-secondary">
            This page stands in for the chat widget customers would see on the ServiHub website. Messages you send here
            reach the Support inbox of the admin app instantly, and agent replies come back the same way.
          </p>
          <ol className="flex max-w-[480px] flex-col gap-3 text-[13px] text-text-secondary">
            <li className="flex gap-3">
              <span className="font-data flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold text-accent">1</span>
              Pick a demo customer, then continue one of their open tickets or start a new one.
            </li>
            <li className="flex gap-3">
              <span className="font-data flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold text-accent">2</span>
              Open the admin app as a support agent in another window and reply from Support.
            </li>
            <li className="flex gap-3">
              <span className="font-data flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold text-accent">3</span>
              Watch typing indicators and replies arrive live on both sides.
            </li>
          </ol>
        </section>

        <section
          aria-label="Customer chat"
          className="flex h-[640px] max-h-[calc(100vh-7rem)] min-h-[520px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            {active && (
              <button
                type="button"
                onClick={handleStartOver}
                aria-label="Start over"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Logo size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{active ? active.ticket.subject : "ServiHub Support"}</div>
              <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                {active ? (
                  <>
                    <span className="font-data">{active.ticket.code}</span>
                    <StatusBadge status={active.ticket.status} />
                  </>
                ) : (
                  <>
                    <span className="animate-live h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    Our team usually replies in a few minutes
                  </>
                )}
              </div>
            </div>
          </div>

          {socket.connectionError && (
            <p role="alert" className="shrink-0 border-b border-border bg-danger/5 px-4 py-2 text-[12px] text-danger">
              {socket.connectionError}
            </p>
          )}

          {!active ? (
            <div className="flex-1 overflow-y-auto p-4">
              <FormField label="Chat as">
                {isLoadingOptions ? (
                  <Select disabled>
                    <option>Loading customers…</option>
                  </Select>
                ) : (
                  <Select
                    value={selectedCustomerId}
                    onChange={(event) => {
                      setSelectedCustomerId(event.target.value);
                      setSelectedBookingId("");
                      setFormError("");
                    }}
                    disabled={Boolean(optionsError)}
                  >
                    <option value="">Pick a demo customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              {optionsError && (
                <p role="alert" className="mt-2 text-[12px] text-danger">
                  {optionsError}
                </p>
              )}

              {selectedCustomer && (
                <div className="mt-5 flex flex-col gap-5">
                  {selectedCustomer.openTickets.length > 0 && (
                    <div>
                      <div className="mb-2 text-[12px] font-medium text-text-secondary">Continue a conversation</div>
                      <div className="flex flex-col gap-2">
                        {selectedCustomer.openTickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            disabled={isStarting}
                            onClick={() => handleContinueTicket(ticket)}
                            className="flex items-center gap-3 rounded-card border border-border p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50"
                          >
                            <Avatar name={customerName} size={30} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium">{ticket.subject}</span>
                              <span className="font-data text-[11px] text-text-secondary">{ticket.code}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleStartTicket} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                      <MessageSquarePlus size={14} aria-hidden="true" />
                      {selectedCustomer.openTickets.length > 0 ? "Or start a new conversation" : "Start a conversation"}
                    </div>
                    <FormField label="About booking">
                      <Select value={selectedBookingId} onChange={(event) => setSelectedBookingId(event.target.value)}>
                        <option value="">Pick a booking</option>
                        {selectedCustomer.bookings.map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.code}, {booking.service}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <fieldset>
                      <legend className="mb-1.5 block text-[13px] text-text-secondary">How urgent is it?</legend>
                      <div className="grid grid-cols-3 rounded-btn border border-border bg-canvas p-0.5">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={priority === p}
                            onClick={() => setPriority(p)}
                            className={clsx(
                              "rounded-btn px-2 py-1 text-[12px] capitalize transition-colors",
                              priority === p ? "bg-surface font-medium text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <FormField label="Subject">
                      <Input
                        value={subject}
                        maxLength={200}
                        onChange={(event) => setSubject(event.target.value)}
                        placeholder="e.g. AC still not cooling"
                      />
                    </FormField>
                    <FormField label="Message">
                      <Textarea
                        value={firstMessage}
                        maxLength={2000}
                        onChange={(event) => setFirstMessage(event.target.value)}
                        rows={3}
                        placeholder="Describe what went wrong…"
                      />
                    </FormField>

                    {formError && (
                      <p role="alert" className="text-[12px] text-danger">
                        {formError}
                      </p>
                    )}

                    <Button type="submit" variant="primary" className="justify-center" disabled={isStarting}>
                      {isStarting ? "Starting…" : "Start chat"}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <>
              <div ref={threadRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-4" role="log" aria-live="polite">
                {messages.map((message, index) => {
                  const mine = message.from === "customer";
                  return (
                    <div
                      key={`${message.at}-${index}`}
                      className={clsx("flex max-w-[85%] flex-col gap-1", mine ? "items-end self-end" : "items-start self-start")}
                    >
                      {!mine && <span className="px-1 text-[11px] font-medium text-text-secondary">{message.senderName}</span>}
                      <div
                        className={clsx(
                          "whitespace-pre-wrap break-words rounded-card px-3.5 py-2 text-[13px] leading-relaxed",
                          mine ? "rounded-br-none bg-accent text-white" : "rounded-bl-none border border-border bg-surface"
                        )}
                      >
                        {message.text}
                      </div>
                      <span className="font-data px-1 text-[10px] text-text-secondary">{formatTime(message.at)}</span>
                    </div>
                  );
                })}
                {socket.typingFrom === "agent" && (
                  <div className="flex items-center gap-2 self-start">
                    <div className="rounded-card rounded-bl-none border border-border bg-surface px-3.5 py-3 text-text-secondary">
                      <TypingDots />
                    </div>
                    <span className="text-[11px] text-text-secondary">Support is typing</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="flex shrink-0 items-center gap-2 border-t border-border p-3">
                <Input
                  value={draft}
                  maxLength={2000}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    socket.emitTyping(active.ticket._id);
                  }}
                  placeholder="Write a message…"
                  aria-label="Message"
                  className="h-10"
                />
                <Button
                  type="submit"
                  variant="primary"
                  aria-label="Send message"
                  disabled={isSending || !draft.trim()}
                  className="h-10 justify-center px-3"
                >
                  <SendHorizontal size={16} />
                </Button>
              </form>
              {sendError && (
                <p role="alert" className="shrink-0 px-3 pb-3 text-[12px] text-danger">
                  {sendError}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
