import { can } from "../../lib/permissions";
import { roleLabel } from "../../pages/settings/roles";

// The guided tour after sign-in, built for the signed-in role so nobody is
// shown a page they can't open. `target` is a [data-tour] anchor in the app
// shell; steps without one are centred. Steps whose anchor isn't on screen
// (a collapsed sidebar on a phone, the range picker off the dashboard) are
// left out when the tour starts.
export function buildTourSteps(user) {
  const firstName = user.name.split(" ")[0];
  const steps = [
    {
      id: "welcome",
      title: `Welcome to ServiHub, ${firstName}`,
      body: `Here's a one-minute look at what the ${roleLabel(user.role)} role can do. Skip it if you'd rather explore on your own: it's in your profile menu whenever you want it.`,
    },
    {
      id: "nav",
      target: '[data-tour="nav"]',
      placement: "right",
      title: "Your workspace",
      body: "Every page your role can open is here. Pages you don't have access to stay out of the way.",
    },
    {
      // Phones only: the sidebar sits behind this button.
      id: "menu",
      target: '[data-tour="menu-button"]',
      placement: "bottom",
      title: "Your workspace",
      body: "Open the menu to reach every page your role can use, your profile and this tour.",
    },
    {
      id: "search",
      target: '[data-tour="search"]',
      placement: "right",
      title: "Find anything fast",
      body: "Search bookings, customers and tickets by name or ID. Press Ctrl K (⌘ K on a Mac) from any page.",
    },
  ];

  if (can(user, "booking.create")) {
    steps.push({
      id: "bookings",
      target: '[data-tour="nav-/bookings"]',
      placement: "right",
      title: "Run every job",
      body: "Create bookings, assign providers, reschedule, and move work from started to completed.",
    });
  }

  if (can(user, "ticket.read")) {
    steps.push({
      id: "support",
      target: '[data-tour="nav-/support"]',
      placement: "right",
      title: "Answer customers live",
      body: "Chats arrive the moment customers write in. The AI Copilot summarises each ticket and checks refunds against your policy.",
    });
  }

  if (can(user, "refund.approve")) {
    steps.push({
      id: "refunds",
      target: '[data-tour="nav-/refunds"]',
      placement: "right",
      title: "Decide on refunds",
      body: "Approve or reject requests with a note. Whoever asked is notified as soon as you decide.",
    });
  } else if (can(user, "refund.request")) {
    steps.push({
      id: "refunds",
      target: '[data-tour="nav-/refunds"]',
      placement: "right",
      title: "Request refunds",
      body: "Ask for a refund from a booking, a ticket or here. Approvers are notified straight away.",
    });
  }

  if (can(user, "team.manage")) {
    steps.push({
      id: "team",
      target: '[data-tour="nav-/settings"]',
      placement: "right",
      title: "Manage your team",
      body: "Invite people, choose their role and disable access. Changes apply to their sessions instantly.",
    });
  }

  steps.push(
    {
      id: "notifications",
      target: '[data-tour="notifications"]',
      placement: "bottom",
      title: "Stay in the loop",
      body: "New tickets, customer replies and refund decisions appear here as they happen.",
    },
    {
      id: "range",
      target: '[data-tour="range"]',
      placement: "bottom",
      title: "Choose the period",
      body: "Switch the dashboard between today, this week and this month.",
    },
    {
      id: "account",
      target: '[data-tour="user-menu"]',
      placement: "right",
      title: "You're all set",
      body: "Your profile, password and this tour live in this menu. Replay the tour any time.",
    }
  );

  return steps;
}

export function isTargetVisible(selector) {
  if (!selector) return true;
  const el = document.querySelector(selector);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth;
}
