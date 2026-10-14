import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { QueryError } from "../../components/ui/QueryError";
import { useNotifications } from "../../context/NotificationContext";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { ConversationPanel } from "./ConversationPanel";
import { CopilotPanel } from "./CopilotPanel";
import { TicketQueue } from "./TicketQueue";
import { useSupportTickets } from "./useSupportTickets";

export function SupportPage() {
  const support = useSupportTickets();
  const { clearNewTicket } = useNotifications();
  useEffect(() => {
    clearNewTicket();
  }, [clearNewTicket]);
  const isQueueInline = useMediaQuery("(min-width: 800px)");
  const isCopilotInline = useMediaQuery("(min-width: 1100px)");

  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState(false);
  const [isCopilotCollapsed, setIsCopilotCollapsed] = useState(false);
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    if (isQueueInline) setIsQueueDrawerOpen(false);
  }, [isQueueInline]);

  useEffect(() => {
    if (isCopilotInline) setIsCopilotDrawerOpen(false);
  }, [isCopilotInline]);

  const selectedTicket = support.selectedTicket;
  const draftText = drafts[support.selectedTicketId] ?? "";

  function setDraftText(value) {
    setDrafts((prev) => ({ ...prev, [support.selectedTicketId]: value }));
  }

  function handleSend(text) {
    support.sendMessage(support.selectedTicketId, text);
    setDraftText("");
  }

  function handleSelectTicket(id) {
    support.selectTicket(id);
    if (!isQueueInline) setIsQueueDrawerOpen(false);
  }

  const queueContent = (
    <TicketQueue
      tickets={support.filteredTickets}
      openCount={support.openCount}
      activeTab={support.activeTab}
      onTabChange={support.setActiveTab}
      selectedTicketId={support.selectedTicketId}
      onSelectTicket={handleSelectTicket}
      pulseTicketId={support.pulseTicketId}
      isLoading={support.isQueueLoading}
      isError={support.isQueueError}
      onRetry={support.refetchQueue}
    />
  );

  function renderMainPane() {
    if (support.isTicketError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-canvas">
          <QueryError message="Couldn't load this ticket." onRetry={support.refetchTicket} />
        </div>
      );
    }

    if (support.selectedTicketId && (support.isTicketLoading || !selectedTicket)) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-canvas text-text-secondary">
          <p className="text-[13px]">Loading ticket…</p>
        </div>
      );
    }

    if (!selectedTicket) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-canvas text-text-secondary">
          <Inbox size={28} />
          <p className="text-[13px]">No ticket selected</p>
        </div>
      );
    }

    return (
      <ConversationPanel
        ticket={selectedTicket}
        draftText={draftText}
        onDraftChange={setDraftText}
        onSend={handleSend}
        onTyping={support.emitTyping}
        typingFrom={support.typingFrom}
        onMarkResolved={() => support.markResolved(selectedTicket._id)}
        onEscalate={() => support.escalate(selectedTicket._id)}
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
        >
          <CopilotPanel ticket={selectedTicket} onInsertReply={setDraftText} />
        </Drawer>
      )}
    </div>
  );
}
