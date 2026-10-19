// Mirrors the API's password policy (servihub-api/src/validators/common.js)
// so people see the problem before submitting. The API remains the judge.
export function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number";
  }
  return "";
}

// A rough guide to how hard a password would be to guess, shown while
// someone types a new one: 0 doesn't meet the policy, then 1 (fair) to 3
// (strong) by length and variety of characters. Advice only; the API judges.
export function passwordStrength(password) {
  if (!password) return null;
  if (validatePassword(password)) return { level: 0, label: "Too weak" };
  let points = 0;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  if (points <= 1) return { level: 1, label: "Fair" };
  if (points === 2) return { level: 2, label: "Good" };
  return { level: 3, label: "Strong" };
}
