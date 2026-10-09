"use client";

/**
 * The profile step for a brand-new account: photo, display name, username
 * and about. Without a photo, the colour swatches pick the initials avatar.
 *
 * Uploads need a finished account, so the photo is held locally and sent
 * straight after the profile is saved.
 */

import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { uploadAttachment, userApi } from "@/lib/endpoints";
import { useSession } from "@/store/session";

const SWATCHES = [
  "A100",
  "A110",
  "A120",
  "A130",
  "A140",
  "A150",
  "A160",
  "A170",
  "A180",
  "A190",
  "A200",
  "A210",
];

export function ProfileSetup() {
  const { completeProfile, signOut, patchUser } = useSession();
  const push = useToasts((state) => state.push);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [color, setColor] = useState("A210");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await completeProfile({
        display_name: displayName.trim(),
        username: username.trim() || null,
        about: about.trim() || null,
        avatar_color: color,
      });
      if (photo) {
        try {
          const attachment = await uploadAttachment(photo.file, () => undefined);
          const user = await userApi.updateProfile({
            avatar_url: attachment.thumbnail_url ?? attachment.url,
          });
          patchUser(user);
        } catch {
          push("Your profile is saved, but the photo did not upload. Add it in Settings.");
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-surface-raised px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[22px] font-semibold tracking-tight text-ink">
          Set up your profile
        </h1>
        <p className="mt-1 text-center text-[13px] text-ink-2">
          This is what other people will see.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex justify-center">
            <PhotoPicker
              value={photo?.preview ?? null}
              size={80}
              label={photo ? "Change profile photo" : "Add profile photo"}
              fallback={<Avatar name={displayName || "?"} colorKey={color} size={80} />}
              onFile={(file, preview) => {
                if (photo) URL.revokeObjectURL(photo.preview);
                setPhoto({ file, preview });
              }}
              onRemove={() => {
                if (photo) URL.revokeObjectURL(photo.preview);
                setPhoto(null);
              }}
            />
          </div>

          <div className={`flex flex-wrap justify-center gap-2 ${photo ? "hidden" : ""}`}>
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Avatar colour ${swatch}`}
                aria-pressed={color === swatch}
                className={`size-6 rounded-full ring-offset-2 ring-offset-surface transition-shadow ${
                  color === swatch ? "ring-2 ring-ultramarine" : ""
                }`}
                style={{ background: `var(--${swatch.toLowerCase()})` }}
              />
            ))}
          </div>

          <Field
            id="display-name"
            label="Display name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Your name"
            required
          />
          <Field
            id="username"
            label="Username"
            hint="Optional. Lets people find you without your number."
            value={username}
            onChange={setUsername}
            placeholder="yourname"
          />
          <Field
            id="about"
            label="About"
            hint="Optional."
            value={about}
            onChange={setAbout}
            placeholder="A short line about you"
          />

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || displayName.trim().length === 0}
            className="h-10 rounded-full bg-ultramarine text-[14px] font-medium text-white transition-colors hover:bg-ultramarine-hover disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-[13px] text-ink-3 hover:text-ink"
          >
            Use a different number
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-border bg-surface-sunken px-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
      />
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}
