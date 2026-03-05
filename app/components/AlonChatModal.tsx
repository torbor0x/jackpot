"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function AlonChatModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <button type="button" className="chat-trigger" onClick={() => setOpen(true)}>
        check chat from stacc leaks
      </button>

      {open && mounted
        ? createPortal(
            <div className="chat-modal-backdrop" role="dialog" aria-modal="true" aria-label="Alon chat">
              <div className="chat-modal-card">
                <div className="chat-modal-head">
                  <p>Requested by Alon (internal chats)</p>
                  <button
                    type="button"
                    className="chat-close"
                    aria-label="Close chat image"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <img src="/alon.png" alt="Alon chat screenshot" className="chat-modal-image" />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
