/** Students must register with a Gmail address; staff may use any domain. */
export const STUDENT_EMAIL_DOMAIN = 'gmail.com'

/** Supabase rejects anything shorter than 6; we ask for a little more. */
export const MIN_PASSWORD_LENGTH = 8

export function isGmailAddress(email) {
  return /^[^\s@]+@gmail\.com$/i.test(String(email).trim())
}

export function isEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

/** Returns a message describing the first problem, or null when acceptable. */
export function passwordProblem(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number.'
  }
  return null
}
