"use client";

/**
 * The call lobby, shown after access is granted: your camera preview (or
 * the contact's avatar for a voice call), the microphone and camera
 * toggles, and Leave. Calls are not connected in this build, so the lobby
 * says so instead of pretending to ring the other person.
 */

import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { MicIcon, VideoIcon } from "@/components/ui/Icons";
import { stopStream } from "@/lib/media";
import type { ConversationDetail } from "@/lib/types";

export function CallLobby({
  conversation,
  kind,
  stream,
  onLeave,
}: {
  conversation: ConversationDetail;
  kind: "video" | "voice";
  stream: MediaStream;
  onLeave: () => void;
}) {
  const preview = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(kind === "video");

  useEffect(() => {
    if (preview.current) preview.current.srcObject = stream;
    return () => stopStream(stream);
  }, [stream]);

  useEffect(() => {
    stream.getAudioTracks().forEach((track) => (track.enabled = micOn));
  }, [stream, micOn]);

  useEffect(() => {
    stream.getVideoTracks().forEach((track) => (track.enabled = cameraOn));
  }, [stream, cameraOn]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onLeave();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onLeave]);

  const hasVideo = stream.getVideoTracks().length > 0;

  return (
    <div className="fixed inset-0 z-[66] flex flex-col bg-[#121212] text-white" role="dialog" aria-label="Call">
      <div className="flex h-14 shrink-0 items-center justify-center text-[14px] font-semibold">
        {conversation.title}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        {hasVideo && cameraOn ? (
          <video
            ref={preview}
            autoPlay
            muted
            playsInline
            className="max-h-full max-w-[860px] -scale-x-100 rounded-2xl bg-black object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar
              name={conversation.title}
              colorKey={conversation.avatar_color}
              url={conversation.avatar_url}
              size={112}
            />
            {hasVideo && <video ref={preview} autoPlay muted playsInline className="hidden" />}
            <p className="text-[13px] text-white/70">
              {kind === "video" ? "Your camera is off" : "Voice call"}
            </p>
          </div>
        )}
      </div>

      <p className="pb-3 text-center text-[12.5px] text-white/60">
        Calls aren&rsquo;t connected in this build. Your microphone{hasVideo ? " and camera are" : " is"} only
        previewed here.
      </p>

      <div className="flex shrink-0 items-center justify-center gap-4 pb-8">
        <LobbyButton label={micOn ? "Mute" : "Unmute"} active={micOn} onClick={() => setMicOn((on) => !on)}>
          <MicIcon size={20} />
        </LobbyButton>
        {hasVideo && (
          <LobbyButton
            label={cameraOn ? "Turn off camera" : "Turn on camera"}
            active={cameraOn}
            onClick={() => setCameraOn((on) => !on)}
          >
            <VideoIcon size={20} />
          </LobbyButton>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="h-11 rounded-full bg-[#e8404a] px-7 text-[14px] font-semibold text-white hover:brightness-110"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function LobbyButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={!active}
      className={`relative flex size-12 items-center justify-center rounded-full transition ${
        active ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-[#121212]"
      }`}
    >
      {children}
      {!active && <span className="absolute h-[2px] w-7 rotate-45 rounded bg-[#121212]" aria-hidden />}
    </button>
  );
}
