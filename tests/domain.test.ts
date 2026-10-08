import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/main/services/security';

describe('segurança de credenciais', () => {
  it('verifica a senha correta e rejeita senha incorreta', () => {
    const encoded = hashPassword('senha-segura-123');
    expect(verifyPassword('senha-segura-123', encoded)).toBe(true);
    expect(verifyPassword('senha-errada', encoded)).toBe(false);
  });

  it('gera hashes diferentes para a mesma senha por causa do salt', () => {
    expect(hashPassword('mesma-senha')).not.toBe(hashPassword('mesma-senha'));
  });
});
