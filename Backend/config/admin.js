const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || 'davidgarciaparada2020@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function isAdminEmail(email) {
  return typeof email === 'string' && adminEmails.has(email.trim().toLowerCase());
}

module.exports = {
  isAdminEmail,
};
