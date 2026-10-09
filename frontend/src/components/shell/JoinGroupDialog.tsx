"use client";

/**
 * Opening a group link (this app's address with ?join=<token>): the group's
 * name, photo and size, then Join, or Request to join when the admins
 * approve new members. Someone already in the group goes straight to it.
 */

import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { DialogButton, Modal } from "@/components/ui/Modal";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { conversationApi } from "@/lib/endpoints";
import type { JoinPreview } from "@/lib/types";

export function JoinGroupDialog({
  token,
  onClose,
  onOpen,
}: {
  token: string;
  onClose: () => void;
  onOpen: (conversationId: string) => void;
}) {
  const push = useToasts((state) => state.push);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    conversationApi
      .previewLink(token)
      .then((value) => live && setPreview(value))
      .catch(
        (err: unknown) =>
          live &&
          setError(err instanceof ApiError ? err.message : "This group link is no longer valid."),
      );
    return () => {
      live = false;
    };
  }, [token]);

  async function join() {
    setBusy(true);
    try {
      const result = await conversationApi.joinLink(token);
      if (result.status === "requested") {
        push("Your request to join has been sent to the group admin.");
        onClose();
      } else {
        onClose();
        onOpen(result.conversation_id);
      }
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Could not join the group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Join group" width={320} closeButton>
      {error ? (
        <p className="py-6 text-center text-[13px] text-ink">{error}</p>
      ) : !preview ? (
        <p className="py-6 text-center text-[13px] text-ink-2">Loading…</p>
      ) : (
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={preview.title}
            colorKey={preview.avatar_color}
            url={preview.avatar_url}
            size={64}
            group
          />
          <h2 className="mt-3 text-[16px] font-semibold text-ink">{preview.title}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Group · {preview.member_count} {preview.member_count === 1 ? "member" : "members"}
          </p>
          {preview.description && (
            <p className="mt-2 text-[12.5px] text-ink">{preview.description}</p>
          )}
          {preview.requires_approval && preview.status === "none" && (
            <p className="mt-3 text-[12px] text-ink-2">
              An admin of this group must approve your request before you can join.
            </p>
          )}
          <div className="mt-5 flex w-full gap-2.5">
            <DialogButton variant="secondary" onClick={onClose}>
              Cancel
            </DialogButton>
            {preview.status === "member" ? (
              <DialogButton
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpen(preview.conversation_id);
                }}
              >
                Open
              </DialogButton>
            ) : preview.status === "requested" ? (
              <DialogButton variant="primary" disabled onClick={() => undefined}>
                Requested
              </DialogButton>
            ) : (
              <DialogButton variant="primary" disabled={busy} onClick={() => void join()}>
                {preview.requires_approval ? "Request to join" : "Join"}
              </DialogButton>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
