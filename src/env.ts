const { PORT } = process.env;

export const env = {
  PORT: PORT ? Number(PORT) : 8080,
};
