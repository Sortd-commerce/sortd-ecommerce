"use client";

import { ArrowRight, CaretDown, X } from "@phosphor-icons/react";
import { BrandMark } from "@/components/BrandMark";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";
import { SubmitButton } from "@/components/ActionForm";
import { getOrCreateDeviceId } from "@/components/DeviceIdField";
import {
  requestLoginCodeAction,
  resendCodeAction,
  signupAction,
  verifyLoginCodeAction,
  verifySignupCodeAction,
} from "@/lib/actions";
import { isLoginAccountMissing } from "@/lib/auth-messages";
import { useToast } from "@/components/Toast";
import { emptyActionState } from "@/lib/action-state";
import {
  DUBAI_MOBILE_HINT,
  DUBAI_MOBILE_LOCAL_DIGITS,
  normalizeDubaiMobile,
  SIGNUP_EMAIL_MAX,
  SIGNUP_FULL_NAME_MAX,
  validateSignupFields,
} from "@/lib/signup-validation";

const RESEND_SECONDS = 60;

function CodeStep({
  purpose,
  email,
  nextPath,
  title,
  submitLabel,
  onVerified,
  onChangeEmail,
  onCreateAccount,
}: {
  purpose: "signup" | "login";
  email: string;
  nextPath: string;
  title: string;
  submitLabel: string;
  onVerified: (firstName: string, purpose: "signup" | "login") => void;
  onChangeEmail: () => void;
  onCreateAccount?: () => void;
}) {
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const verifyAction = purpose === "signup" ? verifySignupCodeAction : verifyLoginCodeAction;
  const [verifyState, verifyFormAction] = useActionState(verifyAction, emptyActionState);
  const [resendState, resendFormAction] = useActionState(resendCodeAction, emptyActionState);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (verifyState.ok && verifyState.firstName) {
      onVerified(verifyState.firstName, purpose);
    }
  }, [onVerified, purpose, verifyState.firstName, verifyState.ok]);

  useEffect(() => {
    if (resendState.ok) setSecondsLeft(RESEND_SECONDS);
  }, [resendState.ok]);

  const invalid = verifyState.ok === false && Boolean(verifyState.message);

  return (
    <>
      <h2 id="auth-modal-title" className="auth-modal-title">
        {title}
      </h2>
      <p className="auth-modal-copy">
        {purpose === "signup" ? (
          <>
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to finish creating your account.
          </>
        ) : (
          <>
            We sent a 6-digit login code to <strong>{email}</strong>. Enter it below to continue.
          </>
        )}
      </p>
      <button type="button" className="auth-modal-link" onClick={onChangeEmail}>
        Wrong email? Change it
      </button>
      <form action={verifyFormAction} className="auth-modal-form">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="device_id" value={deviceId} />
        <input type="hidden" name="next" value={nextPath} />
        <OtpInput value={code} onChange={setCode} invalid={invalid} />
        {invalid ? (
          <p className="auth-modal-error" role="alert">
            {verifyState.message}
          </p>
        ) : null}
        <div className="auth-code-meta">
          {secondsLeft > 0 ? (
            <span className="auth-code-meta-muted">Didn&apos;t get it? Resend in 0:{String(secondsLeft).padStart(2, "0")}</span>
          ) : (
            <button
              type="submit"
              form={`resend-${purpose}-code`}
              className="auth-modal-link auth-modal-link--button"
            >
              Didn&apos;t get it? Resend code
            </button>
          )}
          <span className="auth-code-meta-muted">Code expires in 10 min</span>
        </div>
        <SubmitButton className="btn btn-primary auth-modal-submit" pendingLabel="Checking…" disabled={code.length !== 6}>
          {submitLabel}
          <ArrowRight size={18} weight="bold" aria-hidden />
        </SubmitButton>
      </form>
      <form id={`resend-${purpose}-code`} action={resendFormAction} className="sr-only">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="purpose" value={purpose} />
      </form>
      {purpose === "login" && onCreateAccount ? (
        <p className="auth-modal-foot">
          New to Sortd?{" "}
          <button type="button" className="auth-modal-link" onClick={onCreateAccount}>
            Create an account
          </button>
        </p>
      ) : null}
    </>
  );
}

