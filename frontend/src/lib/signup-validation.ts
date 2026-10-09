export const SIGNUP_FULL_NAME_MAX = 301;
export const SIGNUP_EMAIL_MAX = 254;

/** Dubai / UAE mobile: +971 then 9 digits (5X XXX XXXX). */
export const DUBAI_COUNTRY_CODE = "971";
export const DUBAI_MOBILE_LOCAL_DIGITS = 9;

/** Second digit after 5: Etisalat / du mobile prefixes in UAE. */
const DUBAI_MOBILE_SECOND_DIGIT = "024568";

export const DUBAI_MOBILE_E164 = new RegExp(`^\\+${DUBAI_COUNTRY_CODE}5[${DUBAI_MOBILE_SECOND_DIGIT}]\\d{7}$`);
export const DUBAI_MOBILE_LOCAL = new RegExp(`^5[${DUBAI_MOBILE_SECOND_DIGIT}]\\d{7}$`);

export const DUBAI_MOBILE_HINT =
  "9-digit Dubai mobile starting with 50, 52, 54, 55, 56, or 58 — no +971.";

export const DUBAI_MOBILE_INVALID_MESSAGE = `Enter a Dubai mobile number (${DUBAI_MOBILE_HINT} For example, 50 123 4567).`;

export const DUBAI_MOBILE_TOO_LONG_MESSAGE = `Phone number is too long. ${DUBAI_MOBILE_HINT}`;

/** Build +971 E.164 from local digits (handles leading 0 or pasted 971). */
export function normalizeDubaiMobile(local: string): string {
  let digits = local.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith(DUBAI_COUNTRY_CODE)) digits = digits.slice(DUBAI_COUNTRY_CODE.length);
  return `+${DUBAI_COUNTRY_CODE}${digits}`;
}

/** @deprecated Use {@link normalizeDubaiMobile}. */
export function normalizeUaePhone(_countryCode: string, local: string): string {
  return normalizeDubaiMobile(local);
}

export type SignupFieldValues = {
  full_name: string;
  email: string;
  phone: string;
};

export function validateSignupFields(values: SignupFieldValues): string | null {
  const name = values.full_name.trim().replace(/\s+/g, " ");
  if (!name) return "Enter your full name.";
  if (name.length > SIGNUP_FULL_NAME_MAX) {
    return `Name is too long (use ${SIGNUP_FULL_NAME_MAX} characters or fewer).`;
  }

  const email = values.email.trim().toLowerCase();
  if (!email) return "Enter your email.";
  if (email.length > SIGNUP_EMAIL_MAX) {
    return `Email is too long (use ${SIGNUP_EMAIL_MAX} characters or fewer).`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  const phone = values.phone.trim();
  if (!phone) return "Enter your Dubai mobile number.";
  if (!phone.startsWith(`+${DUBAI_COUNTRY_CODE}`)) {
    return DUBAI_MOBILE_INVALID_MESSAGE;
  }
  const localDigits = phone.slice(4).replace(/\D/g, "");
  if (localDigits.length > DUBAI_MOBILE_LOCAL_DIGITS) {
    return DUBAI_MOBILE_TOO_LONG_MESSAGE;
  }
  if (!DUBAI_MOBILE_E164.test(phone)) {
    return DUBAI_MOBILE_INVALID_MESSAGE;
  }
  return null;
}
