import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, type AuthErrorLike } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FoodLens" },
      { name: "description", content: "Sign in to FoodLens to scan meals and track your nutrition." },
      { property: "og:title", content: "Sign in — FoodLens" },
      { property: "og:description", content: "Sign in to FoodLens to scan meals and track your nutrition." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function fail(error: AuthErrorLike | null | undefined) {
    const msg = authErrorMessage(error);
    setFormError(msg);
    toast.error(msg);
    return msg;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/scan", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/scan", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function google() {
    setFormError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) {
        fail(error);
        setBusy(false);
      }
    } catch (err) {
      fail({ message: err instanceof Error ? err.message : "Google sign-in failed" });
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) fail(error);
    } catch (err) {
      fail({ message: err instanceof Error ? err.message : "Could not sign in." });
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedName = name.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
          data: { full_name: trimmedName, display_name: trimmedName },
        },
      });
      if (error) {
        fail(error);
        if (error.code === "user_already_exists") setTab("signin");
        return;
      }
      // Some projects hide "already registered" by returning a user with no identity.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        fail({ code: "user_already_exists", message: "User already registered" });
        setTab("signin");
        return;
      }
      if (data.session) {
        // onAuthStateChange already sends a new session to /scan. A second
        // navigate here races that redirect and leaves the button spinning.
        toast.success("Account created. You're signed in.");
        return;
      }
      setSent(`We sent a confirmation link to ${trimmedEmail}. Open it to finish signing up.`);
    } catch (err) {
      fail({ message: err instanceof Error ? err.message : "Could not create the account." });
    } finally {
      setBusy(false);
    }
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      if (error) fail(error);
      else setSent(`Check ${trimmedEmail} for your one-time sign-in link.`);
    } catch (err) {
      fail({ message: err instanceof Error ? err.message : "Could not send the sign-in link." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center grid-lines px-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-glow">
        <Logo />
        <h1 className="mt-6 text-3xl font-bold">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to scan meals and track your nutrition.</p>

        {sent ? (
          <div className="mt-6 rounded-xl border bg-accent p-4 text-sm text-accent-foreground">{sent}</div>
        ) : (
          <>
            <Button variant="outline" className="mt-6 w-full" onClick={google}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.95S8.78 6.5 12 6.5c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.94 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.6-.07-1.05-.29-1.1z"/></svg>
              Continue with Google
            </Button>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
            {formError && (
              <p role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value);
                setFormError(null);
              }}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="phone">Phone</TabsTrigger>
                <TabsTrigger value="otp">Email code</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="mt-4 space-y-3">
                  <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="mt-4 space-y-3">
                  <Field label="Name"><Input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <Field label="Password">
                    <Input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters. Common passwords such as Password123 are rejected — use a unique phrase.
                  </p>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="phone">
                <PhoneLogin
                  onUnavailable={(message) => {
                    setFormError(message);
                    toast.error(message);
                    setTab("signup");
                  }}
                />
              </TabsContent>
              <TabsContent value="otp">
                <form onSubmit={magic} className="mt-4 space-y-3">
                  <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <Button className="w-full" disabled={busy}><Mail className="h-4 w-4" /> Email me a one-time link</Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function PhoneLogin({ onUnavailable }: { onUnavailable: (message: string) => void }) {
  const [code, setCode] = useState("+91");
  const [num, setNum] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const phone = `${code.startsWith("+") ? code : "+" + code}${num.replace(/\D/g, "")}`;

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^\+\d{8,15}$/.test(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        const msg = authErrorMessage(error);
        if (error.code === "phone_provider_disabled") onUnavailable(msg);
        else toast.error(msg);
        return;
      }
      toast.success(`Code sent to ${phone}`);
      setStep("code");
      setWait(30);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  if (step === "code")
    return (
      <form onSubmit={verify} className="mt-4 space-y-3">
        <Field label={`6-digit code sent to ${phone}`}>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Button className="w-full" disabled={busy || otp.length < 6}>Verify & sign in</Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          <button type="button" className="underline" onClick={() => setStep("phone")}>Change number</button>
          <button type="button" className="underline disabled:no-underline disabled:opacity-60" disabled={wait > 0 || busy} onClick={() => send()}>
            {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
          </button>
        </div>
      </form>
    );

  return (
    <form onSubmit={send} className="mt-4 space-y-3">
      <Field label="Phone number">
        <div className="flex gap-2">
          <Input className="w-20" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Country code" />
          <Input type="tel" required placeholder="98765 43210" value={num} onChange={(e) => setNum(e.target.value)} />
        </div>
      </Field>
      <Button className="w-full" disabled={busy}>Text me a code</Button>
      <p className="text-xs text-muted-foreground">Phone sign-up has to be enabled on the server. If it isn't, use the Sign up tab.</p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
