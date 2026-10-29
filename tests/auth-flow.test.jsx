import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "../src/pages/AuthPage";

const h = vi.hoisted(() => ({
  calls: [],
  google: false,
  signInError: null,
  codeError: null,
  sendError: null,
}));

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    status: "ready",
    sessionExpired: false,
    signIn: async (c) => {
      h.calls.push(["signIn", c]);
      if (h.signInError) throw new Error(h.signInError);
    },
    signUp: async (d) => {
      h.calls.push(["signUp", d]);
      return { needsConfirmation: true };
    },
    verifyCode: async (d) => {
      h.calls.push(["verify", d]);
      if (h.codeError) throw new Error(h.codeError);
    },
  }),
}));

// The page's decorative intro animation (GSAP) is switched off here: these tests are about the
// sign-in steps, and in jsdom the animation shuffles the page's elements, which drops the
// typing focus now and then.
vi.mock("../src/lib/animations", () => ({
  playAuthIntro: () => () => {},
}));

vi.mock("../src/services/api", () => ({
  backendMode: "supabase",
  api: {
    capabilities: { auth: true },
    authProviders: async () => ({ google: h.google }),
    sendEmailCode: async (email) => {
      h.calls.push(["sendCode", email]);
      if (h.sendError) throw new Error(h.sendError);
    },
    signInWithGoogle: async () => {
      h.calls.push(["google"]);
    },
    sendPasswordReset: async (email) => {
      h.calls.push(["reset", email]);
    },
  },
}));

const ID = "aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb";
const SLOW = { timeout: 4000 }; // the screen fades between steps
const mount = (url = "/login") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AuthPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  h.calls = [];
  h.google = false;
  h.signInError = h.codeError = h.sendError = null;
});

async function toMethodStep(user, email = "pal@example.com") {
  await user.type(await screen.findByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: /^continue$/i }));
  await screen.findByLabelText("Password", {}, SLOW);
}

describe("signing in, one step at a time", () => {
  it("asks for the email first, then the password", async () => {
    const user = userEvent.setup();
    mount();
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    await toMethodStep(user);
    expect(screen.getByText("pal@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() =>
      expect(h.calls).toContainEqual([
        "signIn",
        { email: "pal@example.com", password: "correct horse" },
      ]),
    );
  });

  it("checks the email before moving on, and lets you change it", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await screen.findByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "pal@example.com");
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    await screen.findByLabelText("Password", {}, SLOW);
    await user.click(screen.getByRole("button", { name: /change/i }));
    expect(await screen.findByLabelText("Email")).toHaveValue(
      "pal@example.com",
    );
  });

  it("shows a wrong password plainly", async () => {
    h.signInError = "Invalid login credentials";
    const user = userEvent.setup();
    mount();
    await toMethodStep(user);
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /email and password don’t match/i,
    );
  });

  it("leads to the password reset from the password step", async () => {
    const user = userEvent.setup();
    mount();
    await toMethodStep(user);
    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    // the email is kept, so they only press the button
    expect(await screen.findByLabelText("Email")).toHaveValue(
      "pal@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    await screen.findByText(/check your inbox/i);
    expect(h.calls).toContainEqual(["reset", "pal@example.com"]);
  });
});

describe("signing in with an emailed code", () => {
  async function toCodeStep(user) {
    await toMethodStep(user);
    await user.click(
      screen.getByRole("button", { name: /email me a sign-in code/i }),
    );
    await screen.findByLabelText("Sign-in code", {}, SLOW);
  }

  it("sends a code, takes only digits, and signs in", async () => {
    const user = userEvent.setup();
    mount();
    await toCodeStep(user);
    expect(h.calls).toContainEqual(["sendCode", "pal@example.com"]);
    expect(
      screen.getByText(/we sent a code to pal@example.com/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Sign-in code"), "12ab34");
    expect(screen.getByLabelText("Sign-in code")).toHaveValue("1234");
    await user.click(screen.getByRole("button", { name: /verify code/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/digits only/i);

    await user.type(screen.getByLabelText("Sign-in code"), "56");
    await user.click(screen.getByRole("button", { name: /verify code/i }));
    await waitFor(() =>
      expect(h.calls).toContainEqual([
        "verify",
        { email: "pal@example.com", token: "123456" },
      ]),
    );
  });

  it("says so when the code is wrong or has expired", async () => {
    h.codeError = "Token has expired or is invalid";
    const user = userEvent.setup();
    mount();
    await toCodeStep(user);
    await user.type(screen.getByLabelText("Sign-in code"), "000000");
    await user.click(screen.getByRole("button", { name: /verify code/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /wrong or has expired/i,
    );
  });

  it("makes you wait before asking again, and can go back to the password", async () => {
    const user = userEvent.setup();
    mount();
    await toCodeStep(user);
    expect(
      screen.getByRole("button", { name: /resend in 60s/i }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /use my password/i }));
    expect(
      await screen.findByLabelText("Password", {}, SLOW),
    ).toBeInTheDocument();
  });

  it("stays on the password step if the code can't be sent", async () => {
    h.sendError =
      "For security purposes, you can only request this after 45 seconds.";
    const user = userEvent.setup();
    mount();
    await toMethodStep(user);
    await user.click(
      screen.getByRole("button", { name: /email me a sign-in code/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /wait a minute/i,
    );
    expect(screen.queryByLabelText("Sign-in code")).not.toBeInTheDocument();
  });
});

describe("Continue with Google", () => {
  it("is hidden unless Google sign-in is switched on", async () => {
    mount();
    await screen.findByLabelText("Email");
    await new Promise((r) => setTimeout(r, 30));
    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });

  it("goes to Google, and remembers the list they were invited to", async () => {
    h.google = true;
    const user = userEvent.setup();
    mount(`/login?next=/app/${ID}`);
    await user.click(
      await screen.findByRole("button", { name: /continue with google/i }),
    );
    await waitFor(() => expect(h.calls).toContainEqual(["google"]));
    expect(JSON.parse(localStorage.getItem("ordly.next")).p).toBe(`/app/${ID}`);
  });
});

describe("creating an account", () => {
  it("still works, and remembers where an invited person was headed", async () => {
    const user = userEvent.setup();
    mount(`/login?next=/app/${ID}`);
    await user.click(
      await screen.findByRole("button", { name: /create an account/i }),
    );
    await user.type(await screen.findByLabelText("Name"), "Pal");
    await user.type(screen.getByLabelText("Email"), "pal@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));
    await screen.findByText(/check your inbox/i);
    expect(h.calls.find((c) => c[0] === "signUp")[1]).toMatchObject({
      email: "pal@example.com",
      name: "Pal",
    });
    expect(JSON.parse(localStorage.getItem("ordly.next")).p).toBe(`/app/${ID}`);
  });
});
