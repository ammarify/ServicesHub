import { Inbox } from "lucide-react";
import { useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { QueryError } from "../../components/ui/QueryError";
import { useAuth } from "../../context/AuthContext";
import { useSocketConnected } from "../../context/SocketContext";
import { useToast } from "../../context/ToastContext";
import { errorMessage } from "../../lib/api";
import { can } from "../../lib/permissions";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { ConversationPanel } from "./ConversationPanel";
import { CopilotPanel } from "./CopilotPanel";
import { TicketQueue } from "./TicketQueue";
import { useSupportTickets } from "./useSupportTickets";

const STATUS_TOASTS = {
  in_progress: "moved to In Progress",
  resolved: "marked resolved",
  open: "reopened",
};

export function SupportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isQueueInline = useMediaQuery("(min-width: 800px)");
  const isCopilotInline = useMediaQuery("(min-width: 1100px)");
  const isLive = useSocketConnected();
  const support = useSupportTickets({ autoSelectFirst: isQueueInline });

  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState(false);
  const [isCopilotCollapsed, setIsCopilotCollapsed] = useState(false);
  // Unsent replies per ticket, so switching tickets doesn't lose them.
  const [drafts, setDrafts] = useState({});
  const [sendErrors, setSendErrors] = useState({});

  const selectedTicket = support.selectedTicket;
  const ticketId = support.selectedTicketId;
  const draftText = drafts[ticketId] ?? "";

  function setDraftText(value) {
    setDrafts((prev) => ({ ...prev, [ticketId]: value }));
    if (sendErrors[ticketId]) setSendErrors((prev) => ({ ...prev, [ticketId]: "" }));
  }

  // The draft is only cleared once the server has the message; a failed
  // send keeps the text and says why, so nothing is silently lost.
  function handleSend(text) {
    const id = ticketId;
    setSendErrors((prev) => ({ ...prev, [id]: "" }));
    support.sendMessageMutation.mutate(text, {
      onSuccess: () => {
        setDrafts((prev) => ({ ...prev, [id]: "" }));
        support.setPulseTicketId(id);
      },
      onError: (error) => {
        setSendErrors((prev) => ({ ...prev, [id]: errorMessage(error, "Message not sent. Try again.") }));
      },
    });
  }

  function handleChangeStatus(status) {
    const code = selectedTicket.code;
    support.updateStatusMutation.mutate(status, {
      onSuccess: () => {
        toast.success(`${code} ${STATUS_TOASTS[status]}.`);
        support.setPulseTicketId(ticketId);
      },
      onError: (error) => toast.error(errorMessage(error, "Couldn't update the ticket.")),
    });
  }

  function handleEscalate() {
    const code = selectedTicket.code;
    support.updatePriorityMutation.mutate("high", {
      onSuccess: () => toast.success(`${code} escalated to high priority.`),
      onError: (error) => toast.error(errorMessage(error, "Couldn't escalate the ticket.")),
    });
  }

  function handleSelectTicket(id) {
    support.selectTicket(id);
    if (!isQueueInline) setIsQueueDrawerOpen(false);
  }

  const queueContent = (
    <TicketQueue
      tickets={support.tickets}
      openCount={support.openCount}
      activeTab={support.activeTab}
      onTabChange={support.setActiveTab}
      selectedTicketId={ticketId}
      onSelectTicket={handleSelectTicket}
      pulseTicketId={support.pulseTicketId}
      isLoading={support.isQueueLoading}
      isError={support.isQueueError}
      onRetry={support.refetchQueue}
      hasMore={support.hasMoreTickets}
      onLoadMore={() => support.loadMoreTickets()}
      isLoadingMore={support.isLoadingMore}
    />
  );

  function renderMainPane() {
    if (support.isTicketError) {
      const notFound = support.ticketError?.response?.status === 404;
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-canvas">
          <QueryError
            message={notFound ? "This ticket doesn't exist." : "Couldn't load this ticket."}
            onRetry={notFound ? undefined : support.refetchTicket}
          />
        </div>
      );
    }

    if (ticketId && (support.isTicketLoading || !selectedTicket)) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-canvas text-text-secondary">
          <p className="text-[13px]">Loading ticket…</p>
        </div>
      );
    }

    if (!selectedTicket) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-canvas text-text-secondary">
          <Inbox size={28} />
          <p className="text-[13px]">Select a ticket to see the conversation</p>
          {!isQueueInline && (
            <button
              type="button"
              onClick={() => setIsQueueDrawerOpen(true)}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              Open the queue
            </button>
          )}
        </div>
      );
    }

    return (
      <ConversationPanel
        ticket={selectedTicket}
        draftText={draftText}
        onDraftChange={setDraftText}
        onSend={handleSend}
        isSending={support.sendMessageMutation.isPending}
        sendError={sendErrors[ticketId]}
        onTyping={support.emitTyping}
        typingFrom={support.typingFrom}
        canReply={can(user, "ticket.reply")}
        canResolve={can(user, "ticket.resolve")}
        onChangeStatus={handleChangeStatus}
        onEscalate={handleEscalate}
        isUpdating={support.updateStatusMutation.isPending || support.updatePriorityMutation.isPending}
        isLive={isLive}
        onOpenQueue={!isQueueInline ? () => setIsQueueDrawerOpen(true) : undefined}
        onOpenCopilot={!isCopilotInline ? () => setIsCopilotDrawerOpen(true) : undefined}
      />
    );
  }

  return (
    <div className="flex h-full">
      {isQueueInline ? (
        <div className="h-full w-75 shrink-0 border-r border-border">{queueContent}</div>
      ) : (
        <Drawer
          side="left"
          open={isQueueDrawerOpen}
          onClose={() => setIsQueueDrawerOpen(false)}
          widthClassName="max-w-xs"
          padded={false}
          ariaLabel="Ticket queue"
        >
          {queueContent}
        </Drawer>
      )}

      {renderMainPane()}

      {selectedTicket && isCopilotInline && (
        <CopilotPanel
          ticket={selectedTicket}
          onInsertReply={setDraftText}
          collapsible
          isCollapsed={isCopilotCollapsed}
          onToggleCollapse={() => setIsCopilotCollapsed((prev) => !prev)}
        />
      )}

      {selectedTicket && !isCopilotInline && (
        <Drawer
          open={isCopilotDrawerOpen}
          onClose={() => setIsCopilotDrawerOpen(false)}
          widthClassName="max-w-sm"
          padded={false}
          ariaLabel="AI Copilot"
        >
          <CopilotPanel
            ticket={selectedTicket}
            onInsertReply={(text) => {
              setDraftText(text);
              setIsCopilotDrawerOpen(false);
            }}
          />
        </Drawer>
      )}
    </div>
  );
}
