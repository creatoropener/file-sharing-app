export const UUID_RE = /^[a-f0-9-]{36}$/;

export const assertId = (id: string): string => {
  if (!UUID_RE.test(id)) throw new Error('Invalid transfer id');
  return id;
};
