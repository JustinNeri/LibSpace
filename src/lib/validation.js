/** Students must register with a Gmail address; staff may use any domain. */
export const STUDENT_EMAIL_DOMAIN = 'gmail.com'

export function isGmailAddress(email) {
  return /^[^\s@]+@gmail\.com$/i.test(String(email).trim())
}