export function AuthModal({
  step,
  email,
  nextPath,
  onClose,
  onSwitch,
  onCodeSent,
  onVerified,
  onChangeEmail,
}: {
  step: "signup" | "signup-code" | "login" | "login-code";
  email: string;
  nextPath: string;
  onClose: () => void;
  onSwitch: (step: "signup" | "login" | "signup-code" | "login-code", prefillEmail?: string) => void;
  onCodeSent: (email: string, purpose: "signup" | "login") => void;
  onVerified: (firstName: string, purpose: "signup" | "login") => void;
  onChangeEmail: () => void;
}) {
  const toast = useToast();
  const [signupState, signupFormAction] = useActionState(signupAction, emptyActionState);
  const [loginState, loginFormAction] = useActionState(requestLoginCodeAction, emptyActionState);
  const [loginEmail, setLoginEmail] = useState(email);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [signupFieldError, setSignupFieldError] = useState("");
  const dubaiCode = "+971";
  /** Stale ok state from useActionState would re-advance to the code step after "Change email". */
  const skipCodeAdvanceRef = useRef(false);
  const loginToastKeyRef = useRef("");

  const loginAccountMissing = isLoginAccountMissing(loginState);
  const loginEmailForSignup = (loginState.email || loginEmail).trim().toLowerCase();

  useEffect(() => {
    setLoginEmail(email);
  }, [email]);

  useEffect(() => {
    if (step !== "login" || !loginAccountMissing) return;
    const key = `${loginEmailForSignup}:${loginState.message}`;
    if (loginToastKeyRef.current === key) return;
    loginToastKeyRef.current = key;
    toast.error("No account found with this email.");
  }, [loginAccountMissing, loginEmailForSignup, loginState.message, step, toast]);

  const handleChangeEmail = useCallback(() => {
    skipCodeAdvanceRef.current = true;
    onChangeEmail();
  }, [onChangeEmail]);

  useEffect(() => {
    if (step !== "signup") return;
    if (skipCodeAdvanceRef.current) {
      skipCodeAdvanceRef.current = false;
      return;
    }
    if (signupState.ok && signupState.email && signupState.purpose === "signup") {
      onCodeSent(signupState.email, "signup");
    }
  }, [onCodeSent, signupState.email, signupState.ok, signupState.purpose, step]);

  useEffect(() => {
    if (step !== "login") return;
    if (skipCodeAdvanceRef.current) {
      skipCodeAdvanceRef.current = false;
      return;
    }
    if (loginState.ok && loginState.email && (loginState.purpose === "login" || loginState.purpose === "signup")) {
      onCodeSent(loginState.email, loginState.purpose);
    }
  }, [loginState.email, loginState.ok, loginState.purpose, onCodeSent, step]);

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => {
      window.cancelAnimationFrame(frame);
      setEntered(false);
    };
  }, []);

  return (
    <div className={`auth-modal-layer ${entered ? "sheet-enter" : ""}`}>
      <button type="button" className="auth-modal-scrim" aria-label="Close sign in" onClick={onClose} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <span className="sheet-handle auth-modal-handle" aria-hidden />
        <div className="auth-modal-brand-row">
          <BrandMark size="sm" />
          <button type="button" className="auth-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} weight="bold" />
          </button>
        </div>

        {step === "signup" ? (
          <>
            <h2 id="auth-modal-title" className="auth-modal-title">
              Create your account
            </h2>
            <p className="auth-modal-copy">
              So you can pay and track this order. All three fields are required.
            </p>
            <form
              action={signupFormAction}
              className="auth-modal-form"
              noValidate
              onSubmit={(event) => {
                const form = event.currentTarget;
                const full_name = String(new FormData(form).get("full_name") || "");
                const signupEmail = String(new FormData(form).get("email") || "");
                const local = String(new FormData(form).get("phone_local") || "");
                const phone = normalizeDubaiMobile(local);
                const message = validateSignupFields({ full_name, email: signupEmail, phone });
                if (message) {
                  event.preventDefault();
                  setSignupFieldError(message);
                  return;
                }
                setSignupFieldError("");
              }}
            >
              <label className="field">
                <span>Full name</span>
                <input
                  name="full_name"
                  autoComplete="name"
                  required
                  maxLength={SIGNUP_FULL_NAME_MAX}
                  onChange={() => setSignupFieldError("")}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  defaultValue={email}
                  key={`signup-email-${email}`}
                  required
                  maxLength={SIGNUP_EMAIL_MAX}
                  onChange={() => setSignupFieldError("")}
                />
                <small className="field-hint">We&apos;ll send a verification code here.</small>
              </label>
              <label className="field">
                <span>Phone</span>
                <div className="auth-phone-row">
                  <span className="auth-phone-prefix" aria-label="Dubai country code">
                    <span>{dubaiCode}</span>
                    <CaretDown size={14} weight="bold" aria-hidden />
                  </span>
                  <input
                    name="phone_local"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="501234567"
                    value={phoneLocal}
                    maxLength={DUBAI_MOBILE_LOCAL_DIGITS}
                    onChange={(event) => {
                      setPhoneLocal(event.target.value.replace(/\D/g, "").slice(0, DUBAI_MOBILE_LOCAL_DIGITS));
                      setSignupFieldError("");
                    }}
                    required
                  />
                </div>
                <input type="hidden" name="phone_country" value={dubaiCode} readOnly />
                <input type="hidden" name="phone" value={normalizeDubaiMobile(phoneLocal)} readOnly />
                <small className="field-hint">For delivery updates from the rider. {DUBAI_MOBILE_HINT}</small>
              </label>
              {signupFieldError ? (
                <p className="auth-modal-error" role="alert">
                  {signupFieldError}
                </p>
              ) : null}
              {signupState.ok === false && signupState.message ? (
                <p className="auth-modal-error" role="alert">
                  {signupState.message}
                </p>
              ) : null}
              <SubmitButton className="btn btn-primary auth-modal-submit" pendingLabel="Sending…">
                Send code
                <ArrowRight size={18} weight="bold" aria-hidden />
              </SubmitButton>
            </form>
            <p className="auth-modal-foot">
              Already have an account?{" "}
              <button type="button" className="auth-modal-link" onClick={() => onSwitch("login")}>
                Log in
              </button>
            </p>
            <p className="auth-modal-legal">
              By continuing you agree to Sortd&apos;s Terms and Privacy Policy.
            </p>
          </>
        ) : null}

        {step === "login" ? (
          <>
            <h2 id="auth-modal-title" className="auth-modal-title">
              {nextPath.startsWith("/checkout") ? "Log in to check out" : "Log in"}
            </h2>
            <p className="auth-modal-copy">
              {nextPath.startsWith("/checkout")
                ? "Enter the email on your Sortd account. We'll send a 6-digit login code."
                : "Enter the email on your existing Sortd account. We'll send a 6-digit login code."}
            </p>
            <form action={loginFormAction} className="auth-modal-form">
              <input type="hidden" name="next" value={nextPath} />
              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                />
              </label>
              {loginAccountMissing ? (
                <p className="auth-modal-error" role="alert">
                  No account found with this email.{" "}
                  <button
                    type="button"
                    className="auth-modal-link auth-modal-link--inline"
                    onClick={() => onSwitch("signup", loginEmailForSignup)}
                  >
                    Create an account
                  </button>
                </p>
              ) : loginState.ok === false && loginState.message ? (
                <p className="auth-modal-error" role="alert">
                  {loginState.message}
                </p>
              ) : null}
              <SubmitButton className="btn btn-primary auth-modal-submit" pendingLabel="Sending…">
                Send code
                <ArrowRight size={18} weight="bold" aria-hidden />
              </SubmitButton>
            </form>
            <p className="auth-modal-foot">
              New to Sortd?{" "}
              <button
                type="button"
                className="auth-modal-link"
                onClick={() => onSwitch("signup", loginEmail.trim().toLowerCase())}
              >
                Create an account
              </button>
            </p>
          </>
        ) : null}

        {step === "signup-code" ? (
          <CodeStep
            purpose="signup"
            email={email}
            nextPath={nextPath}
            title="Check your email"
            submitLabel="Verify and continue"
            onVerified={onVerified}
            onChangeEmail={handleChangeEmail}
          />
        ) : null}

        {step === "login-code" ? (
          <CodeStep
            purpose="login"
            email={email}
            nextPath={nextPath}
            title="Check your email"
            submitLabel="Verify and continue"
            onVerified={onVerified}
            onChangeEmail={handleChangeEmail}
            onCreateAccount={() => onSwitch("signup", email)}
          />
        ) : null}
      </div>
    </div>
  );
}
