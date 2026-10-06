import argon2 from "argon2";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Hash de una contraseña que nadie usa. Se verifica cuando el email no existe, para que
 * el login tarde lo mismo exista o no la cuenta y no se pueda averiguar qué emails son válidos.
 */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(`no-account-${Math.random().toString(36)}`);
  return dummyHash;
}
