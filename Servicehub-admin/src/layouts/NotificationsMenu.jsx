import clsx from "clsx";
import { Bell, CheckCheck, LifeBuoy, MessageSquare, Undo2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { relativeTime } from "../lib/formatters";
import { useDismiss } from "../lib/useDismiss";

const TYPE_ICONS = {
  ticket: LifeBuoy,
  message: MessageSquare,
  refund: Undo2,
};

export function NotificationsMenu() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(containerRef, isOpen, close);

  function handleOpen(notification) {
    markRead(notification.id);
    close();
    if (notification.link) navigate(notification.link);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        data-tour="notifications"
        className="relative flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-surface"
      >
        <Bell size={16} />
        {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 flex max-h-[min(480px,calc(100vh-5rem))] w-[min(360px,calc(100vw-2rem))] flex-col rounded-card border border-border bg-surface shadow-pop"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-primary">Notifications</span>
              {unreadCount > 0 && (
                <span className="font-data rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {unreadCount}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="flex items-center gap-1 rounded-btn px-2 py-1 text-[12px] text-text-secondary hover:bg-canvas hover:text-text-primary disabled:opacity-50"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-btn px-2 py-1 text-[12px] text-text-secondary hover:bg-canvas hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell size={22} className="text-text-secondary" />
                <p className="text-[13px] text-text-secondary">You're all caught up.</p>
                <p className="max-w-60 text-[12px] text-text-secondary">
                  New tickets, customer replies and refund requests will show up here.
                </p>
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => {
                  const Icon = TYPE_ICONS[notification.type] ?? Bell;
                  return (
                    <li key={notification.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={() => handleOpen(notification)}
                        className={clsx(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas",
                          !notification.read && "bg-accent/5"
                        )}
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
                          <Icon size={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-text-primary">
                              {notification.title}
                            </span>
                            {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                          </span>
                          {notification.body && (
                            <span className="mt-0.5 line-clamp-2 block text-[12px] text-text-secondary">
                              {notification.body}
                            </span>
                          )}
                          <span className="font-data mt-1 block text-[11px] text-text-secondary">
                            {relativeTime(notification.at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
