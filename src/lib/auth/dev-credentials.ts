export function getSeedUserPassword(): string {
  const password = process.env.SEED_USER_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "SEED_USER_PASSWORD est manquant. Définissez-le dans le fichier .env (non versionné).",
    );
  }
  return password;
}
