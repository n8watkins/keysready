"use client";

// Reusable in-app chat for a booking thread. Used by BOTH sides:
//   <MessageThread bookingRef={ref} />
// It figures out who "you" are from /api/messages (staff -> 'shop', driver ->
// 'driver') and aligns/labels bubbles accordingly. Polls every 4s while mounted.

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  bookingRef: string;
}

type You = "shop" | "driver";

interface ChatMessage {
  id: string;
  sender: "shop" | "driver";
  body: string;
  createdAt: string;
}

const POLL_MS = 4000;
const MAX_BODY = 2000;

function otherLabel(you: You): string {
  // From a shop's view the other party is the customer; from a driver's, the shop.
  return you === "shop" ? "Customer" : "Shop";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const SESSION_EXPIRED = "Your session expired — refresh to sign in";
const THREAD_GONE = "This conversation is no longer available.";

export default function MessageThread({ bookingRef }: Props) {
  const [you, setYou] = useState<You | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>("");
  // Once the session is gone there's no point polling 401s forever; stop the
  // interval and tell the user to refresh.
  const [expired, setExpired] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  // Held so a 401 from either the poll or a send can clear the interval.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Centralized handling of an expired session: stop polling and surface a
  // persistent message (overrides transient errors).
  const handleExpired = useCallback(() => {
    setExpired(true);
    setLoadError(SESSION_EXPIRED);
    stopPolling();
  }, [stopPolling]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/messages?ref=${encodeURIComponent(bookingRef)}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        // Session expired — stop polling 401s and tell the user to refresh.
        handleExpired();
        return;
      }
      if (res.status === 404) {
        // The thread/booking is gone for good — a transient retry won't help.
        setLoadError(THREAD_GONE);
        return;
      }
      if (!res.ok) {
        // Transient (5xx, network) — surface only on first load so the thread
        // doesn't flicker an error every 4s; keep polling.
        setLoaded((prev) => {
          if (!prev) setLoadError("Couldn't load messages.");
          return prev;
        });
        return;
      }
      const data = (await res.json()) as { you: You; messages: ChatMessage[] };
      setYou(data.you);
      setMessages(data.messages ?? []);
      setLoadError("");
      setLoaded(true);
    } catch {
      setLoaded((prev) => {
        if (!prev) setLoadError("Couldn't load messages.");
        return prev;
      });
    }
  }, [bookingRef, handleExpired]);

  // Poll on mount + every 4s while mounted.
  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => stopPolling();
  }, [refresh, stopPolling]);

  // Auto-scroll to newest whenever a new message id appears.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.id !== lastIdRef.current) {
      lastIdRef.current = last.id;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Parameterless send shared by the form submit and the Enter-key handler, so
  // neither has to forward a FormEvent/KeyboardEvent (which don't share a type).
  const doSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || expired) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: bookingRef, body }),
      });
      if (res.status === 401) {
        // Session expired mid-send — stop polling and surface it.
        handleExpired();
        setSendError(SESSION_EXPIRED);
        return;
      }
      if (res.status === 404) {
        setSendError(THREAD_GONE);
        return;
      }
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setSendError(msg.error || "Couldn't send your message.");
        return;
      }
      setDraft("");
      await refresh();
    } catch {
      setSendError("Couldn't send your message. Check your connection.");
    } finally {
      setSending(false);
    }
  }, [draft, sending, expired, bookingRef, handleExpired, refresh]);

  const canSend = draft.trim().length > 0 && !sending && !expired;

  return (
    <section
      className="flex flex-col rounded-2xl border border-neutral-200 bg-white"
      aria-label="Messages"
    >
      <div
        ref={scrollRef}
        className="flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
        aria-busy={!loaded}
      >
        {!loaded && !loadError && (
          <p className="m-auto text-sm text-neutral-400">Loading…</p>
        )}
        {loadError && (
          <p className="m-auto text-sm text-red-600" role="alert">
            {loadError}
          </p>
        )}
        {loaded && !loadError && messages.length === 0 && (
          <p className="m-auto text-sm text-neutral-400">
            No messages yet — say hi
          </p>
        )}
        {loaded &&
          you &&
          messages.map((m) => {
            const mine = m.sender === you;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="px-1 text-xs font-medium text-neutral-500">
                  {mine ? "You" : otherLabel(you)}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-brand text-white"
                      : "rounded-bl-sm bg-neutral-100 text-neutral-900"
                  }`}
                >
                  {m.body}
                </div>
                <time
                  className="px-1 text-[11px] text-neutral-400"
                  dateTime={m.createdAt}
                >
                  {formatTime(m.createdAt)}
                </time>
              </div>
            );
          })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSend();
        }}
        className="flex items-end gap-2 border-t border-neutral-200 p-3"
      >
        <label htmlFor="message-input" className="sr-only">
          Type a message
        </label>
        <textarea
          id="message-input"
          name="message"
          rows={1}
          value={draft}
          maxLength={MAX_BODY}
          disabled={expired}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void doSend();
            }
          }}
          placeholder="Type a message…"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:bg-neutral-50 disabled:text-neutral-400"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-brand px-4 py-2 text-base font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {sendError && (
        <p className="px-3 pb-3 text-sm text-red-600" role="alert">
          {sendError}
        </p>
      )}
    </section>
  );
}
