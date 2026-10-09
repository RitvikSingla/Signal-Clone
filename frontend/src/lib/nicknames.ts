/**
 * Nicknames you give people replace their profile name, for you only, as
 * in Signal. These helpers read them from the address book.
 */

import type { Contact } from "@/lib/types";
import { useChat } from "@/store/chat";

export function nicknameOf(contact: Contact | undefined | null): string | null {
  if (!contact) return null;
  const name = [contact.nickname, contact.nickname_family].filter(Boolean).join(" ").trim();
  return name || null;
}

/** Your nickname for this person, or null. */
export function useNickname(userId: string | null | undefined): string | null {
  return useChat((state) =>
    userId ? nicknameOf(state.contacts.find((c) => c.user.id === userId)) : null,
  );
}

/** Every nickname you have set, by user id. */
export function nicknameMap(contacts: Contact[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const contact of contacts) {
    const name = nicknameOf(contact);
    if (name) map[contact.user.id] = name;
  }
  return map;
}
