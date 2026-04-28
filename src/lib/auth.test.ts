import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateUsername, signUp, signIn } from "./auth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

describe("validateUsername", () => {
  it("accepts valid usernames", () => {
    expect(validateUsername("alice")).toBeNull();
    expect(validateUsername("Alice_123")).toBeNull();
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("a".repeat(20))).toBeNull();
  });

  it("rejects usernames shorter than 3 characters", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("a")).not.toBeNull();
    expect(validateUsername("")).not.toBeNull();
  });

  it("rejects usernames longer than 20 characters", () => {
    expect(validateUsername("a".repeat(21))).not.toBeNull();
  });

  it("rejects usernames with spaces", () => {
    expect(validateUsername("alice bob")).not.toBeNull();
  });

  it("rejects usernames with disallowed characters", () => {
    expect(validateUsername("alice-bob")).not.toBeNull();
    expect(validateUsername("alice.bob")).not.toBeNull();
    expect(validateUsername("alice@bob")).not.toBeNull();
  });
});

describe("signUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws before calling Supabase when username is invalid", async () => {
    await expect(signUp("user@example.com", "ab", "password123")).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("throws when username is already taken", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    await expect(signUp("user@example.com", "takenuser", "password123")).rejects.toThrow(
      "Username is already taken"
    );
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("calls supabase.auth.signUp with lowercased username when available", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "new-id" } },
      error: null,
    } as any);

    await signUp("User@Example.com", "NewUser", "password123");

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "User@Example.com",
        options: expect.objectContaining({
          data: expect.objectContaining({ username: "newuser" }),
        }),
      })
    );
  });
});

describe("signIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs in directly with email when input contains @", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: {} },
      error: null,
    } as any);

    await signIn("user@example.com", "password123");

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("looks up email via RPC when input has no @", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: "user@example.com", error: null } as any);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: {} },
      error: null,
    } as any);

    await signIn("alice", "password123");

    expect(supabase.rpc).toHaveBeenCalledWith("get_email_by_username", { _username: "alice" });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("throws when username is not found via RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "not found" },
    } as any);

    await expect(signIn("unknownuser", "password123")).rejects.toThrow(
      "No account found with that username"
    );
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
